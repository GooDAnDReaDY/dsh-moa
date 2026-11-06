import test from 'node:test'
import assert from 'node:assert/strict'
import { runMoAPipeline } from '../lib/pipeline/runner.js'
import { MOA_EVENTS } from '../lib/events.js'

test('runMoAPipeline: triggers Pareto Frontier adjustment on start', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const calledModels = []
  const mockCallLlm = async (opts) => {
    calledModels.push(opts.model)
    return 'function solve() { return 42; }'
  }

  const result = await runMoAPipeline({
    userPrompt: 'Write a solver',
    preset: {
      name: 'pareto-pipeline-test',
      pareto_slider_enabled: true,
      pareto_slider_position: 10, // Local Free tier
      ask_clarifying_questions: false,
      curator_synthesis: true,
      reference_models: [{ provider: 'expensive', model: 'expensive-proposer' }],
      aggregator: { provider: 'expensive', model: 'expensive-judge' },
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    cwd: process.cwd(),
  })

  assert.ok(result)
  const paretoEvents = emitted.filter((e) => e.ev === MOA_EVENTS.PARETO_ADJUSTED)
  assert.equal(paretoEvents.length, 1)
  assert.equal(paretoEvents[0].p.tier, 'local_free')

  // Proposer called should have been mapped to local qwen2.5-coder:7b
  assert.ok(calledModels.includes('qwen2.5-coder:7b'))
})

test('runMoAPipeline: triggers Hard Budget Guard auto-downgrade when projected cost exceeds limit', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const prices = {
    'expensive:cloud-model': { prompt_per_million: 100, completion_per_million: 200 },
  }

  const calledModels = []
  const mockCallLlm = async (opts) => {
    calledModels.push(opts.model)
    return 'function solve() { return 42; }'
  }

  const result = await runMoAPipeline({
    userPrompt: 'Write a solver',
    preset: {
      name: 'budget-pipeline-test',
      hard_budget_guard_enabled: true,
      hard_budget_limit_usd: 0.005,
      hard_budget_policy: 'auto_downgrade',
      ask_clarifying_questions: false,
      curator_synthesis: true,
      reference_models: [
        { provider: 'expensive', model: 'cloud-model', role_persona: 'proposer' },
      ],
      aggregator: { provider: 'expensive', model: 'cloud-model' },
    },
    prices,
    callLlm: mockCallLlm,
    ctx: mockCtx,
    cwd: process.cwd(),
  })

  assert.ok(result)
  const budgetEvents = emitted.filter((e) => e.ev === MOA_EVENTS.BUDGET_SCALED)
  assert.equal(budgetEvents.length, 1)
  assert.equal(budgetEvents[0].p.policy, 'auto_downgrade')
  assert.ok(calledModels.includes('qwen2.5-coder:7b'))
})
