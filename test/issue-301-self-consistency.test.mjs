import test from 'node:test'
import assert from 'node:assert/strict'
import {
  expandSelfConsistencySlots,
  calculateSelfConsistencyAgreement,
  DEFAULT_SELF_CONSISTENCY_TEMPERATURES,
  DEFAULT_SELF_CONSISTENCY_PERSONAS,
} from '../lib/pipeline/self-consistency.js'

test('expandSelfConsistencySlots: returns unmodified if not enabled', () => {
  const models = [{ provider: 'openai', model: 'gpt-4o' }]
  const res = expandSelfConsistencySlots(models, { enabled: false })
  assert.equal(res.isExpanded, false)
  assert.equal(res.sampleCount, 1)
  assert.deepEqual(res.references, models)
})

test('expandSelfConsistencySlots: does not expand if multiple slots already provided', () => {
  const models = [
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'anthropic', model: 'claude-3-5' },
  ]
  const res = expandSelfConsistencySlots(models, { enabled: true, samples: 3 })
  assert.equal(res.isExpanded, false)
  assert.equal(res.sampleCount, 2)
  assert.deepEqual(res.references, models)
})

test('expandSelfConsistencySlots: expands single model into N parallel temperature/persona slots', () => {
  const models = [{ provider: 'ollama', model: 'qwen2.5:7b' }]
  const res = expandSelfConsistencySlots(models, {
    enabled: true,
    samples: 3,
    temperatures: [0.2, 0.7, 1.0],
    personas: ['proposer', 'challenger', 'creative'],
  })

  assert.equal(res.isExpanded, true)
  assert.equal(res.sampleCount, 3)
  assert.equal(res.references.length, 3)

  assert.equal(res.references[0].temperature, 0.2)
  assert.equal(res.references[0].role_persona, 'proposer')
  assert.equal(res.references[0].sampleIndex, 1)
  assert.equal(res.references[0].isSelfConsistencySample, true)

  assert.equal(res.references[1].temperature, 0.7)
  assert.equal(res.references[1].role_persona, 'challenger')
  assert.equal(res.references[1].sampleIndex, 2)

  assert.equal(res.references[2].temperature, 1.0)
  assert.equal(res.references[2].role_persona, 'creative')
  assert.equal(res.references[2].sampleIndex, 3)
})

test('expandSelfConsistencySlots: clamps samples count between 2 and 10', () => {
  const models = [{ provider: 'ollama', model: 'qwen2.5:7b' }]
  const resMin = expandSelfConsistencySlots(models, { enabled: true, samples: 1 })
  assert.equal(resMin.sampleCount, 2)

  const resMax = expandSelfConsistencySlots(models, { enabled: true, samples: 99 })
  assert.equal(resMax.sampleCount, 10)
})

test('calculateSelfConsistencyAgreement: calculates agreement ratio and consensus flag', () => {
  const identical = [
    { text: 'function add(a, b) { return a + b }' },
    { text: 'function add(a, b) { return a + b }' },
    { text: 'function add(a, b) { return a + b }' },
  ]
  const res1 = calculateSelfConsistencyAgreement(identical)
  assert.equal(res1.agreementRatio, 1.0)
  assert.equal(res1.isStrongConsensus, true)

  const diverse = [
    { text: 'class Calculator { static add(a, b) { return a + b; } }' },
    { text: 'const sum = (x, y) => Number(x) + Number(y)' },
    { text: 'export default function plus(n1, n2) { return BigInt(n1) + BigInt(n2); }' },
  ]
  const res2 = calculateSelfConsistencyAgreement(diverse)
  assert.ok(res2.agreementRatio < 0.66)
  assert.equal(res2.isStrongConsensus, false)
})

test('calculateSelfConsistencyAgreement: handles single or empty outputs safely', () => {
  assert.deepEqual(calculateSelfConsistencyAgreement([]), {
    agreementRatio: 1.0,
    isStrongConsensus: true,
    sampleCount: 0,
  })
  assert.deepEqual(calculateSelfConsistencyAgreement([{ text: 'only one' }]), {
    agreementRatio: 1.0,
    isStrongConsensus: true,
    sampleCount: 1,
  })
})
