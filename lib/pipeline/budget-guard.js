/**
 * DeepSeek Harness Mixture of Agents (MoA) — Hard Token Budget Guard & Auto-Scaling (#319)
 *
 * Enforces strict financial limits on inference costs. Pre-calculates end-to-end turn
 * expenses (proposers + multi-judge + synthesis) against hard_budget_limit_usd before dispatching.
 *
 * Supports two operational policies when anticipated cost exceeds limit:
 * - auto_downgrade: Automatically substitutes costly cloud slots with zero-cost local edge
 *   models or economic tiers, and scales down candidate slots until cost fits under the ceiling.
 * - fail_closed: Halts execution immediately to eliminate unexpected API billing surprises.
 */

import { MOA_EVENTS, emitEvent } from '../events.js'
import { estimateCandidateRunCost, estimateDownstreamCost } from '../moa-budget.js'

/**
 * Evaluates projected turn expenses and dynamically scales down ensemble if needed.
 *
 * @param {object} params
 * @param {Array<object>} params.references
 * @param {object} params.aggregator
 * @param {number} params.limitUsd
 * @param {string} [params.policy='auto_downgrade']
 * @param {object} [params.prices={}]
 * @param {number} [params.promptTokens=1500]
 * @param {number} [params.expectedOutputTokens=2048]
 * @param {object} [params.options]
 * @returns {object} Budget evaluation result
 */
export function evaluateHardBudgetLimit({
  references = [],
  aggregator = {},
  limitUsd = 0.02,
  policy = 'auto_downgrade',
  prices = {},
  promptTokens = 1500,
  expectedOutputTokens = 2048,
  options = {},
}) {
  const { ctx, runId, onProgress } = options

  // Calculate baseline projected cost
  const candCost = estimateCandidateRunCost(references, prices, promptTokens, expectedOutputTokens)
  const downstreamCost = estimateDownstreamCost(
    aggregator,
    [],
    references.length,
    prices,
    expectedOutputTokens,
    promptTokens
  )
  const initialProjectedCost = Number((candCost.totalEstimatedUsd + downstreamCost).toFixed(5))

  if (initialProjectedCost <= limitUsd) {
    return {
      ok: true,
      scaled: false,
      references,
      aggregator,
      projectedCostUsd: initialProjectedCost,
      initialProjectedCost,
      limitUsd,
      warning: null,
    }
  }

  // Cost exceeds limit
  if (policy === 'fail_closed') {
    const errorMsg = `[BudgetGuard] Projected turn cost ($${initialProjectedCost}) exceeds hard limit ($${limitUsd}). Execution halted.`
    if (typeof onProgress === 'function') {
      onProgress(`🛑 *${errorMsg}*\n`)
    }
    return {
      ok: false,
      scaled: false,
      error: errorMsg,
      projectedCostUsd: initialProjectedCost,
      initialProjectedCost,
      limitUsd,
    }
  }

  // policy: auto_downgrade
  let workingRefs = [...references]
  let workingAggregator = { ...aggregator }
  let scaled = false

  // Step 1: Replace expensive cloud proposers with local edge models (zero cost)
  for (let i = workingRefs.length - 1; i >= 0; i--) {
    const currentSlot = workingRefs[i]
    if (currentSlot.provider !== 'ollama' && currentSlot.provider !== 'local') {
      workingRefs[i] = {
        ...currentSlot,
        provider: 'ollama',
        model: 'qwen2.5-coder:7b',
        role_persona: currentSlot.role_persona || 'proposer',
      }
      scaled = true
    }

    const testCandCost = estimateCandidateRunCost(workingRefs, prices, promptTokens, expectedOutputTokens)
    const testDownstream = estimateDownstreamCost(workingAggregator, [], workingRefs.length, prices, expectedOutputTokens, promptTokens)
    if ((testCandCost.totalEstimatedUsd + testDownstream) <= limitUsd) {
      break
    }
  }

  // Step 2: If still exceeding, replace expensive aggregator with economical model or local
  let currentCost = Number((estimateCandidateRunCost(workingRefs, prices, promptTokens, expectedOutputTokens).totalEstimatedUsd +
    estimateDownstreamCost(workingAggregator, [], workingRefs.length, prices, expectedOutputTokens, promptTokens)).toFixed(5))

  if (currentCost > limitUsd && workingAggregator.provider !== 'ollama') {
    workingAggregator = { provider: 'deepseek', model: 'deepseek-chat' }
    scaled = true
    currentCost = Number((estimateCandidateRunCost(workingRefs, prices, promptTokens, expectedOutputTokens).totalEstimatedUsd +
      estimateDownstreamCost(workingAggregator, [], workingRefs.length, prices, expectedOutputTokens, promptTokens)).toFixed(5))

    if (currentCost > limitUsd) {
      workingAggregator = { provider: 'ollama', model: 'qwen2.5-coder:7b' }
      currentCost = 0.0
    }
  }

  // Step 3: If still exceeding, prune candidates down to 1
  if (currentCost > limitUsd && workingRefs.length > 1) {
    workingRefs = [workingRefs[0]]
    scaled = true
    currentCost = Number((estimateCandidateRunCost(workingRefs, prices, promptTokens, expectedOutputTokens).totalEstimatedUsd +
      estimateDownstreamCost(workingAggregator, [], workingRefs.length, prices, expectedOutputTokens, promptTokens)).toFixed(5))
  }

  if (scaled) {
    if (typeof onProgress === 'function') {
      onProgress(`🛡️ *Budget Guard Auto-Scaling*: Scaled ensemble from $${initialProjectedCost} to $${currentCost} to fit under $${limitUsd} ceiling.\n`)
    }

    if (ctx) {
      emitEvent(ctx, MOA_EVENTS.BUDGET_SCALED, {
        runId,
        originalCostUsd: initialProjectedCost,
        scaledCostUsd: currentCost,
        limitUsd,
        policy,
      })
    }
  }

  return {
    ok: true,
    scaled,
    references: workingRefs,
    aggregator: workingAggregator,
    projectedCostUsd: currentCost,
    initialProjectedCost,
    limitUsd,
    warning: scaled ? `Budget Guard Auto-Scaled: initial $${initialProjectedCost} $\\to$ $${currentCost} (ceiling $${limitUsd})` : null,
  }
}
