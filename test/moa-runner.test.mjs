import test from 'node:test'
import assert from 'node:assert/strict'
import {
  slotLabel,
  cleanAdvisoryMessages,
  buildSynthesisPrompt,
  parseMoACommand,
  runReferencesParallel,
  runMoAPipeline,
  formatMoAResponse,
  stripOrSummarizeCode,
  MoaRunnerAdapter,
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

  const customSlot = { provider: 'codex', model: 'custom-model' }
  const customCost = estimateTokenCost(customSlot, { inputTokens: 100000, outputTokens: 10000 }, { 'codex/custom-model': { input: 2.50, output: 10.00 } })
  // (100000 * 2.50 / 1e6) + (10000 * 10.00 / 1e6) = 0.25 + 0.10 = 0.35
  assert.equal(customCost.costUsd, 0.35)
})

test('slotLabel: formats provider and model slots', () => {
  assert.equal(slotLabel({ provider: 'anthropic', model: 'claude-3-5-sonnet' }), 'anthropic:claude-3-5-sonnet')
  assert.equal(slotLabel({ provider: 'openai', model: 'gpt-4o' }), 'openai:gpt-4o')
  assert.equal(slotLabel({ model: 'gpt-4o' }), 'gpt-4o')
  assert.equal(slotLabel(null), 'unknown')
})

test('cleanAdvisoryMessages: filters non-text, tool and system messages', () => {
  const messages = [
    { role: 'system', content: 'system instructions' },
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'world' },
    { role: 'tool', content: 'tool execution result' },
  ]

  const cleaned = cleanAdvisoryMessages(messages)
  assert.equal(cleaned.length, 2)
  assert.equal(cleaned[0].role, 'user')
  assert.equal(cleaned[0].content, 'hello')
  assert.equal(cleaned[1].role, 'assistant')
  assert.equal(cleaned[1].content, 'world')
})

test('cleanAdvisoryMessages: caps large messages to budget', () => {
  const longText = 'a'.repeat(6000)
  const messages = [{ role: 'user', content: longText }]
  const cleaned = cleanAdvisoryMessages(messages, 2000)

  assert.equal(cleaned.length, 1)
  assert.ok(cleaned[0].content.length < 3000)
  assert.ok(cleaned[0].content.includes('[trimmed'))
})

test('buildSynthesisPrompt: contains user prompt, labeled reference blocks and judge criteria', () => {
  const prompt = 'Build a landing page'
  const refs = [
    { label: 'openai:gpt-4o', text: 'Option A code', files: [{ relativePath: 'index.html' }] },
    { label: 'deepseek:deepseek-v3', text: 'Option B code', files: [{ relativePath: 'index.html' }] },
  ]
  const criteria = 'Приоритет: минимальный размер бандла и скорость'
  const result = buildSynthesisPrompt(prompt, refs, criteria)

  assert.ok(result.includes('Build a landing page'))
  assert.ok(result.includes('Reference 1 — openai:gpt-4o: [Созданные файлы: index.html]'))
  assert.ok(result.includes('Option A code'))
  assert.ok(result.includes('Reference 2 — deepseek:deepseek-v3: [Созданные файлы: index.html]'))
  assert.ok(result.includes('Option B code'))
  assert.ok(result.includes('Дополнительные критерии оценки от пользователя:'))
  assert.ok(result.includes(criteria))
  assert.ok(result.includes('WINNER_CANDIDATE_INDEX'))
})

test('parseMoACommand: parses bare /moa, default prompt and preset selection', () => {
  const presets = [
    { name: 'default', reference_models: [] },
    { name: 'code-review', reference_models: [] },
  ]

  const bare = parseMoACommand('/moa')
  assert.equal(bare.presetName, 'default')
  assert.equal(bare.prompt, '')

  const flagTurn = parseMoACommand('/moa --preset=code-review check my code', presets)
  assert.equal(flagTurn.presetName, 'code-review')
  assert.equal(flagTurn.prompt, 'check my code')

  const defaultTurn = parseMoACommand('/moa write a quicksort algorithm', presets)
  assert.equal(defaultTurn.presetName, 'default')
  assert.equal(defaultTurn.prompt, 'write a quicksort algorithm')

  const presetTurn = parseMoACommand('/moa code-review review this diff', presets)
  assert.equal(presetTurn.presetName, 'code-review')
  assert.equal(presetTurn.prompt, 'review this diff')
})

