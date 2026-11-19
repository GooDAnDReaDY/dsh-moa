import test from 'node:test'
import assert from 'node:assert/strict'
import { TASKS } from '../scripts/ablation/tasks.mjs'
import { IMPLS } from '../scripts/ablation/canonical-impls.mjs'
import { runHarness } from '../scripts/ablation/harness.mjs'

/**
 * Objective validator guards for the ablation task set (#367).
 *
 * A validator is only meaningful when it discriminates in BOTH directions:
 * a canonical correct implementation must pass, and an empty implementation
 * must fail. These tests run both directions for every task on every run, so
 * harness drift (too strict, too weak) fails npm test instead of silently
 * skewing a future ablation measurement.
 */

test('#367: every ablation task has a unique id and a non-empty harness', () => {
  const ids = TASKS.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length, 'task ids must be unique')
  for (const t of TASKS) {
    assert.ok(t.harness.includes("from './impl.js'"), `${t.id} harness must import the candidate impl.js`)
    assert.ok(t.prompt.length > 50, `${t.id} prompt must be a real specification`)
  }
})

test('#367: canonical correct implementations pass every validator', () => {
  for (const t of TASKS) {
    const impl = IMPLS[t.id]
    assert.ok(impl, `${t.id} must have a canonical implementation`)
    const r = runHarness(t, impl)
    assert.equal(
      r.passed, true,
      `${t.id}: canonical implementation must pass its own harness (${r.testsPassed}/${r.testsTotal})\n${r.output}`,
    )
  }
})

test('#367: every validator rejects an empty implementation', () => {
  for (const t of TASKS) {
    const r = runHarness(t, '')
    assert.equal(r.passed, false, `${t.id}: empty impl.js must not pass the harness (substring validators are forbidden)`)
  }
})
