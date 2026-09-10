import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  slotLabel,
  cleanAdvisoryMessages,
  buildSynthesisPrompt,
  parseMoACommand,
  runReferencesParallel,
  runMoAPipeline,
  formatMoAResponse,
  stripOrSummarizeCode,
  streamMoATurn,
  estimateTokenCost,
} from '../lib/moa-runner.js'

test('estimateTokenCost: computes accurate token costs for known and fallback models', () => {
  const dsSlot = { provider: 'opencode-go', model: 'deepseek-v4-flash' }
  const dsUsage = { inputTokens: 10000, outputTokens: 5000 }
  const dsCost = estimateTokenCost(dsSlot, dsUsage)
  assert.equal(dsCost.inputTokens, 10000)
  assert.equal(dsCost.outputTokens, 5000)
  assert.equal(dsCost.totalTokens, 15000)
  // (10000 * 0.14 / 1e6) + (5000 * 0.28 / 1e6) = 0.0014 + 0.0014 = 0.0028
  assert.equal(dsCost.costUsd, 0.0028)

  const fallbackSlot = { provider: 'unknown-vendor', model: 'unknown-model' }
  const fbUsage = { inputTokens: 10000, outputTokens: 10000 }
  const fbCost = estimateTokenCost(fallbackSlot, fbUsage)
  // (10000 * 0.50 / 1e6) + (10000 * 1.50 / 1e6) = 0.0050 + 0.0150 = 0.02
  assert.equal(fbCost.costUsd, 0.02)
})

test('slotLabel: formats provider and model slots', () => {
  assert.equal(slotLabel({ provider: 'opencode-go', model: 'deepseek-v4-flash' }), 'opencode-go:deepseek-v4-flash')
  assert.equal(slotLabel({ model: 'gpt-4o' }), 'gpt-4o')
  assert.equal(slotLabel('direct-string'), 'direct-string')
  assert.equal(slotLabel(null), 'unknown')
})

test('cleanAdvisoryMessages: filters non-text, tool and system messages', () => {
  const raw = [
    { role: 'system', content: 'You are an agent with tools: file_read, run_command' },
    { role: 'user', content: 'Create a website header' },
    { role: 'assistant', content: 'Sure! Let me check the directory.' },
    { role: 'tool', content: 'index.html, style.css' },
    { role: 'assistant', content: [{ type: 'thought', text: 'thinking' }, { type: 'text', text: 'Here is the plan.' }] },
  ]

  const cleaned = cleanAdvisoryMessages(raw)
  assert.equal(cleaned.length, 3)
  assert.equal(cleaned[0].role, 'user')
  assert.equal(cleaned[0].content, 'Create a website header')
  assert.equal(cleaned[1].role, 'assistant')
  assert.equal(cleaned[1].content, 'Sure! Let me check the directory.')
  assert.equal(cleaned[2].role, 'assistant')
  assert.equal(cleaned[2].content, 'Here is the plan.')
})

test('cleanAdvisoryMessages: caps large messages to budget', () => {
  const hugeText = 'a'.repeat(30000)
  const raw = [{ role: 'user', content: hugeText }]
  const cleaned = cleanAdvisoryMessages(raw, 10000)
  assert.equal(cleaned.length, 1)
  assert.ok(cleaned[0].content.length < 11000)
  assert.ok(cleaned[0].content.includes('[trimmed'))
})

test('buildSynthesisPrompt: contains user prompt, labeled reference blocks and judge criteria', () => {
  const refs = [
    { label: 'opencode-go:deepseek-v4-flash', text: 'Option A with flexbox' },
    { label: 'grok:grok-build-0.1', text: 'Option B with grid' },
  ]
  const criteria = 'Prioritize accessibility and mobile responsiveness'
  const prompt = buildSynthesisPrompt('Build a navbar', refs, criteria)

  assert.ok(prompt.includes('Build a navbar'))
  assert.ok(prompt.includes('Reference 1 — opencode-go:deepseek-v4-flash:\nOption A with flexbox'))
  assert.ok(prompt.includes('Reference 2 — grok:grok-build-0.1:\nOption B with grid'))
  assert.ok(prompt.includes('Prioritize accessibility and mobile responsiveness'))
  assert.ok(prompt.includes('WINNER_CANDIDATE_INDEX:'))
})

test('parseMoACommand: parses bare /moa, default prompt and preset selection', () => {
  const presets = [{ name: 'default' }, { name: 'code-review' }, { name: 'deep-reasoning' }]

  // Bare command
  assert.deepEqual(parseMoACommand('/moa', presets), {
    presetName: 'default',
    prompt: '',
  })

  // Standard prompt with default preset
  assert.deepEqual(parseMoACommand('/moa write a python fibonacci', presets), {
    presetName: 'default',
    prompt: 'write a python fibonacci',
  })

  // Named preset prefix
  assert.deepEqual(parseMoACommand('/moa code-review check this function', presets), {
    presetName: 'code-review',
    prompt: 'check this function',
  })

  // Flag syntax
  assert.deepEqual(parseMoACommand('/moa --preset=deep-reasoning solve math problem', presets), {
    presetName: 'deep-reasoning',
    prompt: 'solve math problem',
  })

  // Non-moa string returns null
  assert.equal(parseMoACommand('just regular text', presets), null)
})

