import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estimateTokens,
  runSpeculativeVerification,
  createSpeculativeCallLlm,
} from '../lib/pipeline/speculative-verifier.js'
import { MOA_EVENTS } from '../lib/events.js'

test('estimateTokens: returns approx 4 chars per token', () => {
  assert.equal(estimateTokens('1234'), 1)
  assert.equal(estimateTokens('12345678'), 2)
  assert.equal(estimateTokens(''), 0)
})

test('runSpeculativeVerification: two-phase speculative execution produces verified code with speedup', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const calls = []
  const mockCallLlm = async (opts) => {
    calls.push(opts)
    if (opts.provider === 'ollama') {
      return 'function draftFast() { return 42; }'
    }
    // Cloud Verifier
    const promptText = (opts.messages || []).map((m) => m.content).join('\n')
    assert.ok(promptText.includes('draftFast'))
    return 'function verifiedOptimal() { return 42; } // validated by cloud'
  }

  const progress = []
  const res = await runSpeculativeVerification({
    prompt: 'Implement optimal function',
    draftSlot: { provider: 'ollama', model: 'qwen2.5-coder:7b' },
    targetSlot: { provider: 'cloud', model: 'claude-3-5-sonnet' },
    callLlm: mockCallLlm,
    options: {
      ctx: mockCtx,
      runId: 'spec-run-1',
      blockSize: 128,
      onProgress: (m) => progress.push(m),
    },
  })

  assert.equal(calls.length, 2)
  assert.equal(res.draftUsed, true)
  assert.equal(res.output, 'function verifiedOptimal() { return 42; } // validated by cloud')
  assert.ok(res.effectiveTokensPerSec > 0)
  assert.ok(res.speedupFactor >= 1.0)

  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].ev, MOA_EVENTS.SPECULATIVE_DRAFT)
  assert.equal(emitted[0].p.draftModel, 'ollama:qwen2.5-coder:7b')
  assert.equal(emitted[0].p.verifierModel, 'cloud:claude-3-5-sonnet')
})

test('runSpeculativeVerification: falls back gracefully to target generation if draft model fails', async () => {
  const mockCallLlm = async (opts) => {
    if (opts.provider === 'ollama') {
      throw new Error('Ollama service unreachable')
    }
    return 'function fallbackResult() { return 100; }'
  }

  const res = await runSpeculativeVerification({
    prompt: 'Fallback test',
    draftSlot: { provider: 'ollama', model: 'qwen2.5-coder:7b' },
    targetSlot: { provider: 'cloud', model: 'claude-3-5-sonnet' },
    callLlm: mockCallLlm,
    options: {
      blockSize: 128,
    },
  })

  assert.equal(res.draftUsed, false)
  assert.equal(res.output, 'function fallbackResult() { return 100; }')
  assert.equal(res.speedupFactor, 1.0)
})

test('createSpeculativeCallLlm: wraps callLlm and avoids recursion for draft slot', async () => {
  const calls = []
  const mockCallLlm = async (opts) => {
    calls.push(opts.model)
    if (opts.model === 'qwen-draft') {
      return 'draft code'
    }
    return 'cloud verified code'
  }

  const wrapped = createSpeculativeCallLlm(mockCallLlm, {
    draftSlot: { provider: 'ollama', model: 'qwen-draft' },
    blockSize: 128,
  })

  // 1. Direct call to draft model itself: must NOT trigger speculative recursion
  const draftOnly = await wrapped({ provider: 'ollama', model: 'qwen-draft', messages: [{ role: 'user', content: 'test' }] })
  assert.equal(draftOnly, 'draft code')
  assert.equal(calls.length, 1)

  // 2. Call to target cloud model: triggers draft + verifier
  const cloudRes = await wrapped({ provider: 'cloud', model: 'claude-target', messages: [{ role: 'user', content: 'test' }] })
  assert.equal(cloudRes, 'cloud verified code')
  assert.equal(calls.length, 3) // 1 previous + 1 draft + 1 verifier
})
