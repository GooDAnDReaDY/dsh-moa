import { bestEffort } from '../best-effort.js'
import { emitEvent, MOA_EVENTS } from '../events.js'
/**
 * Semantic Caching for Intermediate Candidate Generations (#318)
 *
 * Persists and resolves candidate generations and similarity fingerprints locally
 * to eliminate duplicate API costs during iterative development, questionnaire retries,
 * or recurring benchmark runs.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// Runtime metrics tracking
let _runtimeHits = 0
let _runtimeMisses = 0
let _runtimeSavedTokens = 0
let _runtimeSavedCostUsd = 0

/**
 * Resets runtime cache hit/miss statistics (useful for tests).
 */
export function resetRuntimeCacheStats() {
  _runtimeHits = 0
  _runtimeMisses = 0
  _runtimeSavedTokens = 0
  _runtimeSavedCostUsd = 0
}

/**
 * Normalizes prompt text to eliminate trivial whitespace or capitalization variations.
 *
 * @param {string} prompt
 * @returns {string}
 */
export function normalizePrompt(prompt = '') {
  if (typeof prompt !== 'string') return ''
  return prompt
    .trim()
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/[ \t]+/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * Computes a deterministic SHA-256 fingerprint for a candidate generation request.
 *
 * @param {string} prompt
 * @param {object} [options]
 * @param {string} [options.model='']
 * @param {number} [options.temperature=0.6]
 * @param {string} [options.systemPrompt='']
 * @param {string} [options.contextHash='']
 * @returns {string}
 */
export function computePromptFingerprint(prompt = '', options = {}) {
  const {
    model = '',
    temperature = 0.6,
    systemPrompt = '',
    contextHash = '',
  } = options

  const normPrompt = normalizePrompt(prompt)
  const normSys = normalizePrompt(systemPrompt)
  const roundedTemp = Number(temperature || 0).toFixed(2)

  const payload = [
    normPrompt,
    String(model || '').trim().toLowerCase(),
    roundedTemp,
    normSys,
    String(contextHash || ''),
  ].join(':::')

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex')
}

/**
 * Resolves the cache directory, ensuring it is created safely.
 *
 * @param {string} cwd - Base workspace directory
 * @param {string} [customDir]
 * @returns {string}
 */
export function resolveCacheDir(cwd = process.cwd(), customDir = null) {
  const dir = customDir
    ? path.resolve(cwd, customDir)
    : path.resolve(cwd, '.moa', 'cache', 'semantic')
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  } catch (_err) {
    /* ignore directory creation errors */
  }
  return dir
}

/**
 * Retrieves a cached candidate generation entry.
 *
 * @param {string} key - SHA-256 cache fingerprint
 * @param {object} [options]
 * @param {string} [options.cacheDir]
 * @param {number} [options.maxAgeMs=604800000] - 7 days default TTL
 * @returns {object|null}
 */
