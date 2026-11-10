/**
 * Dynamic Preset Model Validation via ctx.llm Provider Registry (#283)
 * Inspects active providers and models, detects dead/unregistered slots,
 * and produces diagnostic reports for logging and UI surfacing.
 */

import { logger } from './logger.js'
import { bestEffort } from './best-effort.js'

/**
 * Discovers currently registered / active LLM providers in ctx.
 * Queries ctx.llm.listProviders(), ctx.llm.listConfigurableProviders(),
 * and active provider maps.
 *
 * @param {object} ctx
 * @returns {Promise<Set<string>>}
 */
export async function getActiveLlmProviders(ctx) {
  const providers = new Set()
  if (!ctx || !ctx.llm) return providers

  // 1. ctx.llm.listProviders()
  if (typeof ctx.llm.listProviders === 'function') {
    const list = await bestEffort('llm listProviders', () => ctx.llm.listProviders())
    if (Array.isArray(list)) {
      for (const p of list) {
        const id = typeof p === 'string' ? p : (p?.id || p?.provider)
        if (id) providers.add(String(id).toLowerCase())
      }
    }
  }

  // 2. ctx.llm.listConfigurableProviders()
  if (typeof ctx.llm.listConfigurableProviders === 'function') {
    const list = bestEffort('llm listConfigurableProviders', () => ctx.llm.listConfigurableProviders())
    if (Array.isArray(list)) {
      for (const p of list) {
        const id = typeof p === 'string' ? p : (p?.id || p?.provider)
        if (id) providers.add(String(id).toLowerCase())
      }
    }
  }

  // 3. Fallback to ctx.llm.providers object or map
  if (ctx.llm.providers) {
    if (typeof ctx.llm.providers.keys === 'function') {
      for (const k of ctx.llm.providers.keys()) providers.add(String(k).toLowerCase())
    } else if (typeof ctx.llm.providers === 'object') {
      for (const k of Object.keys(ctx.llm.providers)) providers.add(String(k).toLowerCase())
    }
  }

  return providers
}

/**
 * Discovers registered models per provider if available.
 *
 * @param {object} ctx
 * @param {Set<string>} [providers]
 * @returns {Promise<Map<string, Set<string>>>} Map of provider -> Set of model IDs
 */
export async function getActiveLlmModels(ctx, providers) {
  const modelMap = new Map()
  if (!ctx || !ctx.llm) return modelMap

  const targetProviders = providers || await getActiveLlmProviders(ctx)

  // 1. ctx.llm.listAvailableModels()
  if (typeof ctx.llm.listAvailableModels === 'function') {
    const all = await bestEffort('llm listAvailableModels', () => ctx.llm.listAvailableModels())
    if (Array.isArray(all)) {
      for (const item of all) {
        const p = String(item?.provider || '').toLowerCase()
        const m = String(item?.id || item?.model || '').toLowerCase()
        if (p && m) {
          if (!modelMap.has(p)) modelMap.set(p, new Set())
          modelMap.get(p).add(m)
        }
      }
    }
  }

  // 2. Query each provider with ctx.llm.listModels(p)
  if (typeof ctx.llm.listModels === 'function') {
    for (const p of targetProviders) {
      const mList = await bestEffort('llm listModels ' + p, () =>
        Promise.race([
          ctx.llm.listModels(p),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
        ])
      )
      if (Array.isArray(mList)) {
        if (!modelMap.has(p)) modelMap.set(p, new Set())
        for (const m of mList) {
          const mId = typeof m === 'string' ? m : (m?.id || m?.model || m?.name)
          if (mId) modelMap.get(p).add(String(mId).toLowerCase())
        }
      }
    }
  }

  return modelMap
}

/**
 * Validates a single slot against active providers and models.
 */
