import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  slotLabel,
  cleanAdvisoryMessages,
  buildSynthesisPrompt,
  parseMoACommand,
  runReferencesParallel,
  runMoAPipeline,
  formatMoAResponse,
} from '../lib/moa-runner.js'

test('slotLabel: formats provider and model slots', () => {
  assert.equal(slotLabel({ provider: 'anthropic', model: 'claude-3-7' }), 'anthropic:claude-3-7')
  assert.equal(slotLabel({ provider: 'deepseek', model: 'deepseek-v3' }), 'deepseek:deepseek-v3')
  assert.equal(slotLabel({ model: 'gpt-4o' }), 'gpt-4o')
  assert.equal(slotLabel(null), 'unknown')
  assert.equal(slotLabel({}), 'unknown')
})

test('cleanAdvisoryMessages: filters non-text, tool and system messages', () => {
  const input = [
    { role: 'system', content: 'You are an agent with bash tools.' },
    { role: 'user', content: 'Hello, solve this task' },
    { role: 'assistant', content: 'I will check the files' },
    { role: 'tool', content: 'file contents dump 12345' },
    { role: 'assistant', content: [{ type: 'text', text: 'Files checked' }] },
  ]

  const cleaned = cleanAdvisoryMessages(input)
  assert.equal(cleaned.length, 3)
  assert.equal(cleaned[0].role, 'user')
  assert.equal(cleaned[0].content, 'Hello, solve this task')
  assert.equal(cleaned[1].role, 'assistant')
  assert.equal(cleaned[1].content, 'I will check the files')
  assert.equal(cleaned[2].role, 'assistant')
  assert.equal(cleaned[2].content, 'Files checked')
})

test('cleanAdvisoryMessages: caps large messages to budget', () => {
  const hugeText = 'A'.repeat(5000)
  const cleaned = cleanAdvisoryMessages([{ role: 'user', content: hugeText }], 1000)
  assert.equal(cleaned.length, 1)
  assert.ok(cleaned[0].content.includes('... [trimmed'))
  assert.ok(cleaned[0].content.length < 5000)
})

test('buildSynthesisPrompt: contains user prompt and labeled reference blocks', () => {
  const userPrompt = 'How to optimize SQL query?'
  const refs = [
    { label: 'openai:gpt-4o', text: 'Add an index on column X' },
    { label: 'anthropic:claude', text: 'Partition the table by date' },
  ]

  const prompt = buildSynthesisPrompt(userPrompt, refs)
  assert.ok(prompt.includes(userPrompt))
  assert.ok(prompt.includes('Reference 1 — openai:gpt-4o:'))
  assert.ok(prompt.includes('Add an index on column X'))
  assert.ok(prompt.includes('Reference 2 — anthropic:claude:'))
  assert.ok(prompt.includes('Partition the table by date'))
  assert.ok(prompt.includes('Вердикт судьи'))
  assert.ok(prompt.includes('Чей вариант выбран'))
})

test('parseMoACommand: parses bare /moa, default prompt and preset selection', () => {
  const presets = [{ name: 'default' }, { name: 'code-review' }]

  assert.equal(parseMoACommand('regular message', presets), null)

  const bare = parseMoACommand('/moa', presets)
  assert.equal(bare.presetName, 'default')
  assert.equal(bare.prompt, '')

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
})

test('runMoAPipeline: aggregator failure falls back to joined candidates', async () => {
  const preset = {
    name: 'fallback-test',
    reference_models: [{ provider: 'p1', model: 'm1' }],
    aggregator: { provider: 'agg-p', model: 'failing-agg' },
  }

  const mockCallLlm = async (params) => {
    if (params.model === 'failing-agg') {
      throw new Error('503 Service Unavailable')
    }
    return 'Proposal 1 text'
  }

  const res = await runMoAPipeline({
    userPrompt: 'Test fallback',
    preset,
    callLlm: mockCallLlm,
  })

  assert.ok(res.content.includes('Aggregator error: 503 Service Unavailable'))
  assert.ok(res.content.includes('Fallback candidate outputs'))
  assert.ok(res.content.includes('Proposal 1 text'))
})

test('formatMoAResponse: formats candidate outputs and judge synthesis cleanly', () => {
  const moaResult = {
    content: 'Final synthesized calculator code in HTML',
    aggregator: 'codex:gpt-5.6-sol',
    presetName: 'default',
    references: [
      { label: 'opencode-go:deepseek-v4-flash', text: 'Candidate 1 code', ok: true },
      { label: 'grok:grok-build-0.1', text: 'Candidate 2 code', ok: true },
    ],
  }

  const output = formatMoAResponse({ moaResult, presetName: 'default' })

  // Verify headers
  assert.ok(output.includes('Mixture of Agents (Пресет: default | Судья: codex:gpt-5.6-sol)'))
  assert.ok(output.includes('Ответы моделей-советников (2):'))

  // Verify candidate 1 and 2
  assert.ok(output.includes('Модель 1: opencode-go:deepseek-v4-flash'))
  assert.ok(output.includes('Candidate 1 code'))
  assert.ok(output.includes('Модель 2: grok:grok-build-0.1'))
  assert.ok(output.includes('Candidate 2 code'))

  // Verify aggregator synthesis
  assert.ok(output.includes('Вердикт судьи и итоговое решение (Синтез: codex:gpt-5.6-sol)'))
  assert.ok(output.includes('Final synthesized calculator code in HTML'))
})
