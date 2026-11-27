import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateTaskComplexity, resolveAutoProfile } from '../lib/moa-router.js'
import { Config } from '../lib/moa-schema.js'

const presets = () => Config({}).presets

test('#389: estimateTaskComplexity is deterministic and bounded', () => {
  const p1 = estimateTaskComplexity('build a small calculator app')
  const p2 = estimateTaskComplexity('build a small calculator app')
  assert.deepEqual(p1, p2, 'same input -> same score')
  assert.ok(p1.score >= 0 && p1.score <= 1)
  assert.ok(Array.isArray(p1.signals))
})

test('#389: brevity scores toward fast', () => {
  const r = estimateTaskComplexity('fix the typo in readme')
  assert.ok(r.score < 0.35, `score ${r.score} must map to fast`)
  assert.equal(resolveAutoProfile(r, presets()).name, 'fast')
})

test('#389: multi-file hard markers score toward deep', () => {
  const r = estimateTaskComplexity(
    'Refactor the architecture: port the parser to the new distributed pipeline. ' +
    'Update @src/a.ts, @src/b.ts and @lib/c/d/parser.js, then rewrite the tests.',
  )
  assert.ok(r.score > 0.7, `score ${r.score} must map to deep`)
  assert.equal(resolveAutoProfile(r, presets()).name, 'deep')
})

test('#389: medium spec scores toward balanced', () => {
  const r = estimateTaskComplexity(
    'Add an export button to the dashboard page and wire it to the API, ' +
    'include tests for the new handler and update component styles. ' +
    'The feature idea covers options in @src/ui/dashboard.js and file= export.css',
  )
  assert.ok(r.score >= 0.35 && r.score <= 0.7, `score ${r.score} must map to balanced`)
  assert.equal(resolveAutoProfile(r, presets()).name, 'balanced')
})

test('#389: threshold table maps the full range', () => {
  const cases = [
    [0.0, 'fast'], [0.2, 'fast'], [0.34, 'fast'],
    [0.35, 'balanced'], [0.5, 'balanced'], [0.7, 'balanced'],
    [0.71, 'deep'], [0.9, 'deep'], [1.0, 'deep'],
  ]
  for (const [score, expected] of cases) {
    assert.equal(resolveAutoProfile({ score, signals: [] }, presets()).name, expected, `score ${score}`)
  }
})

test('#389: fallback keeps auto preset object when profiles are absent', () => {
  const autoPreset = { name: 'auto', reference_models: [] }
  assert.equal(resolveAutoProfile({ score: 0.9, signals: [] }, [], autoPreset), autoPreset)
})

test('#389: auto ships as a preset and targets exist alongside it', () => {
  const names = presets().map((p) => p.name)
  assert.ok(names.includes('auto'), 'auto must be a selectable shipped preset')
  for (const t of ['fast', 'balanced', 'deep']) assert.ok(names.includes(t), `escalation target ${t} must exist`)
  assert.equal(new Set(names).size, names.length, 'preset names unique')
})

test('#389: escalation respects explicit presets (router contract unchanged)', async () => {
  const { resolvePresetForPrompt } = await import('../lib/moa-router.js')
  const cfg = Config({})
  // Explicit non-auto request is untouched by the auto layer (router returns the preset)
  const routed = await resolvePresetForPrompt({
    prompt: 'quick brief summary',
    presets: cfg.presets,
    defaultPreset: 'default',
    enabled: true,
  })
  assert.equal(routed.isAutoRouted, true)
  assert.equal(routed.presetName, 'fast')
})