export function validateSlot(slot, role, activeProviders, modelMap) {
  if (!slot) return { valid: false, role, reason: 'empty_slot' }
  const provider = String(slot.provider || '').toLowerCase().trim()
  const model = String(slot.model || '').toLowerCase().trim()
  const label = `${slot.provider || 'unknown'}:${slot.model || 'unknown'}`

  if (!provider) {
    return { valid: false, role, provider: slot.provider, model: slot.model, label, reason: 'missing_provider' }
  }

  // If we have active providers discovered and provider is not in the list
  if (activeProviders && activeProviders.size > 0 && !activeProviders.has(provider)) {
    return { valid: false, role, provider: slot.provider, model: slot.model, label, reason: 'provider_not_found' }
  }

  // If we have models list for this provider, check if model exists
  if (modelMap && modelMap.has(provider)) {
    const models = modelMap.get(provider)
    if (models && models.size > 0 && !models.has(model)) {
      return { valid: false, role, provider: slot.provider, model: slot.model, label, reason: 'model_not_found' }
    }
  }

  return { valid: true, role, provider: slot.provider, model: slot.model, label }
}

/**
 * Validates a preset's reference models, aggregator, and fallbacks.
 *
 * @param {object} preset
 * @param {object} [options]
 * @returns {object}
 */
export function validatePreset(preset, { activeProviders, modelMap } = {}) {
  if (!preset || typeof preset !== 'object') {
    return {
      valid: false,
      presetName: 'unknown',
      deadModels: [{ role: 'preset', reason: 'invalid_preset_object' }],
      warnings: ['Preset is not a valid object'],
    }
  }

  const presetName = preset.name || preset.id || 'unnamed'
  const deadModels = []
  const warnings = []

  // Check aggregator
  const aggSlot = preset.aggregator_model || preset.aggregator
  if (aggSlot) {
    const res = validateSlot(aggSlot, 'aggregator', activeProviders, modelMap)
    if (!res.valid) {
      deadModels.push(res)
      warnings.push(`Aggregator model ${res.label} has unreachable provider or model (${res.reason})`)
    }
  }

  // Check reference models
  const refs = Array.isArray(preset.references)
    ? preset.references
    : (Array.isArray(preset.reference_models) ? preset.reference_models : [])

  if (refs.length === 0) {
    warnings.push('Preset has no reference models configured')
  }

  for (let idx = 0; idx < refs.length; idx++) {
    const slot = refs[idx]
    const res = validateSlot(slot, `reference_${idx + 1}`, activeProviders, modelMap)
    if (!res.valid) {
      deadModels.push(res)
      warnings.push(`Reference candidate ${res.label} has unreachable provider or model (${res.reason})`)
    }

    // Check slot fallbacks if any
    if (Array.isArray(slot?.fallbacks)) {
      for (const fb of slot.fallbacks) {
        const fbRes = validateSlot(fb, `fallback_for_${res.label}`, activeProviders, modelMap)
        if (!fbRes.valid) {
          deadModels.push(fbRes)
          warnings.push(`Reserve fallback ${fbRes.label} for ${res.label} is unreachable (${fbRes.reason})`)
        }
      }
    }
  }

  return {
    presetId: preset.id || presetName,
    presetName,
    valid: deadModels.length === 0,
    hasDeadModels: deadModels.length > 0,
    deadModels,
    warnings,
    totalSlotsChecked: (aggSlot ? 1 : 0) + refs.length,
  }
}

/**
 * Validates an array of presets and logs warnings if any dead models exist.
 *
 * @param {Array<object>} presets
 * @param {object} ctx
 * @returns {Promise<object>}
 */
export async function validateAllPresets(presets, ctx) {
  const activeProviders = await getActiveLlmProviders(ctx)
  const modelMap = await getActiveLlmModels(ctx, activeProviders)

  const presetResults = []
  let totalDeadModels = 0

  for (const preset of (presets || [])) {
    const result = validatePreset(preset, { activeProviders, modelMap })
    presetResults.push(result)
    if (result.hasDeadModels) {
      totalDeadModels += result.deadModels.length
      const deadLabels = result.deadModels.map((m) => `${m.label} (${m.reason})`).join(', ')
      logger.warn(`[dsh-moa] Preset "${result.presetName}" contains ${result.deadModels.length} dead/unregistered models: ${deadLabels}`)
    }
  }

  return {
    valid: totalDeadModels === 0,
    activeProviders: Array.from(activeProviders),
    totalDeadModels,
    presets: presetResults,
    validatedAt: Date.now(),
  }
}