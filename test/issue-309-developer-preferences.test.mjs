import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  loadDeveloperPreferences,
  saveDeveloperPreferences,
  addDeveloperPreference,
  updateDeveloperPreference,
  deleteDeveloperPreference,
  formatPreferencesDirective,
} from '../lib/pipeline/developer-preferences.js'

test('loadDeveloperPreferences: seeds default preferences when file does not exist', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pref-seed-'))
  const prefFile = path.join(tmpDir, 'sub', 'preferences.json')
  try {
    const list = loadDeveloperPreferences(prefFile)
    assert.ok(Array.isArray(list))
    assert.ok(list.length >= 3)
    assert.ok(fs.existsSync(prefFile))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('addDeveloperPreference & updateDeveloperPreference: persists custom rules', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pref-crud-'))
  const prefFile = path.join(tmpDir, 'preferences.json')
  try {
    const newRule = addDeveloperPreference(
      {
        title: 'Prefer Drizzle ORM',
        rule: 'Always use Drizzle schema definitions and SQL template tags instead of raw string concatenation.',
        category: 'database',
      },
      prefFile
    )

    assert.ok(newRule)
    assert.equal(newRule.title, 'Prefer Drizzle ORM')
    assert.equal(newRule.enabled, true)

    // Verify persisted on disk
    const stored = loadDeveloperPreferences(prefFile)
    const found = stored.find((p) => p.id === newRule.id)
    assert.ok(found)

    // Update
    const updated = updateDeveloperPreference(newRule.id, { enabled: false }, prefFile)
    assert.equal(updated.enabled, false)

    const updatedStored = loadDeveloperPreferences(prefFile)
    const updatedFound = updatedStored.find((p) => p.id === newRule.id)
    assert.equal(updatedFound.enabled, false)

    // Delete
    const deleted = deleteDeveloperPreference(newRule.id, prefFile)
    assert.equal(deleted, true)

    const afterDelete = loadDeveloperPreferences(prefFile)
    assert.ok(!afterDelete.some((p) => p.id === newRule.id))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('formatPreferencesDirective: formats markdown list of active principles only', () => {
  const preferences = [
    { title: 'Rule A', rule: 'Do A always', enabled: true },
    { title: 'Rule B', rule: 'Disabled rule', enabled: false },
    { title: 'Rule C', rule: 'Do C strictly', enabled: true },
  ]

  const directive = formatPreferencesDirective(preferences, { enabled: true })
  assert.ok(directive.includes('Developer Coding Principles & Preferred Conventions'))
  assert.ok(directive.includes('- [Rule A]: Do A always'))
  assert.ok(directive.includes('- [Rule C]: Do C strictly'))
  assert.ok(!directive.includes('Disabled rule'))
})

test('formatPreferencesDirective: returns null when enabled is false or rules are empty', () => {
  assert.equal(formatPreferencesDirective([], { enabled: true }), null)
  assert.equal(formatPreferencesDirective([{ title: 'X', rule: 'Y', enabled: true }], { enabled: false }), null)
})
