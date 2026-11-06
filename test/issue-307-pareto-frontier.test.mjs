import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getParetoProfile,
  calculateParetoEnsemble,
  applyParetoAdjustment,
} from '../lib/pipeline/pareto-frontier.js'
import { MOA_EVENTS } from '../lib/events.js'

test('getParetoProfile: maps slider positions across 4 frontier tiers', () => {
  assert.equal(getParetoProfile(0).name, 'local_free')
  assert.equal(getParetoProfile(25).name, 'local_free')
  assert.equal(getParetoProfile(40).name, 'economic')
  assert.equal(getParetoProfile(65).name, 'balanced')
  assert.equal(getParetoProfile(90).name, 'ultra_rigorous')
  assert.equal(getParetoProfile(100).name, 'ultra_rigorous')
})

test('calculateParetoEnsemble: estimates cost and latency along the frontier', () => {
  const freeRes = calculateParetoEnsemble(10)
  assert.equal(freeRes.tier, 'local_free')
  assert.equal(freeRes.estimatedCostUsd, 0.0)
  assert.ok(freeRes.estimatedLatencySec <= 5)
  assert.equal(freeRes.recommendedReferences.length, 2)

  const ultraRes = calculateParetoEnsemble(95)
  assert.equal(ultraRes.tier, 'ultra_rigorous')
  assert.ok(ultraRes.estimatedCostUsd > 0.02)
  assert.ok(ultraRes.estimatedLatencySec >= 15)
  assert.equal(ultraRes.multiJudgeEnabled, true)
})

test('applyParetoAdjustment: applies recommendations to preset and emits PARETO_ADJUSTED', () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const preset = {
    name: 'custom-preset',
    pareto_slider_enabled: true,
    pareto_slider_position: 15,
    reference_models: [{ provider: 'expensive', model: 'expensive-proposer' }],
    aggregator: { provider: 'expensive', model: 'expensive-aggregator' },
  }

  const adjusted = applyParetoAdjustment(preset, {
    ctx: mockCtx,
    runId: 'pareto-run-1',
  })

  assert.equal(adjusted.reference_models[0].provider, 'ollama')
  assert.equal(adjusted.aggregator.provider, 'ollama')

  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].ev, MOA_EVENTS.PARETO_ADJUSTED)
  assert.equal(emitted[0].p.tier, 'local_free')
  assert.equal(emitted[0].p.position, 15)
})
