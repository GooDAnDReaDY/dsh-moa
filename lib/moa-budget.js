/**
 * Cost Budget Guardrails & Auto-Trimming
 * Feature 6 (Cost Budget Guardrails)
 */

import { estimateTokenCost } from './pricing.js'

/**
 * Calculates conservative upfront cost estimate for a list of candidate slots.
 */
export function estimateCandidateRunCost(slots = [], prices = {}, promptTokens = 500, expectedOutputTokens = 2048) {
  let totalUsd = 0
  const slotEstimates = []

  for (const slot of slots) {
    const costInfo = estimateTokenCost(
      slot,
      { inputTokens: promptTokens, outputTokens: expectedOutputTokens },
      prices
    )
    const cost = costInfo?.costUsd || 0
    totalUsd += cost
    slotEstimates.push({ slot, costUsd: cost })
  }

  return {
    totalEstimatedUsd: Number(totalUsd.toFixed(6)),
    slotEstimates,
  }
}

/**
 * Applies budget guardrails before initiating parallel candidate execution.
 */
export function applyBudgetGuardrails({
  references = [],
  enabled = false,
  maxBudgetUsd = 0,
  action = 'trim', // 'trim' | 'abort'
  prices = {},
  promptLength = 1000,
}) {
  if (!enabled || typeof maxBudgetUsd !== 'number' || maxBudgetUsd <= 0 || references.length === 0) {
    return {
      allowed: true,
      references,
      action: 'none',
      estimatedCostUsd: 0,
    }
  }

  const promptTokens = Math.max(50, Math.round(promptLength / 4))
  const { totalEstimatedUsd, slotEstimates } = estimateCandidateRunCost(references, prices, promptTokens)

  if (totalEstimatedUsd <= maxBudgetUsd) {
    return {
      allowed: true,
      references,
      action: 'pass',
      estimatedCostUsd: totalEstimatedUsd,
    }
  }

  if (action === 'abort') {
    return {
      allowed: false,
      references: [],
      action: 'abort',
      estimatedCostUsd: totalEstimatedUsd,
      maxBudgetUsd,
      reason: `Estimated MoA run cost ($${totalEstimatedUsd.toFixed(4)}) exceeds configured max budget ($${maxBudgetUsd.toFixed(4)}).`,
    }
  }

  // Action is 'trim': Sort by estimated cost ascending (cheapest first)
  const sorted = [...slotEstimates].sort((a, b) => a.costUsd - b.costUsd)
  const kept = []
  let cumulative = 0

  for (const item of sorted) {
    if (cumulative + item.costUsd <= maxBudgetUsd || kept.length === 0) {
      kept.push(item.slot)
      cumulative += item.costUsd
    }
  }

  return {
    allowed: true,
    references: kept,
    action: 'trim',
    originalCount: references.length,
    trimmedCount: kept.length,
    estimatedCostUsd: Number(cumulative.toFixed(6)),
    maxBudgetUsd,
    reason: `Trimmed candidate pool from ${references.length} to ${kept.length} models to stay within budget ($${maxBudgetUsd.toFixed(4)}).`,
  }
}