test('runReferencesParallel: parallel fan-out and partial failure handling', async () => {
  const references = [
    { provider: 'p1', model: 'm1' },
    { provider: 'p2', model: 'm2' },
    { provider: 'p3', model: 'm3' },
  ]

  const calls = []
  const mockCallLlm = async (params) => {
    calls.push(params.model)
    if (params.model === 'm2') {
      throw new Error('Rate limit exceeded')
    }
    return `Output from ${params.model}`
  }

  const results = await runReferencesParallel(references, [{ role: 'user', content: 'test' }], {}, mockCallLlm)
  assert.equal(calls.length, 3)

  assert.equal(results[0].ok, true)
  assert.equal(results[0].text, 'Output from m1')

  assert.equal(results[1].ok, false)
  assert.ok(results[1].text.includes('Rate limit exceeded'))

  assert.equal(results[2].ok, true)
  assert.equal(results[2].text, 'Output from m3')
})

test('runMoAPipeline: full flow of parallel proposers + aggregator synthesis', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-full-test-'))
  try {
    const preset = {
      name: 'default',
      reference_models: [
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'deepseek', model: 'deepseek-v3' },
      ],
      aggregator: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
      reference_temperature: 0.7,
      aggregator_temperature: 0.3,
    }

    const mockCallLlm = async (params) => {
      if (params.model === 'claude-3-7-sonnet') {
        assert.equal(params.temperature, 0.3)
        assert.ok(params.messages[0].content.includes('Reference 1 — openai:gpt-4o'))
        assert.ok(params.messages[0].content.includes('Reference 2 — deepseek:deepseek-v3'))
        return 'Synthesized final verdict from Claude'
      }
      return `Candidate response from ${params.model}`
    }

    const res = await runMoAPipeline({
      userPrompt: 'Explain quantum computing',
      preset,
      callLlm: mockCallLlm,
      cwd: tmpDir,
    })

    assert.equal(res.aggregator, 'anthropic:claude-3-7-sonnet')
    assert.equal(res.content, 'Synthesized final verdict from Claude')
    assert.equal(res.references.length, 2)
    assert.equal(res.references[0].text, 'Candidate response from gpt-4o')
    assert.equal(res.references[1].text, 'Candidate response from deepseek-v3')
    assert.ok(res.usage.totalTokens > 0)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('runMoAPipeline: fast mode with 1 candidate bypasses aggregator', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-fast-test-'))
  try {
    const preset = {
      name: 'fast',
      reference_models: [{ provider: 'opencode-go', model: 'deepseek-v4-flash' }],
    }

    let aggregatorCalled = false
    const mockCallLlm = async (params) => {
      if (params.model !== 'deepseek-v4-flash') {
        aggregatorCalled = true
      }
      return 'Fast single candidate response ```html file="index.html"\n<h1>Fast</h1>\n```'
    }

    const res = await runMoAPipeline({
      userPrompt: 'Fast generate header',
      preset,
      callLlm: mockCallLlm,
      cwd: tmpDir,
    })

    assert.equal(aggregatorCalled, false, 'Aggregator is bypassed in fast mode')
    assert.equal(res.isFastMode, true)
    assert.ok(res.promotedFiles.includes('index.html'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('runMoAPipeline: aggregator failure falls back to joined candidates', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-fallback-test-'))
  try {
    const preset = {
      name: 'fallback-test',
      reference_models: [
        { provider: 'p1', model: 'm1' },
        { provider: 'p2', model: 'm2' },
      ],
      aggregator: { provider: 'agg-p', model: 'failing-agg' },
    }

    const mockCallLlm = async (params) => {
      if (params.model === 'failing-agg') {
        throw new Error('503 Service Unavailable')
      }
      return `Proposal text for ${params.model}`
    }

    const res = await runMoAPipeline({
      userPrompt: 'Test fallback',
      preset,
      callLlm: mockCallLlm,
      cwd: tmpDir,
    })

    assert.ok(res.content.includes('Aggregator error: 503 Service Unavailable'))
    assert.ok(res.content.includes('Fallback candidate outputs'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('formatMoAResponse: formats candidate outputs, judge synthesis, and cost breakdown', () => {
  const moaResult = {
    content: 'Final synthesized calculator code in HTML',
    aggregator: 'codex:gpt-5.6-sol',
    presetName: 'default',
    usage: { totalTokens: 12400, totalCostUsd: 0.024 },
    references: [
      { label: 'opencode-go:deepseek-v4-flash', text: 'Candidate 1 code', costUsd: 0.001, ok: true },
      { label: 'grok:grok-build-0.1', text: 'Candidate 2 code', costUsd: 0.015, ok: true },
    ],
  }

  const output = formatMoAResponse({ moaResult, presetName: 'default' })

  assert.ok(output.includes('Mixture of Agents (Пресет: default | Судья: codex:gpt-5.6-sol)'))
  assert.ok(output.includes('Стоимость запуска') && output.includes('$0.0240') && output.includes('12.4k'))
  assert.ok(output.includes('Ответы моделей-советников (2):'))

  assert.ok(output.includes('Модель 1: opencode-go:deepseek-v4-flash'))
  assert.ok(output.includes('Candidate 1 code'))
  assert.ok(output.includes('Модель 2: grok:grok-build-0.1'))
  assert.ok(output.includes('Candidate 2 code'))

  assert.ok(output.includes('Вердикт судьи и итоговое решение (Синтез: codex:gpt-5.6-sol)'))
  assert.ok(output.includes('Final synthesized calculator code in HTML'))
})

test('stripOrSummarizeCode: summarizes multi-line code blocks to save tokens', () => {
  const input = `Вот моё решение:\n\n\`\`\`html index.html\n<!DOCTYPE html>\n<html>\n<body>\n<h1>Calc</h1>\n<script>console.log("hello");</script>\n</body>\n</html>\n\`\`\`\n\nГотово к запуску!`
  const result = stripOrSummarizeCode(input)
  assert.ok(!result.includes('<!DOCTYPE html>'))
  assert.ok(result.includes('индекс.html') || result.includes('index.html') || result.includes('строк сохранены на диск'))
  assert.ok(result.includes('Готово к запуску!'))
})

test('formatMoAResponse: includes Live Canvas preview link and summarizes promoted files', () => {
  const moaResult = {
    kind: 'synthesis',
    content: 'Решение принято. Победитель: Кандидат 1.\n\n\`\`\`html\n<!DOCTYPE html>...\n\`\`\`',
    aggregator: 'codex:gpt-5.6-sol',
    presetName: 'default',
    promotedFiles: ['index.html'],
    liveCanvas: {
      canvasId: 'canvas-12345',
      title: 'index.html',
      filePath: 'index.html',
      previewUrl: '/dsh-live-canvas/sandbox/canvas-12345',
    },
    references: [
      {
        label: 'opencode-go:deepseek-v4-flash',
        text: 'Кандидат 1 создал калькулятор.\n\`\`\`html index.html\n<html>50 lines of code</html>\n\`\`\`',
        ok: true,
        files: [{ relativePath: 'index.html' }],
      },
    ],
  }

  const output = formatMoAResponse({ moaResult, presetName: 'default' })
  assert.ok(output.includes('Созданы файлы в проекте'))
  assert.ok(output.includes('index.html'))
  assert.ok(output.includes('Live Canvas'))
  assert.ok(output.includes('/dsh-live-canvas/sandbox/canvas-12345'))
  assert.ok(!output.includes('50 lines of code'))
})

test('streamMoATurn: streams progress delta and completes with synthesis', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-stream-test-'))
  try {
    const turnContext = {
      targetPreset: {
        name: 'test-preset',
        reference_models: [{ provider: 'p1', model: 'm1' }],
        aggregator: { provider: 'real-provider', model: 'real-aggregator-model' },
      },
      userPrompt: 'write hello world',
      messages: [],
      callLlm: async () => 'hello world result',
      cwd: tmpDir,
    }

    const chunks = []
    for await (const chunk of streamMoATurn(turnContext, {})) {
      chunks.push(chunk)
    }

    assert.equal(chunks[0].type, 'block-start')
    assert.equal(chunks[1].type, 'text-delta')
    assert.ok(chunks[1].text.includes('Mixture of Agents'))

    const synthDelta = chunks.findLast(c => c.type === 'text-delta')
    assert.ok(synthDelta)
    assert.ok(synthDelta.text.includes('hello world result'))

    const finishChunk = chunks.find(c => c.type === 'finish')
    assert.ok(finishChunk)
    assert.equal(finishChunk.reason.kind, 'stop')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('streamMoATurn: handles aborted signal gracefully without crashing', async () => {
  const ac = new AbortController()
  ac.abort()

  const turnContext = {
    targetPreset: { name: 'fast' },
    userPrompt: 'aborted test',
    messages: [],
    callLlm: async () => 'should not run',
  }

  const chunks = []
  for await (const chunk of streamMoATurn(turnContext, { signal: ac.signal })) {
    chunks.push(chunk)
  }
  assert.equal(chunks.length, 0)
})

