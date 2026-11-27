import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Config } from '../lib/moa-schema.js'

function shippedPresets() {
  const parsed = Config({})
  return new Map((parsed.presets || []).map((p) => [p.name, p]))
}

/**
 * Quality profiles (#368) - composition is fixed by the cycle-2 ablation
 * measurement (docs/benchmarks/RESULTS.md, DeepSeek V3, 12 tasks):
 * peer critique REGRESSED pass-rate (91.7% vs 100% baseline, critic broke a
 * correct csv-line-parse solution), so it is OFF in balanced/deep by default;
 * gates directives were harmless (pass-rate unchanged) but cost ~160%
 * tokens, so only the valuable security gate ships in deep.
 */
test('#368: fast profile = single candidate + judge, no critique, no gates', () => {
  const fast = shippedPresets().get('fast')
  assert.ok(fast, 'fast profile must ship')
  assert.equal(fast.reference_models.length, 1, 'fast = single candidate (baseline tie at 100%)')
  assert.equal(fast.ask_clarifying_questions, false)
  assert.equal(fast.peer_critique_enabled, false)
  assert.equal(fast.security_gate_enabled, false)
})

test('#368: balanced profile = 2 candidates + judge, peer critique OFF by measurement', () => {
  const balanced = shippedPresets().get('balanced')
  assert.ok(balanced, 'balanced profile must ship')
  assert.equal(balanced.reference_models.length, 2)
  assert.equal(balanced.peer_critique_enabled, false, 'critique regressed pass-rate to 91.7% in the ablation')
  assert.equal(balanced.context_pruning_enabled, true)
  assert.equal(balanced.max_tokens, 4096)
})

test('#368: deep profile = 3 candidates + security gate, critique opt-in', () => {
  const deep = shippedPresets().get('deep')
  assert.ok(deep, 'deep profile must ship')
  assert.equal(deep.reference_models.length, 3)
  assert.equal(deep.peer_critique_enabled, false, 'critique stays opt-in (measured regression)')
  assert.equal(deep.security_gate_enabled, true, 'gate directives measured harmless and security check is valuable')
  assert.equal(deep.max_tokens, 8192)
})

test('#368: profiles are selectable - names registered in the shipped preset list', () => {
  const names = [...shippedPresets().keys()]
  for (const p of ['fast', 'balanced', 'deep']) {
    assert.ok(names.includes(p), `profile "${p}" must be a selectable shipped preset`)
  }
  assert.equal(names.length, 14, "fourteen presets ship by default")
})

test('#368: README documents the measured profiles', () => {
  for (const file of ['../README.md', '../README.ru.md', '../README.zh.md']) {
    const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
    assert.match(text, /`balanced`/, `${file} must document the balanced profile`)
    assert.match(text, /`deep`/, `${file} must document the deep profile`)
  }
})
