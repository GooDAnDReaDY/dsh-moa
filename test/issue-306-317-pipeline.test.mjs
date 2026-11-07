import test from 'node:test'
import assert from 'node:assert/strict'
import { runMoAPipeline } from '../lib/pipeline/runner.js'
import { MOA_EVENTS } from '../lib/events.js'

test('runMoAPipeline: sanitizes private paths and keys before Cloud Judge when hybrid_edge_privacy_enabled', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  let judgeReceivedPrompt = ''
  const mockCallLlm = async (opts) => {
    if (opts.model === 'm-local-edge') {
      return 'const dbPass = "sk-99887766554433221100"; const p = "/home/secretuser/data.csv";'
    }
    // Judge
    const promptStr = (opts.messages || []).map((m) => m.content).join('\n')
    judgeReceivedPrompt = promptStr
    return 'The winner is m-local-edge.'
  }

  const result = await runMoAPipeline({
    userPrompt: 'Generate database client',
    preset: {
      name: 'hybrid-privacy-test',
      hybrid_edge_privacy_enabled: true,
      cloud_judge_sanitization_enabled: true,
      ask_clarifying_questions: false,
      curator_synthesis: true,
      reference_models: [
        { provider: 'p1', model: 'm-local-edge', role_persona: 'proposer' },
      ],
      aggregator: { provider: 'cloud', model: 'judge-model' },
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    cwd: process.cwd(),
  })

  assert.ok(result)
  const privacyEvents = emitted.filter((e) => e.ev === MOA_EVENTS.PRIVACY_SANITIZED)
  assert.ok(privacyEvents.length >= 1)
  assert.ok(privacyEvents[0].p.redactionCount >= 2)

  // Cloud judge must NOT see real secret or home path
  assert.ok(!judgeReceivedPrompt.includes('sk-99887766554433221100'))
  assert.ok(!judgeReceivedPrompt.includes('/home/secretuser'))
  assert.ok(judgeReceivedPrompt.includes('[REDACTED_API_KEY]'))
  assert.ok(judgeReceivedPrompt.includes('/workspace/data.csv'))
  assert.ok(judgeReceivedPrompt.includes('PRIVACY & PII SANITIZATION ACTIVE'))
})

test('runMoAPipeline: triggers speculative draft acceleration when speculative_draft_enabled', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const calls = []
  const mockCallLlm = async (opts) => {
    calls.push(opts.model)
    if (opts.model === 'qwen-draft') {
      return 'function draftCalc() { return 10; }'
    }
    if (opts.model === 'cloud-candidate') {
      return 'function finalCalc() { return 10; }'
    }
    // Judge
    return 'Winner is candidate 1'
  }

  const result = await runMoAPipeline({
    userPrompt: 'Write a calculator function',
    preset: {
      name: 'speculative-test',
      speculative_draft_enabled: true,
      speculative_draft_model: { provider: 'ollama', model: 'qwen-draft' },
      speculative_block_size: 128,
      ask_clarifying_questions: false,
      curator_synthesis: true,
      reference_models: [
        { provider: 'cloud', model: 'cloud-candidate', role_persona: 'proposer' },
      ],
      aggregator: { provider: 'cloud', model: 'judge-model' },
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    cwd: process.cwd(),
  })

  assert.ok(result)
  const specEvents = emitted.filter((e) => e.ev === MOA_EVENTS.SPECULATIVE_DRAFT)
  assert.equal(specEvents.length, 1)
  assert.equal(specEvents[0].p.draftModel, 'ollama:qwen-draft')
  assert.equal(specEvents[0].p.verifierModel, 'cloud:cloud-candidate')
  assert.ok(specEvents[0].p.effectiveTokensPerSec > 0)
})
