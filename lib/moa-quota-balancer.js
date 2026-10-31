/**
 * Quota-Aware Provider Balancing (#253)
 * Queries provider/model rate limits and quota health via dsh-key-limits and dsh-subscriptions.
 * Dynamically substitutes exhausted or low-quota reference slots with healthy fallback models
 * to protect the final aggregator quota and prevent 429 pipeline aborts.
 */

import { service } from './services.js'
import { logger } from './logger.js'
import { slotLabel } from './moa-prompts.js'

const DEFAULT_FALLBACK_POOL = [
  { provider: 'deepseek', model: 'deepseek-reasoner' },
  { provider: 'deepseek', model: 'deepseek-chat' },
  { provider: 'qwen', model: 'qwen-2.5-coder-32b-instruct' },
  { provider: 'openrouter', model: 'deepseek/deepseek-r1' },
  { provider: 'ollama', model: 'qwen2.5-coder:32b' },
]

/**
 * Inspects quota status for a given { provider, model } slot via dsh-key-limits or dsh-subscriptions.
 *
 * @param {object} ctx - Cordis context
 * @param {{ provider: string, model: string }} slot
 * @param {object} [options]
 * @returns {Promise<{ exhausted: boolean, remainingRatio: number, reason: string | null }>}
 */
export async function checkSlotQuotaStatus(ctx, slot, options = {}) {
  const provider = String(slot?.provider || '').trim()
  const model = String(slot?.model || '').trim()
  if (!provider) return { exhausted: false, remainingRatio: 1, reason: null }

  const minRemainingRatio = Number.isFinite(options.minRemainingRatio) ? options.minRemainingRatio : 0.1

  const keyLimits = options.keyLimitsService || service(ctx, 'keyLimits')
  if (keyLimits) {
    try {
      let status = null
      if (typeof keyLimits.getQuotaStatus === 'function') {
        status = await keyLimits.getQuotaStatus(provider, model)
      } else if (typeof keyLimits.checkLimit === 'function') {
        status = await keyLimits.checkLimit(provider, model)
      } else if (typeof keyLimits.getProviderStatus === 'function') {
        status = await keyLimits.getProviderStatus(provider)
      }

      if (status) {
        if (status.exhausted === true || status.rateLimited === true || status.blocked === true) {
          return {
            exhausted: true,
            remainingRatio: 0,
            reason: status.reason || 'Quota exhausted or rate-limited in dsh-key-limits',
          }
        }
        const rem = Number(status.remaining ?? status.remainingRequests ?? status.remainingTokens)
        const lim = Number(status.limit ?? status.maxRequests ?? status.maxTokens)
        if (Number.isFinite(rem) && Number.isFinite(lim) && lim > 0) {
          const ratio = rem / lim
          if (ratio < minRemainingRatio) {
            return {
              exhausted: true,
              remainingRatio: ratio,
              reason: `Low quota remaining (${Math.round(ratio * 100)}%) in dsh-key-limits`,
            }
          }
          return { exhausted: false, remainingRatio: ratio, reason: null }
        }
        if (Number.isFinite(status.remainingRatio)) {
          if (status.remainingRatio < minRemainingRatio) {
            return {
              exhausted: true,
              remainingRatio: status.remainingRatio,
              reason: `Low quota ratio (${Math.round(status.remainingRatio * 100)}%) in dsh-key-limits`,
            }
          }
          return { exhausted: false, remainingRatio: status.remainingRatio, reason: null }
        }
      }
    } catch (err) {
      logger.warn(`[dsh-moa:quota] Error querying dsh-key-limits for ${provider}:${model}:`, err?.message || err)
    }
  }

  const subscriptions = options.subscriptionsService || service(ctx, 'subscriptions')
  if (subscriptions) {
    try {
      let subStatus = null
      if (typeof subscriptions.getSubscriptionStatus === 'function') {
        subStatus = await subscriptions.getSubscriptionStatus(provider, model)
      } else if (typeof subscriptions.checkQuota === 'function') {
        subStatus = await subscriptions.checkQuota(provider, model)
      }

      if (subStatus) {
        if (subStatus.exhausted === true || subStatus.active === false || subStatus.expired === true) {
          return {
            exhausted: true,
            remainingRatio: 0,
            reason: subStatus.reason || 'Subscription quota exhausted or inactive in dsh-subscriptions',
          }
        }
        if (Number.isFinite(subStatus.remainingRatio) && subStatus.remainingRatio < minRemainingRatio) {
          return {
            exhausted: true,
            remainingRatio: subStatus.remainingRatio,
            reason: `Low subscription quota (${Math.round(subStatus.remainingRatio * 100)}%) in dsh-subscriptions`,
          }
        }
      }
    } catch (err) {
      logger.warn(`[dsh-moa:quota] Error querying dsh-subscriptions for ${provider}:${model}:`, err?.message || err)
    }
  }

  return { exhausted: false, remainingRatio: 1, reason: null }
}

/**
 * Balances candidate reference slots before Layer 1 execution.
 * Preserves quota for the aggregator by substituting low-quota/exhausted slots
 * with healthy fallback models.
 *
 * @param {Array<{ provider: string, model: string }>} references
 * @param {object} options
 * @returns {Promise<{ balancedReferences: Array<{ provider: string, model: string }>, substitutions: Array<object> }>}
 */
export async function balanceCandidateQuotas(references = [], options = {}) {
  if (!Array.isArray(references) || references.length === 0) {
    return { balancedReferences: [], substitutions: [] }
  }

  const ctx = options.ctx || null
  const aggregator = options.aggregator || null
  const customFallbacks = Array.isArray(options.fallbackPool) && options.fallbackPool.length > 0
    ? options.fallbackPool
    : DEFAULT_FALLBACK_POOL

  const usedKeys = new Set(references.map((r) => slotLabel(r)))
  const balancedReferences = []
  const substitutions = []

  for (let i = 0; i < references.length; i++) {
    const slot = references[i]
    const label = slotLabel(slot)

    // Reserve higher threshold (25%) if this candidate uses the exact same provider:model as the final aggregator
    const isSameAsAggregator = aggregator && slotLabel(aggregator) === label
    const minRemainingRatio = isSameAsAggregator ? 0.25 : (options.minRemainingRatio ?? 0.1)

    const status = await checkSlotQuotaStatus(ctx, slot, {
      ...options,
      minRemainingRatio,
    })

    if (!status.exhausted) {
      balancedReferences.push(slot)
      continue
    }

    // Find a healthy replacement from customFallbacks
    let replacement = null
    for (const candidateFallback of customFallbacks) {
      const fbLabel = slotLabel(candidateFallback)
      if (fbLabel === label) continue
      const fbStatus = await checkSlotQuotaStatus(ctx, candidateFallback, options)
      if (!fbStatus.exhausted) {
        replacement = { ...slot, provider: candidateFallback.provider, model: candidateFallback.model, replacedFrom: label }
        usedKeys.add(fbLabel)
        break
      }
    }

    if (replacement) {
      balancedReferences.push(replacement)
      substitutions.push({
        index: i + 1,
        original: slot,
        replacement: { provider: replacement.provider, model: replacement.model },
        reason: status.reason,
      })
      logger.info(`[dsh-moa:quota] Replaced slot #${i + 1} (${label}) -> ${slotLabel(replacement)} (${status.reason})`)
    } else {
      balancedReferences.push(slot)
    }
  }

  return { balancedReferences, substitutions }
}
