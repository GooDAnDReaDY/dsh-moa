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
 * Evaluates candidate runs, peer critique (Round 2) and downstream synthesis phases.
 */
export function applyBudgetGuardrails({
  references = [],
  enabled = false,
  maxBudgetUsd = 0,
  action = 'trim', // 'trim' | 'abort'
  prices = {},
  promptLength = 1000,
  messages = [],
  maxTokens = 2048,
  peerCritiqueEnabled = false,
  aggregator = null,
  judgeModels = [],
}) {
  if (!enabled || typeof maxBudgetUsd !== 'number' || maxBudgetUsd <= 0 || references.length === 0) {
    return {
      allowed: true,
      references,
      action: 'none',
      estimatedCostUsd: 0,
    }
  }

  // Calculate full input tokens from userPrompt length + messages context
  let contextChars = Number(promptLength) || 1000
  if (Array.isArray(messages) && messages.length > 0) {
    for (const m of messages) {
      if (typeof m?.content === 'string') {
        contextChars += m.content.length
      } else if (Array.isArray(m?.content)) {
        for (const part of m.content) {
          if (part?.text) contextChars += part.text.length
        }
      }
    }
  }
  const promptTokens = Math.max(50, Math.round(contextChars / 4))
  const expectedOutputTokens = typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 2048

  // Base candidate cost per slot (Round 1)
  const { totalEstimatedUsd, slotEstimates } = estimateCandidateRunCost(references, prices, promptTokens, expectedOutputTokens)

  // Estimate cost for downstream phases (Aggregator / Judge panel)
  function calcDownstreamUsd(numCandidates) {
    let downstream = 0
    if (aggregator?.provider && aggregator?.model) {
      const aggInput = promptTokens + expectedOutputTokens * numCandidates
      const aggCost = estimateTokenCost(aggregator, { inputTokens: aggInput, outputTokens: expectedOutputTokens }, prices)
      downstream += aggCost?.costUsd || 0
    }
    if (Array.isArray(judgeModels) && judgeModels.length > 0) {
      for (const jm of judgeModels) {
        if (jm?.provider && jm?.model) {
          const jInput = promptTokens + expectedOutputTokens * numCandidates
          const jCost = estimateTokenCost(jm, { inputTokens: jInput, outputTokens: expectedOutputTokens }, prices)
          downstream += jCost?.costUsd || 0
        }
      }
    }
    return downstream
  }

  // Multiplier if peer critique (Round 2) is enabled: each candidate runs another turn with input from all peers
  const roundMultiplier = peerCritiqueEnabled ? 2 : 1
  const downstreamUsd = calcDownstreamUsd(references.length)
  const fullEstimatedUsd = Number(((totalEstimatedUsd * roundMultiplier) + downstreamUsd).toFixed(6))

  if (fullEstimatedUsd <= maxBudgetUsd) {
    return {
      allowed: true,
      references,
      action: 'pass',
      estimatedCostUsd: fullEstimatedUsd,
    }
  }

  if (action === 'abort') {
    return {
      allowed: false,
      references: [],
      action: 'abort',
      estimatedCostUsd: fullEstimatedUsd,
      maxBudgetUsd,
      reason: `Estimated MoA run cost ($${fullEstimatedUsd.toFixed(4)}) exceeds configured max budget ($${maxBudgetUsd.toFixed(4)}).`,
    }
  }

  // Action is 'trim': Sort by estimated cost ascending (cheapest first)
  // Factor downstream synthesis cost into candidate selection (#158)
  const sorted = [...slotEstimates].sort((a, b) => a.costUsd - b.costUsd)
  const kept = []
  let cumulativeCandidateCost = 0

  for (const item of sorted) {
    const candidateCost = item.costUsd * roundMultiplier
    const nextDownstream = calcDownstreamUsd(kept.length + 1)
    if (cumulativeCandidateCost + candidateCost + nextDownstream <= maxBudgetUsd) {
      kept.push(item.slot)
      cumulativeCandidateCost += candidateCost
    }
  }

  if (kept.length === 0) {
    const minCandidateCost = (sorted[0]?.costUsd || 0) * roundMultiplier
    const minTotal = minCandidateCost + calcDownstreamUsd(1)
    return {
      allowed: false,
      references: [],
      action: 'trim',
      originalCount: references.length,
      trimmedCount: 0,
      estimatedCostUsd: Number(minTotal.toFixed(6)),
      maxBudgetUsd,
      reason: `Cannot fit any candidate model within budget ($${maxBudgetUsd.toFixed(4)}). Cheapest candidate requires $${minTotal.toFixed(4)}.`,
    }
  }

  const finalEstimatedUsd = Number((cumulativeCandidateCost + calcDownstreamUsd(kept.length)).toFixed(6))
  return {
    allowed: true,
    references: kept,
    action: 'trim',
    originalCount: references.length,
    trimmedCount: kept.length,
    estimatedCostUsd: finalEstimatedUsd,
    maxBudgetUsd,
    reason: `Trimmed candidate pool from ${references.length} to ${kept.length} models to stay within budget ($${maxBudgetUsd.toFixed(4)}).`,
  }
}
