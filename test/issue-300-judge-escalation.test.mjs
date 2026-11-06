import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateDisagreementMetric,
  evaluateJudgeEscalation,
} from '../lib/pipeline/escalation.js'

test('calculateDisagreementMetric: returns 0.0 for identical candidates', () => {
  const candidates = [
    { text: 'export function hello() { return "world" }' },
    { text: 'export function hello() { return "world" }' },
  ]
  const metric = calculateDisagreementMetric(candidates)
  assert.equal(metric, 0.0)
})

test('calculateDisagreementMetric: returns high divergence (> 0.50) for completely distinct texts', () => {
  const candidates = [
    { text: 'function calculateTax(subtotal) { return subtotal * 0.2; }' },
    { text: '<html><body><nav><h1>Dashboard</h1><ul><li>Users</li></ul></nav></body></html>' },
  ]
  const metric = calculateDisagreementMetric(candidates)
  assert.ok(metric > 0.50, `Expected metric > 0.50, got ${metric}`)
})

test('calculateDisagreementMetric: returns 0.0 for empty or single candidate', () => {
  assert.equal(calculateDisagreementMetric([]), 0.0)
  assert.equal(calculateDisagreementMetric([{ text: 'lone candidate' }]), 0.0)
})

test('evaluateJudgeEscalation: policy single never escalates', () => {
  const candidates = [
    { text: 'console.log("apple")' },
    { text: 'console.log("banana orange peach pineapple strawberry")' },
  ]
  const primary = { provider: 'ollama', model: 'llama3:8b' }
  const res = evaluateJudgeEscalation({
    candidateOutputs: candidates,
    primaryJudge: primary,
    policy: 'single',
    threshold: 0.2,
  })
  assert.equal(res.escalated, false)
  assert.equal(res.escalatedType, 'none')
  assert.deepEqual(res.judge, primary)
})

test('evaluateJudgeEscalation: policy auto_upgrade upgrades to escalationJudge when disagreement >= threshold', () => {
  const candidates = [
    { text: 'const a = 12345;' },
    { text: 'const b = "abcdefghijklmnopqrstuvwxyz"; function foo() {}' },
  ]
  const primary = { provider: 'fast', model: 'fast-judge' }
  const senior = { provider: 'flagship', model: 'deepseek-reasoner' }

  const res = evaluateJudgeEscalation({
    candidateOutputs: candidates,
    primaryJudge: primary,
    escalationJudge: senior,
    policy: 'auto_upgrade',
    threshold: 0.30,
  })

  assert.equal(res.escalated, true)
  assert.equal(res.escalatedType, 'auto_upgrade')
  assert.deepEqual(res.judge, senior)
  assert.deepEqual(res.originalJudge, primary)
  assert.ok(res.disagreement >= 0.30)
})

test('evaluateJudgeEscalation: policy auto_upgrade falls back to first fallbackJudge if escalationJudge missing', () => {
  const candidates = [
    { text: 'const x = 1;' },
    { text: 'class Y { doSomethingElseEntirelyDifferent() {} }' },
  ]
  const primary = { provider: 'fast', model: 'fast-judge' }
  const fb1 = { provider: 'backup', model: 'backup-judge-1' }

  const res = evaluateJudgeEscalation({
    candidateOutputs: candidates,
    primaryJudge: primary,
    fallbackJudges: [fb1],
    escalationJudge: null,
    policy: 'auto_upgrade',
    threshold: 0.30,
  })

  assert.equal(res.escalated, true)
  assert.equal(res.escalatedType, 'auto_upgrade')
  assert.deepEqual(res.judge, fb1)
})

test('evaluateJudgeEscalation: policy auto_upgrade does not escalate if disagreement < threshold', () => {
  const candidates = [
    { text: 'function test() { return true }' },
    { text: 'function test() { return true }' },
  ]
  const primary = { provider: 'fast', model: 'fast-judge' }
  const senior = { provider: 'flagship', model: 'deepseek-reasoner' }

  const res = evaluateJudgeEscalation({
    candidateOutputs: candidates,
    primaryJudge: primary,
    escalationJudge: senior,
    policy: 'auto_upgrade',
    threshold: 0.40,
  })

  assert.equal(res.escalated, false)
  assert.equal(res.escalatedType, 'none')
  assert.deepEqual(res.judge, primary)
})

test('evaluateJudgeEscalation: policy council_majority assembles panel when disagreement >= threshold', () => {
  const candidates = [
    { text: 'select * from users where id = 1;' },
    { text: 'mutation CreateUser { insert_users { id } }' },
  ]
  const primary = { provider: 'p1', model: 'judge-1' }
  const fb1 = { provider: 'p2', model: 'judge-2' }
  const fb2 = { provider: 'p3', model: 'judge-3' }

  const res = evaluateJudgeEscalation({
    candidateOutputs: candidates,
    primaryJudge: primary,
    fallbackJudges: [fb1, fb2],
    policy: 'council_majority',
    threshold: 0.30,
  })

  assert.equal(res.escalated, true)
  assert.equal(res.escalatedType, 'council_majority')
  assert.equal(res.councilJudges.length, 3)
  assert.deepEqual(res.councilJudges[0], primary)
  assert.deepEqual(res.councilJudges[1], fb1)
  assert.deepEqual(res.councilJudges[2], fb2)
})
