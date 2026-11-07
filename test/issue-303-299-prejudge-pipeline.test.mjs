import test from 'node:test'
import assert from 'node:assert/strict'
import { runMoAPipeline } from '../lib/pipeline/runner.js'

test('pipeline: zero-token local syntax gate flags syntax errors and passes valid candidates', async () => {
  const mockCallLlm = async (model, messages) => {
    const modelStr = typeof model === 'string' ? model : `${model?.provider}:${model?.model}`
    // Proposers
    if (modelStr.includes('model-proposer')) {
      return {
        text: '```javascript\nfunction add(a, b) { return a + b; }\n```',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        costUsd: 0.0001,
      }
    }
    if (modelStr.includes('model-broken')) {
      return {
        text: '```javascript\nfunction broken(a, b { return a +;\n```',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        costUsd: 0.0001,
      }
    }
    // Judge
    return {
      text: 'Candidate 1 is the winner.\n[FINAL_OUTPUT]\nfunction add(a, b) { return a + b; }\n[/FINAL_OUTPUT]',
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      costUsd: 0.0005,
    }
  }

  const events = []
  const mockCtx = {
    emit: (name, payload) => events.push({ name, payload }),
  }

  const res = await runMoAPipeline({
    userPrompt: 'Write add function in JavaScript',
    messages: [],
    preset: {
      name: 'test-syntax-gate',
      reference_models: [
        { provider: 'prov', model: 'model-proposer' },
        { provider: 'prov', model: 'model-broken' },
      ],
      aggregator: { provider: 'prov', model: 'judge' },
      local_preflight_check: true,
      early_exit_consensus_enabled: false,
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    prices: {},
    cwd: process.cwd(),
  })

  assert.equal(res.kind, 'synthesis')
  assert.ok(events.some((e) => e.name === 'moa/syntax-validation'))
  const syntaxEvent = events.find((e) => e.name === 'moa/syntax-validation')
  assert.equal(syntaxEvent.payload.validCount, 1)
  assert.equal(syntaxEvent.payload.invalidCount, 1)
})

test('pipeline: early exit upon semantic consensus bypasses judge and saves tokens', async () => {
  let judgeCalled = false
  const mockCallLlm = async (model, messages) => {
    if (model === 'prov:judge') {
      judgeCalled = true
      return { text: 'Judge result', usage: { totalTokens: 100 }, costUsd: 0.001 }
    }
    // Both proposers return equivalent code
    return {
      text: '```js\nfunction multiply(x, y) {\n  return x * y;\n}\n```',
      usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
      costUsd: 0.0001,
    }
  }

  const events = []
  const mockCtx = {
    emit: (name, payload) => events.push({ name, payload }),
  }

  const res = await runMoAPipeline({
    userPrompt: 'Write multiply function in JS',
    messages: [],
    preset: {
      name: 'test-early-consensus',
      reference_models: [
        { provider: 'prov', model: 'model-1' },
        { provider: 'prov', model: 'model-2' },
      ],
      aggregator: { provider: 'prov', model: 'judge' },
      local_preflight_check: true,
      early_exit_consensus_enabled: true,
      early_exit_threshold: 0.95,
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    prices: {},
    cwd: process.cwd(),
  })

  assert.equal(res.kind, 'synthesis')
  assert.equal(res.aggregator, 'Early Consensus (Bypassed)')
  assert.equal(res.isEarlyConsensus, true)
  assert.equal(judgeCalled, false, 'LLM Judge must NOT be called when early consensus is reached')
  assert.ok(res.usage.skippedJudgeTokens > 0)
  assert.ok(events.some((e) => e.name === 'moa/early-consensus'))
})