test('runReferencesParallel: parallel fan-out and partial failure handling', async () => {
  const references = [
    { provider: 'p1', model: 'm1' },
    { provider: 'p2', model: 'm2' },
    { provider: 'p3', model: 'm3' },
  ]

  const calls = []
  const mockCallLlm = async (params) => {
    calls.push(params)
    if (params.model === 'm2') {
      throw new Error('Rate limit exceeded')
    }
    return `Output from ${params.model}`
  }

  const results = await runReferencesParallel(references, [{ role: 'user', content: 'test' }], {}, mockCallLlm)
  assert.equal(results.length, 3)
  assert.equal(calls.length, 3)

  assert.equal(results[0].ok, true)
  assert.equal(results[0].text, 'Output from m1')

  assert.equal(results[1].ok, false)
  assert.ok(results[1].text.includes('Rate limit exceeded'))

  assert.equal(results[2].ok, true)
  assert.equal(results[2].text, 'Output from m3')
})

test('runMoAPipeline: full flow of parallel proposers + aggregator synthesis', async () => {
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
      // Aggregator call
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
  })

  assert.equal(res.aggregator, 'anthropic:claude-3-7-sonnet')
  assert.equal(res.content, 'Synthesized final verdict from Claude')
  assert.equal(res.references.length, 2)
  assert.equal(res.references[0].text, 'Candidate response from gpt-4o')
  assert.equal(res.references[1].text, 'Candidate response from deepseek-v3')
  assert.ok(res.usage.totalTokens > 0)
})

test('runMoAPipeline: fast mode with 1 candidate bypasses aggregator', async () => {
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
  })

  assert.equal(aggregatorCalled, false, 'Aggregator is bypassed in fast mode')
  assert.equal(res.isFastMode, true)
  assert.ok(res.promotedFiles.includes('index.html'))
})

test('runMoAPipeline: aggregator failure falls back to joined candidates', async () => {
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
  })

  assert.ok(res.content.includes('Aggregator error: 503 Service Unavailable'))
  assert.ok(res.content.includes('Fallback candidate outputs'))
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

  // Verify headers & cost
  assert.ok(output.includes('Mixture of Agents (Пресет: default | Судья: codex:gpt-5.6-sol)'))
  assert.ok(output.includes('Стоимость запуска') && output.includes('$0.0240') && output.includes('12.4k'))
  assert.ok(output.includes('Ответы моделей-советников (2):'))

  // Verify candidates
  assert.ok(output.includes('Модель 1: opencode-go:deepseek-v4-flash'))
  assert.ok(output.includes('Candidate 1 code'))
  assert.ok(output.includes('Модель 2: grok:grok-build-0.1'))
  assert.ok(output.includes('Candidate 2 code'))

  // Verify aggregator synthesis
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
  assert.ok(!output.includes('50 lines of code')) // Code should be summarized, not dumped
})

test('MoaRunnerAdapter: streams progress delta and completes with synthesis', async () => {
  const getMoaContext = () => ({
    targetPreset: {
      name: 'test-preset',
      reference_models: [{ provider: 'p1', model: 'm1' }],
      aggregator: { provider: 'p2', model: 'm2' },
    },
    userPrompt: 'write hello world',
    messages: [],
    callLlm: async () => 'hello world result',
  })

  const adapter = new MoaRunnerAdapter(getMoaContext)
  const chunks = []

  for await (const chunk of adapter.stream({ messages: [{ role: 'user', content: '/moa write hello world' }] })) {
    chunks.push(chunk)
  }

  // 1. First chunk should be block-start
  assert.equal(chunks[0].type, 'block-start')

  // 2. Second chunk should be immediate progress text-delta
  assert.equal(chunks[1].type, 'text-delta')
  assert.ok(chunks[1].text.includes('Mixture of Agents запущен'))

  // 3. Middle chunk should contain full formatted synthesis
  const synthDelta = chunks.findLast(c => c.type === 'text-delta')
  assert.ok(synthDelta)
  assert.ok(synthDelta.text.includes('hello world result'))

  // 4. Final chunks should be block-end, usage, and finish stop
  const finishChunk = chunks.find(c => c.type === 'finish')
  assert.ok(finishChunk)
  assert.equal(finishChunk.reason.kind, 'stop')
})

test('MoaRunnerAdapter: listModels conforms to DSH adapter metadata contract', async () => {
  const adapter = new MoaRunnerAdapter(() => ({}))
  const models = await adapter.listModels('moa-runner')
  assert.equal(Array.isArray(models), true)
  assert.equal(models.length, 1)
  assert.equal(models[0].provider, 'moa-runner')
  assert.equal(models[0].id, 'ensemble')
  assert.equal(typeof models[0].name, 'string')
})
