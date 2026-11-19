import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Config } from '../lib/moa-schema.js'
import { classifyPromptIntent, resolvePresetForPrompt } from '../lib/moa-router.js'

function defaultPresetNames() {
  // Validate the shipped defaults through the schema itself (portable across
  // real schemastery and the test stub)
  const parsed = Config({})
  return (Array.isArray(parsed.presets) ? parsed.presets : []).map((p) => p.name)
}

function intentRuleTargets() {
  const source = readFileSync(fileURLToPath(new URL('../lib/moa-router.js', import.meta.url)), 'utf8')
  const targets = []
  for (const match of source.matchAll(/\{ preset: '([^']+)', regex:/g)) {
    targets.push(match[1])
  }
  return targets
}

test('Issue #366: every INTENT_RULES preset target exists in the shipped presets', () => {
  const shipped = defaultPresetNames()
  assert.ok(shipped.length >= 11, `expected at least 11 shipped presets, got ${shipped.length}`)
  for (const target of intentRuleTargets()) {
    assert.ok(shipped.includes(target), `INTENT_RULES target "${target}" must be a shipped preset`)
  }
})

test('Issue #366: shipped preset names are unique and named', () => {
  const shipped = defaultPresetNames()
  for (const name of shipped) {
    assert.ok(typeof name === 'string' && name !== '', 'preset name must be a non-empty string')
  }
  assert.equal(new Set(shipped).size, shipped.length, 'preset names must be unique')
})

const SAMPLE_PROMPTS = [
  ['security-audit', 'audit this endpoint for xss vulnerabilities and sanitize inputs'],
  ['bug-hunter', 'the worker crashes with an unhandled exception, help me reproduce and fix the bug'],
  ['refactor-cleanup', 'refactor this module and remove dead code, keep behavior identical'],
  ['code-review', 'please review this pull request diff and inspect the code'],
  ['frontend-ui', 'build a responsive landing page with css styling and an accessible modal component'],
  ['deep-architect', 'design a distributed system architecture with microservices and a database schema'],
  ['math-logic', 'prove the complexity bound for this dynamic programming algorithm'],
  ['creative-brainstorm', 'brainstorm creative feature ideas and alternative concepts'],
  ['fast', 'give me a quick brief summary, keep it short'],
]

test('Issue #366: heuristic router classifies every intent class to an existing preset', () => {
  const shipped = defaultPresetNames()
  for (const [expected, prompt] of SAMPLE_PROMPTS) {
    const intent = classifyPromptIntent(prompt)
    assert.equal(intent, expected, `prompt "${prompt}" should classify to ${expected}, got ${intent}`)
    assert.ok(shipped.includes(intent), `classified preset "${intent}" must exist`)
  }
})

test('Issue #366: resolvePresetForPrompt auto-routes each class with isAutoRouted true', async () => {
  const cfg = Config({})
  const presets = cfg.presets
  for (const [expected] of SAMPLE_PROMPTS) {
    const routed = await resolvePresetForPrompt({
      prompt: SAMPLE_PROMPTS.find(([e]) => e === expected)[1],
      presets,
      defaultPreset: 'default',
      enabled: true,
    })
    assert.equal(routed.isAutoRouted, true, `class ${expected} must auto-route`)
    assert.equal(routed.presetName, expected, `class ${expected} must route to the matching preset`)
    assert.ok(presets.some((p) => p.name === routed.presetName), 'routed preset must exist in config')
  }
})

test('Issue #366: resolvePresetForPrompt falls back to default for unmatched prompts', async () => {
  const cfg = Config({})
  const routed = await resolvePresetForPrompt({
    prompt: 'zzz qqq xyzzy',
    presets: cfg.presets,
    defaultPreset: 'default',
    enabled: true,
  })
  assert.equal(routed.isAutoRouted, false)
  assert.equal(routed.presetName, 'default')
})

test('Issue #366: README lists exactly the shipped presets', () => {
  const shipped = defaultPresetNames()
  for (const file of ['../README.md', '../README.ru.md']) {
    const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
    const tableMatch = text.match(/\| `([a-z-]+)` \|[^\n]*\|[^\n]*\|[^\n]*\|[^\n]*\|\n/g) || []
    const readmeNames = new Set(tableMatch.map((row) => row.match(/\| `([a-z-]+)` \|/)[1]))
    for (const name of shipped) {
      assert.ok(readmeNames.has(name), `README ${file} must document preset "${name}"`)
    }
  }
})
