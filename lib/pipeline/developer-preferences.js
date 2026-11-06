/**
 * Self-Learning Developer Preferences Metaprompt (#309)
 *
 * Tracks developer coding principles, architectural standards, and preferred idioms
 * in a persistent local store (~/.dsh/moa/preferences.json).
 * Injects a concise "Developer Coding Principles" directive into the Judge
 * synthesis phase (and candidate prompts) to bias consensus toward the engineer's tastes.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export const DEFAULT_PREFERENCES = Object.freeze([
  {
    id: 'strict-typing',
    title: 'Strict Types & Explicit Contracts',
    rule: "Never use loose 'any' types or unchecked type casts. Explicitly define interfaces, return types, and input validation schemas.",
    category: 'typing',
    enabled: true,
  },
  {
    id: 'functional-purity',
    title: 'Functional Immutability',
    rule: 'Prefer pure functions, immutable data transforms, and explicit return values over hidden global state mutations.',
    category: 'architecture',
    enabled: true,
  },
  {
    id: 'defensive-errors',
    title: 'Defensive Error Handling',
    rule: 'Never swallow exceptions silently. Use structured error types, descriptive messages, and clean fallback strategies.',
    category: 'reliability',
    enabled: true,
  },
])

/**
 * Resolves the persistent preferences file path.
 *
 * @param {string} [customPath]
 * @returns {string}
 */
export function getPreferencesFilePath(customPath = null) {
  if (customPath && typeof customPath === 'string' && customPath.trim()) {
    return path.resolve(customPath.trim())
  }
  return path.join(os.homedir(), '.dsh', 'moa', 'preferences.json')
}

/**
 * Loads developer preferences from disk with default fallback.
 *
 * @param {string} [customPath]
 * @returns {Array<object>}
 */
export function loadDeveloperPreferences(customPath = null) {
  const filePath = getPreferencesFilePath(customPath)
  if (!fs.existsSync(filePath)) {
    // Seed default preferences file
    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_PREFERENCES, null, 2), 'utf8')
    } catch {
      // safe fallback if filesystem is read-only
    }
    return [...DEFAULT_PREFERENCES]
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((p) => p && typeof p === 'object' && p.id && p.rule)
    }
  } catch {
    // safe fallback
  }

  return [...DEFAULT_PREFERENCES]
}

/**
 * Atomically saves developer preferences to disk.
 *
 * @param {Array<object>} preferences
 * @param {string} [customPath]
 * @returns {boolean}
 */
export function saveDeveloperPreferences(preferences, customPath = null) {
  if (!Array.isArray(preferences)) return false
  const filePath = getPreferencesFilePath(customPath)

  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const tmp = `${filePath}.tmp.${Date.now()}`
    fs.writeFileSync(tmp, JSON.stringify(preferences, null, 2), 'utf8')
    fs.renameSync(tmp, filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Adds a new developer preference rule.
 *
 * @param {object} item - { title, rule, category, enabled }
 * @param {string} [customPath]
 * @returns {object|null}
 */
export function addDeveloperPreference(item = {}, customPath = null) {
  if (!item || !item.rule || typeof item.rule !== 'string') return null
  const current = loadDeveloperPreferences(customPath)

  const id = item.id || `pref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const newPref = {
    id,
    title: (item.title && String(item.title).trim()) || 'Custom Coding Standard',
    rule: String(item.rule).trim(),
    category: (item.category && String(item.category).trim()) || 'general',
    enabled: item.enabled !== false,
    createdAt: new Date().toISOString(),
  }

  current.push(newPref)
  saveDeveloperPreferences(current, customPath)
  return newPref
}

/**
 * Updates an existing developer preference.
 *
 * @param {string} id
 * @param {object} updates
 * @param {string} [customPath]
 * @returns {object|null}
 */
export function updateDeveloperPreference(id, updates = {}, customPath = null) {
  if (!id) return null
  const current = loadDeveloperPreferences(customPath)
  const idx = current.findIndex((p) => p.id === id)
  if (idx === -1) return null

  const target = current[idx]
  if (typeof updates.title === 'string') target.title = updates.title.trim()
  if (typeof updates.rule === 'string') target.rule = updates.rule.trim()
  if (typeof updates.category === 'string') target.category = updates.category.trim()
  if (typeof updates.enabled === 'boolean') target.enabled = updates.enabled

  saveDeveloperPreferences(current, customPath)
  return target
}

/**
 * Deletes a developer preference by ID.
 *
 * @param {string} id
 * @param {string} [customPath]
 * @returns {boolean}
 */
export function deleteDeveloperPreference(id, customPath = null) {
  if (!id) return false
  const current = loadDeveloperPreferences(customPath)
  const filtered = current.filter((p) => p.id !== id)
  if (filtered.length === current.length) return false

  return saveDeveloperPreferences(filtered, customPath)
}

/**
 * Formats active developer preferences into an injected prompt directive.
 *
 * @param {Array<object>} [preferences] - Array of preferences (loads from disk if omitted)
 * @param {object} [options]
 * @param {boolean} [options.enabled=true]
 * @returns {string|null}
 */
export function formatPreferencesDirective(preferences = null, options = {}) {
  const { enabled = true, customPath = null } = options
  if (!enabled) return null

  const list = Array.isArray(preferences) ? preferences : loadDeveloperPreferences(customPath)
  const active = list.filter((p) => p && p.enabled !== false && p.rule)

  if (active.length === 0) return null

  const lines = active.map((p) => `- [${p.title}]: ${p.rule}`)

  return `### Developer Coding Principles & Preferred Conventions
The developer has established the following coding standards for this project:
${lines.join('\n')}
Evaluate all proposals against these principles and favor implementations adhering to them.`
}
