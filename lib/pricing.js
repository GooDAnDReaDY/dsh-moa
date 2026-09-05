// lib/pricing.js
// Dynamic pricing registry for @goodandready/dsh-moa.
//
// Fetches real-time model rates from the public OpenRouter catalog
// (https://openrouter.ai/api/v1/models, no auth required), caches rates in
// ~/.dsh/storages/dsh-moa-catalog.json, and supports direct vendor tariffs
// and user config overrides in settings.yaml.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const CATALOG_URL = 'https://openrouter.ai/api/v1/models'
export const CACHE_FILE = join(homedir(), '.dsh', 'storages', 'dsh-moa-catalog.json')
export const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Direct vendor tariffs (USD per 1M tokens) for official direct routes.
 */
export const DIRECT_VENDOR_RATES = {
  'deepseek-chat': { input: 0.14, output: 0.28, cacheHit: 0.014 },
  'deepseek-reasoner': { input: 0.55, output: 2.19, cacheHit: 0.14 },
  'deepseek-v4-flash': { input: 0.14, output: 0.28, cacheHit: 0.014 },
  'deepseek-v4-pro': { input: 0.55, output: 2.19, cacheHit: 0.044 },
}

/** Default fallback rate for uncataloged models ($0.50 prompt / $1.50 completion per 1M tokens) */
export const FALLBACK_RATES = { input: 0.50, output: 1.50, cacheHit: 0.15 }

let memoryCatalog = null
let lastFetchedAt = 0

/**
 * Load cached catalog from disk into memory.
 */
export function loadCachedCatalog(cachePath = CACHE_FILE) {
  if (memoryCatalog) return memoryCatalog
  try {
    if (existsSync(cachePath)) {
      const raw = readFileSync(cachePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.models === 'object') {
        memoryCatalog = parsed.models
        lastFetchedAt = parsed.updatedAt || 0
        return memoryCatalog
      }
    }
  } catch {
    // Ignore read/parse errors
  }
  memoryCatalog = {}
  return memoryCatalog
}

/**
 * Fetch and update catalog from OpenRouter public API.
 */
export async function fetchCatalog({
  url = CATALOG_URL,
  cachePath = CACHE_FILE,
  signal = AbortSignal.timeout(5000),
} = {}) {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return loadCachedCatalog(cachePath)
    const json = await res.json()
    if (!json || !Array.isArray(json.data)) return loadCachedCatalog(cachePath)

    const models = {}
    for (const item of json.data) {
      if (!item.id || !item.pricing) continue
      const promptPer1M = Number(item.pricing.prompt || 0) * 1e6
      const completionPer1M = Number(item.pricing.completion || 0) * 1e6
      const cacheHitPer1M = Number(item.pricing.input_cache_hit || item.pricing.prompt || 0) * 1e6

      models[item.id] = {
        input: promptPer1M,
        output: completionPer1M,
        cacheHit: cacheHitPer1M,
        contextLength: item.context_length || 0,
        name: item.name || item.id,
      }
    }

    memoryCatalog = models
    lastFetchedAt = Date.now()

    try {
      mkdirSync(dirname(cachePath), { recursive: true })
      writeFileSync(
        cachePath,
        JSON.stringify({ updatedAt: lastFetchedAt, count: Object.keys(models).length, models }, null, 2),
        'utf8',
      )
    } catch {
      // Non-fatal if filesystem is read-only
    }

    return models
  } catch {
    return loadCachedCatalog(cachePath)
  }
}

/**
 * Background refresh catalog if stale (> 24 hours).
 */
export function refreshCatalogInBackground(cachePath = CACHE_FILE) {
  const catalog = loadCachedCatalog(cachePath)
  const isStale = !lastFetchedAt || Date.now() - lastFetchedAt > REFRESH_INTERVAL_MS
  if (isStale) {
    fetchCatalog({ cachePath }).catch(() => {})
  }
  return catalog
}

/**
 * Resolve price rates (USD per 1M tokens) for a given provider/model slot.
 */
export function resolveModelRates(slot = {}, customPrices = {}, cachePath = CACHE_FILE) {
  const provider = (slot?.provider || '').trim().toLowerCase()
  const model = (slot?.model || '').trim().toLowerCase()
  const fullKey = provider ? `${provider}/${model}` : model

  // 1. Check custom user overrides in config
  if (customPrices && typeof customPrices === 'object') {
    if (customPrices[fullKey]) return normalizeRates(customPrices[fullKey])
    if (customPrices[model]) return normalizeRates(customPrices[model])
    if (provider && customPrices[`${provider}/*`]) return normalizeRates(customPrices[`${provider}/*`])
    if (customPrices['*']) return normalizeRates(customPrices['*'])
  }

  // 2. Check direct vendor rates
  if (DIRECT_VENDOR_RATES[model]) {
    return { ...DIRECT_VENDOR_RATES[model] }
  }

  // 3. Check OpenRouter catalog
  const catalog = loadCachedCatalog(cachePath) || {}
  
  if (catalog[fullKey]) return { ...catalog[fullKey] }
  if (catalog[model]) return { ...catalog[model] }

  for (const [catId, catRate] of Object.entries(catalog)) {
    const catLower = catId.toLowerCase()
    if (catLower.endsWith(`/${model}`) || catLower === model) {
      return { ...catRate }
    }
  }

  for (const [catId, catRate] of Object.entries(catalog)) {
    const catLower = catId.toLowerCase()
    if (model && (catLower.includes(model) || model.includes(catLower))) {
      return { ...catRate }
    }
  }

  // 4. Fallback rate
  return { ...FALLBACK_RATES }
}

function normalizeRates(rate) {
  if (!rate || typeof rate !== 'object') return { ...FALLBACK_RATES }
  return {
    input: Number(rate.input ?? rate.prompt ?? FALLBACK_RATES.input),
    output: Number(rate.output ?? rate.completion ?? FALLBACK_RATES.output),
    cacheHit: Number(rate.cacheHit ?? rate.cache_hit ?? FALLBACK_RATES.cacheHit),
  }
}

/**
 * Estimate USD cost and token totals for a single model call.
 */
export function estimateTokenCost(slot = {}, usage = {}, customPrices = {}, cachePath = CACHE_FILE) {
  const promptTokens = usage.prompt_tokens ?? usage.inputTokens ?? usage.input ?? usage.promptTokens ?? 0
  const completionTokens = usage.completion_tokens ?? usage.outputTokens ?? usage.output ?? usage.completionTokens ?? 0
  const cacheHitTokens = usage.prompt_tokens_details?.cached_tokens ?? usage.cacheHitTokens ?? 0
  const totalTokens = promptTokens + completionTokens

  const rates = resolveModelRates(slot, customPrices, cachePath)

  const nonCachedPrompt = Math.max(0, promptTokens - cacheHitTokens)
  const inputCost = (nonCachedPrompt / 1e6) * rates.input + (cacheHitTokens / 1e6) * rates.cacheHit
  const outputCost = (completionTokens / 1e6) * rates.output
  const totalCost = inputCost + outputCost

  return {
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    totalTokens,
    costUsd: Number(totalCost.toFixed(5)),
    rates,
  }
}
