import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateHardBudgetLimit } from '../lib/pipeline/budget-guard.js'
import { MOA_EVENTS } from '../lib/events.js'

test('evaluateHardBudgetLimit: passes unmodified when anticipated cost is under limit', () => {
  const references = [
    { provider: 'ollama', model: 'qwen2.5-coder:7b' },
    { provider: 'ollama', model: 'deepseek-r1:8b' },
  ]
  const aggregator = { provider: 'ollama', model: 'qwen2.5-coder:7b' }

  const res = evaluateHardBudgetLimit({
    references,
    aggregator,
    limitUsd: 0.05,
    policy: 'auto_downgrade',
  })

  assert.equal(res.ok, true)
  assert.equal(res.scaled, false)
  assert.equal(res.projectedCostUsd, 0.0)
  assert.equal(res.references.length, 2)
})

test('evaluateHardBudgetLimit: scales down expensive models under auto_downgrade policy and emits BUDGET_SCALED', () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  // Set prices where cloud model costs $0.05 per call
  const prices = {
    'expensive:cloud-model': { input: 10, output: 20 },
  }

  const references = [
    { provider: 'expensive', model: 'cloud-model', role_persona: 'proposer' },
    { provider: 'expensive', model: 'cloud-model', role_persona: 'challenger' },
  ]
  const aggregator = { provider: 'expensive', model: 'cloud-model' }

  const res = evaluateHardBudgetLimit({
    references,
    aggregator,
    limitUsd: 0.01, // Limit is much lower than projected cost
    policy: 'auto_downgrade',
    prices,
    options: {
      ctx: mockCtx,
      runId: 'budget-run-1',
    },
  })

  assert.equal(res.ok, true)
  assert.equal(res.scaled, true)
  assert.ok(res.projectedCostUsd <= 0.01)

  // References must have been downgraded to local
  assert.equal(res.references[0].provider, 'ollama')

  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].ev, MOA_EVENTS.BUDGET_SCALED)
  assert.equal(emitted[0].p.policy, 'auto_downgrade')
  assert.equal(emitted[0].p.limitUsd, 0.01)
})

test('evaluateHardBudgetLimit: fails closed when cost exceeds limit under fail_closed policy', () => {
  const prices = {
    'expensive:cloud-model': { prompt_per_million: 100, completion_per_million: 200 },
  }

  const references = [{ provider: 'expensive', model: 'cloud-model' }]
  const aggregator = { provider: 'expensive', model: 'cloud-model' }

  const res = evaluateHardBudgetLimit({
    references,
    aggregator,
    limitUsd: 0.001,
    policy: 'fail_closed',
    prices,
  })

  assert.equal(res.ok, false)
  assert.equal(res.scaled, false)
  assert.ok(res.error.includes('exceeds hard limit'))
})
