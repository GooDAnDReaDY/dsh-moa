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

// Multi-file set (#388): real-history tasks with multi-file candidates.
// Canonical implementations live as REAL files under scripts/ablation/canonical/
// <taskId>/ (no template-literal escaping maze).
import { TASKS_MULTIFILE } from '../scripts/ablation/tasks-multifile.mjs'
import { runHarness as runHarnessShared } from '../scripts/ablation/harness.mjs'
import fsSync from 'node:fs'
import pathSync from 'node:path'
import { fileURLToPath as fURL } from 'node:url'

const CANONICAL_DIR = pathSync.join(pathSync.dirname(fURL(import.meta.url)), '..', 'scripts', 'ablation', 'canonical')

function readCanonicalFiles(taskId) {
  const base = pathSync.join(CANONICAL_DIR, taskId)
  const out = []
  const walk = (dir) => {
    for (const entry of fsSync.readdirSync(dir, { withFileTypes: true })) {
      const full = pathSync.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push({ relativePath: pathSync.relative(base, full).split(pathSync.sep).join('/'), content: fsSync.readFileSync(full, 'utf8') })
    }
  }
  walk(base)
  return out
}

test('#388: every multi-file task has context files, a harness, and real origin', () => {
  const ids = TASKS_MULTIFILE.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length, 'multi-file task ids unique')
  assert.ok(TASKS_MULTIFILE.length >= 8, `expected 8+ multi-file tasks, got ${TASKS_MULTIFILE.length}`)
  for (const t of TASKS_MULTIFILE) {
    assert.ok(t.origin && /issue #\d+/.test(t.origin), `${t.id} must declare a real issue origin`)
    assert.ok(Object.keys(t.contextFiles || {}).length >= 1, `${t.id} must provide repro context files`)
    assert.ok(t.harness.includes('import'), `${t.id} harness must import fixed files`)
    assert.ok(fsSync.existsSync(pathSync.join(CANONICAL_DIR, t.id)), `${t.id} must have a canonical implementation directory`)
  }
})

test('#388: canonical multi-file implementations pass every validator', () => {
  for (const t of TASKS_MULTIFILE) {
    const impl = readCanonicalFiles(t.id)
    assert.ok(impl.length >= 1, `${t.id} canonical dir must contain files`)
    const r = runHarnessShared(t, impl)
    assert.equal(r.passed, true, `${t.id}: canonical implementation must pass (${r.testsPassed}/${r.testsTotal})\n${r.output}`)
  }
})

test('#388: missing candidate files fail the harness (multi-file negative)', () => {
  for (const t of TASKS_MULTIFILE) {
    const r = runHarnessShared(t, [])
    assert.equal(r.passed, false, `${t.id}: no submitted files must fail the harness`)
  }
})