export function getCacheEntry(key, options = {}) {
  if (!key || typeof key !== 'string') return null
  const { cacheDir, maxAgeMs = 7 * 24 * 60 * 60 * 1000 } = options
  const targetDir = resolveCacheDir(options.cwd, cacheDir)
  const filePath = path.join(targetDir, `${key}.json`)

  try {
    if (!fs.existsSync(filePath)) {
      _runtimeMisses++
      return null
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    const entry = JSON.parse(raw)
    const now = Date.now()

    if (entry.createdAt && (now - entry.createdAt > (entry.ttlMs || maxAgeMs))) {
      // Expired entry
      bestEffort('unlink expired cache entry', () => fs.unlinkSync(filePath))
      _runtimeMisses++
      return null
    }

    _runtimeHits++
    const tokens = entry.usage?.totalTokens || 0
    const cost = entry.costUsd || 0
    _runtimeSavedTokens += tokens
    _runtimeSavedCostUsd += cost

    // Update access metadata
    entry.lastAccessedAt = now
    entry.hitCount = (entry.hitCount || 0) + 1
    bestEffort('update cache access metadata', () => {
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8')
    })

    return entry
  } catch (_err) {
    _runtimeMisses++
    return null
  }
}

/**
 * Stores a candidate generation output into the semantic cache.
 *
 * @param {string} key - Cache fingerprint
 * @param {object} entryData - Candidate generation payload
 * @param {object} [options]
 * @param {string} [options.cacheDir]
 * @param {number} [options.ttlMs=604800000]
 * @returns {boolean}
 */
export function setCacheEntry(key, entryData = {}, options = {}) {
  if (!key || typeof key !== 'string') return false
  const { cacheDir, ttlMs = 7 * 24 * 60 * 60 * 1000 } = options
  const targetDir = resolveCacheDir(options.cwd, cacheDir)
  const filePath = path.join(targetDir, `${key}.json`)

  const payload = {
    key,
    model: entryData.model || '',
    output: entryData.output || entryData.text || '',
    usage: entryData.usage || { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
    costUsd: entryData.costUsd || 0,
    createdAt: Date.now(),
    ttlMs: entryData.ttlMs || ttlMs,
    hitCount: 0,
    metadata: entryData.metadata || {},
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return true
  } catch (_err) {
    return false
  }
}

/**
 * Clears expired or all entries from the semantic cache.
 *
 * @param {object} [options]
 * @param {string} [options.cacheDir]
 * @param {number} [options.olderThanMs]
 * @returns {{ clearedCount: number }}
 */
export function clearSemanticCache(options = {}) {
  const { cacheDir, olderThanMs = null } = options
  const targetDir = resolveCacheDir(options.cwd, cacheDir)
  let clearedCount = 0

  try {
    if (!fs.existsSync(targetDir)) return { clearedCount: 0 }
    const files = fs.readdirSync(targetDir)
    const now = Date.now()

    for (const f of files) {
      if (!f.endsWith('.json')) continue
      const filePath = path.join(targetDir, f)
      if (typeof olderThanMs === 'number' && olderThanMs > 0) {
        try {
          const raw = fs.readFileSync(filePath, 'utf8')
          const entry = JSON.parse(raw)
          if (now - (entry.createdAt || 0) < olderThanMs) {
            continue
          }
        } catch (_err) {
          /* corrupt file, proceed to unlink */
        }
      }
      bestEffort('unlink cleared cache entry', () => {
        fs.unlinkSync(filePath)
        clearedCount++
      })
    }
  } catch (_err) {
    /* ignore read/delete errors */
  }

  return { clearedCount }
}

/**
 * Returns cache usage metrics and statistics.
 *
 * @param {object} [options]
 * @returns {object}
 */
export function getSemanticCacheStats(options = {}) {
  const { cacheDir } = options
  const targetDir = resolveCacheDir(options.cwd, cacheDir)
  let entriesCount = 0
  let totalSizeBytes = 0

  try {
    if (fs.existsSync(targetDir)) {
      const files = fs.readdirSync(targetDir)
      for (const f of files) {
        if (!f.endsWith('.json')) continue
        try {
          const stat = fs.statSync(path.join(targetDir, f))
          entriesCount++
          totalSizeBytes += stat.size
        } catch (_err) {
          /* file unlinked concurrently */
        }
      }
    }
  } catch (_err) {
    /* ignore dir access errors */
  }

  return {
    entriesCount,
    totalSizeBytes,
    hits: _runtimeHits,
    misses: _runtimeMisses,
    savedTokens: _runtimeSavedTokens,
    savedCostUsd: Number(_runtimeSavedCostUsd.toFixed(5)),
  }
}


/**
 * Wraps callLlm with local semantic caching for intermediate candidate generations (#318).
 *
 * @param {Function} callLlm - Raw LLM invocation function
 * @param {object} [options]
 * @param {boolean} [options.enabled=false]
 * @param {number} [options.ttlMs=604800000]
 * @param {string} [options.cwd]
 * @param {object} [options.ctx]
 * @returns {Function}
 */
export function createCachingCallLlm(callLlm, options = {}) {
  const { enabled = false, ttlMs = 7 * 24 * 60 * 60 * 1000, cwd, ctx } = options
  if (!enabled || typeof callLlm !== 'function') return callLlm

  return async function cachedCallLlm(callArgs) {
    if (!callArgs || typeof callArgs !== 'object') {
      return callLlm(callArgs)
    }

    const messages = Array.isArray(callArgs.messages) ? callArgs.messages : []
    const promptText = messages
      .filter((m) => m && m.role === 'user')
      .map((m) => m.content)
      .join('\n') || String(callArgs.prompt || '')
    const systemPrompt = messages
      .filter((m) => m && m.role === 'system')
      .map((m) => m.content)
      .join('\n') || ''

    const modelName = callArgs.model
      ? (callArgs.provider ? `${callArgs.provider}:${callArgs.model}` : callArgs.model)
      : ''

    const key = computePromptFingerprint(promptText, {
      model: modelName,
      temperature: callArgs.temperature ?? 0.6,
      systemPrompt,
    })

    const cached = getCacheEntry(key, { cwd, maxAgeMs: ttlMs })
    if (cached && typeof cached.output === 'string' && cached.output.length > 0) {
      emitEvent(ctx, MOA_EVENTS.CACHE_HIT, { key, model: modelName })
      return {
        text: cached.output,
        content: cached.output,
        usage: cached.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
        cached: true,
      }
    }

    const res = await callLlm(callArgs)
    const text = typeof res === 'string' ? res : (res?.content || res?.text || '')
    if (text) {
      const usage = (typeof res === 'object' && res?.usage) ? res.usage : {
        inputTokens: Math.max(1, Math.round((promptText.length + systemPrompt.length) / 4)),
        outputTokens: Math.max(1, Math.round(text.length / 4)),
        totalTokens: Math.max(2, Math.round((promptText.length + systemPrompt.length + text.length) / 4)),
      }
      const costUsd = typeof res === 'object' && typeof res?.costUsd === 'number' ? res.costUsd : 0
      setCacheEntry(key, {
        model: modelName,
        output: text,
        usage,
        costUsd,
        ttlMs,
      }, { cwd, ttlMs })
    }

    return res
  }
}
