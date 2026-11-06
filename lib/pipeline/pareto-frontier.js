/**
 * DeepSeek Harness Mixture of Agents (MoA) — Cost/Quality Pareto Frontier Slider (#307)
 *
 * Provides reactive calculation of the optimal ensemble trade-off between Cost ($),
 * Quality (Rigorous Consensus), and Latency (seconds) along the Pareto Frontier.
 * Dynamically maps a single slider value (0–100%) to curated model configurations:
 * - 0–25%: Local Free Edge Tier ($0.00 cost, ultra-low latency)
 * - 26–50%: Economic Tier (Low-cost cloud models + deepseek-chat)
 * - 51–75%: Balanced Production Tier (Diverse candidates + deepseek-reasoner / Sonnet)
 * - 76–100%: Ultra-Rigorous Consensus Tier (Flagship ensemble + Multi-Judge panel)
 */

import { MOA_EVENTS, emitEvent } from '../events.js'
import { estimateCandidateRunCost, estimateDownstreamCost } from '../moa-budget.js'

export const PARETO_TIERS = [
  {
    maxPos: 25,
    name: 'local_free',
    label: '⚡ 100% Free / Local Edge',
    description: 'Zero API costs. Local models on MiniPC (Qwen 2.5 Coder / Ollama) for maximum speed and privacy.',
    defaultReferences: [
      { provider: 'ollama', model: 'qwen2.5-coder:7b', role_persona: 'proposer' },
      { provider: 'ollama', model: 'deepseek-r1:8b', role_persona: 'challenger' },
    ],
    defaultAggregator: { provider: 'ollama', model: 'qwen2.5-coder:7b' },
    estimatedCostUsd: 0.0,
    estimatedLatencySec: 4,
    multiJudge: false,
  },
  {
    maxPos: 50,
    name: 'economic',
    label: '💡 Economic Tier',
    description: 'Low-cost fast models. Local edge proposers verified by an economical cloud aggregator.',
    defaultReferences: [
      { provider: 'ollama', model: 'qwen2.5-coder:7b', role_persona: 'proposer' },
      { provider: 'deepseek', model: 'deepseek-chat', role_persona: 'challenger' },
    ],
    defaultAggregator: { provider: 'deepseek', model: 'deepseek-chat' },
    estimatedCostUsd: 0.002,
    estimatedLatencySec: 7,
    multiJudge: false,
  },
  {
    maxPos: 75,
    name: 'balanced',
    label: '⚖️ Optimal Balanced Tier',
    description: 'High hypothesis diversity with reasoning models and flagship aggregator.',
    defaultReferences: [
      { provider: 'deepseek', model: 'deepseek-chat', role_persona: 'proposer' },
      { provider: 'deepseek', model: 'deepseek-reasoner', role_persona: 'challenger' },
      { provider: 'ollama', model: 'qwen2.5-coder:7b', role_persona: 'minimalist' },
    ],
    defaultAggregator: { provider: 'deepseek', model: 'deepseek-reasoner' },
    estimatedCostUsd: 0.009,
    estimatedLatencySec: 12,
    multiJudge: false,
  },
  {
    maxPos: 100,
    name: 'ultra_rigorous',
    label: '🏆 Ultra-Rigorous Consensus',
    description: 'Maximum accuracy. Flagship reasoning models with multi-judge panel and adversarial peer critique.',
    defaultReferences: [
      { provider: 'deepseek', model: 'deepseek-reasoner', role_persona: 'proposer' },
      { provider: 'anthropic', model: 'claude-3-5-sonnet', role_persona: 'challenger' },
      { provider: 'openai', model: 'gpt-4o', role_persona: 'adversary' },
    ],
    defaultAggregator: { provider: 'deepseek', model: 'deepseek-reasoner' },
    estimatedCostUsd: 0.038,
    estimatedLatencySec: 22,
    multiJudge: true,
  },
]

/**
 * Returns the Pareto tier definition for a given slider position (0-100).
 *
 * @param {number} position
 * @returns {object} Tier configuration
 */
export function getParetoProfile(position = 50) {
  const clamped = Math.max(0, Math.min(100, Number(position) || 0))
  for (const tier of PARETO_TIERS) {
    if (clamped <= tier.maxPos) {
      return { ...tier, position: clamped }
    }
  }
  return { ...PARETO_TIERS[PARETO_TIERS.length - 1], position: clamped }
}

/**
 * Calculates dynamically predicted cost and latency for an ensemble along the Pareto Frontier.
 *
 * @param {number} sliderPos
 * @param {Array<object>} [availableModels]
 * @param {object} [options]
 * @returns {object} Ensemble recommendation
 */
export function calculateParetoEnsemble(sliderPos = 50, availableModels = [], options = {}) {
  const profile = getParetoProfile(sliderPos)
  const { prices = {}, promptTokens = 1500, expectedOutputTokens = 2048 } = options

  // Calculate upfront cost
  const candCost = estimateCandidateRunCost(profile.defaultReferences, prices, promptTokens, expectedOutputTokens)
  const downstreamCost = estimateDownstreamCost(
    profile.defaultAggregator,
    profile.multiJudge ? profile.defaultReferences : [],
    profile.defaultReferences.length,
    prices,
    expectedOutputTokens,
    promptTokens
  )

  const calculatedCostUsd = profile.name === 'local_free'
    ? 0.0
    : Number((candCost.totalEstimatedUsd + downstreamCost).toFixed(5))

  return {
    tier: profile.name,
    label: profile.label,
    description: profile.description,
    sliderPosition: profile.position,
    estimatedCostUsd: calculatedCostUsd > 0 ? calculatedCostUsd : profile.estimatedCostUsd,
    estimatedLatencySec: profile.estimatedLatencySec,
    recommendedReferences: profile.defaultReferences,
    recommendedAggregator: profile.defaultAggregator,
    multiJudgeEnabled: profile.multiJudge,
  }
}

/**
 * Adapts preset configuration based on Pareto slider position if enabled.
 *
 * @param {object} preset
 * @param {object} [options]
 * @returns {object} Adjusted preset
 */
export function applyParetoAdjustment(preset, options = {}) {
  if (!preset?.pareto_slider_enabled) return preset

  const { ctx, runId, onProgress } = options
  const position = preset.pareto_slider_position ?? 50
  const recommendation = calculateParetoEnsemble(position, options.availableModels || [], options)

  if (typeof onProgress === 'function') {
    onProgress(`📈 *Pareto Frontier*: Active profile ${recommendation.label} (~$${recommendation.estimatedCostUsd}, ~${recommendation.estimatedLatencySec}s)\n`)
  }

  if (ctx) {
    emitEvent(ctx, MOA_EVENTS.PARETO_ADJUSTED, {
      runId,
      position,
      tier: recommendation.tier,
      estimatedCostUsd: recommendation.estimatedCostUsd,
      estimatedLatencySec: recommendation.estimatedLatencySec,
    })
  }

  return {
    ...preset,
    reference_models: recommendation.recommendedReferences,
    aggregator: recommendation.recommendedAggregator,
    multi_judge_enabled: recommendation.multiJudgeEnabled || preset.multi_judge_enabled,
  }
}
