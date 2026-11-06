/**
 * Dynamic Consensus Threshold & Multi-Judge Escalation (#300)
 *
 * Detects divergence among candidate outputs (Disagreement Metric).
 * When candidate consensus is weak or contradictory, automatically escalates:
 * - auto_upgrade: upgrades from lightweight/fast judge to flagship/senior judge
 * - council_majority: convenes a 3-judge panel with majority voting
 */

import { calculateSimilarity } from './early-consensus.js'

/**
 * Calculates the Disagreement Metric (0.0 to 1.0) across candidate outputs.
 * 0.0 means perfect consensus (identical solutions).
 * 1.0 means total divergence (completely distinct solutions).
 *
 * @param {Array<object>} candidateOutputs
 * @returns {number} Disagreement metric between 0.0 and 1.0
 */
export function calculateDisagreementMetric(candidateOutputs = []) {
  if (!Array.isArray(candidateOutputs) || candidateOutputs.length < 2) {
    return 0.0
  }

  const validTexts = candidateOutputs
    .filter((c) => c && typeof c.text === 'string' && c.text.trim())
    .map((c) => c.text)

  if (validTexts.length < 2) return 0.0

  let totalSim = 0
  let pairs = 0

  for (let i = 0; i < validTexts.length; i++) {
    for (let j = i + 1; j < validTexts.length; j++) {
      totalSim += calculateSimilarity(validTexts[i], validTexts[j])
      pairs++
    }
  }

  if (pairs === 0) return 0.0
  const avgSim = totalSim / pairs
  const disagreement = Math.max(0.0, Math.min(1.0, 1.0 - avgSim))
  return Number(disagreement.toFixed(4))
}

/**
 * Evaluates whether candidate divergence warrants judge escalation.
 *
 * @param {object} params
 * @param {Array<object>} params.candidateOutputs - Array of successful candidate results
 * @param {object} params.primaryJudge - Primary configured judge slot
 * @param {Array<object>} [params.fallbackJudges=[]] - Chain of backup judges
 * @param {object} [params.escalationJudge] - Explicit flagship upgrade judge
 * @param {string} [params.policy='single'] - 'single' | 'auto_upgrade' | 'council_majority'
 * @param {number} [params.threshold=0.40] - Disagreement threshold to trigger escalation
 * @returns {object} Escalation decision and effective judge(s)
 */
export function evaluateJudgeEscalation({
  candidateOutputs = [],
  primaryJudge = { provider: '', model: '' },
  fallbackJudges = [],
  escalationJudge = null,
  policy = 'single',
  threshold = 0.40,
} = {}) {
  const normPolicy = String(policy || 'single').toLowerCase()

  if (normPolicy === 'single' || !Array.isArray(candidateOutputs) || candidateOutputs.length < 2) {
    return {
      escalated: false,
      escalatedType: 'none',
      judge: primaryJudge,
      councilJudges: [primaryJudge],
      disagreement: 0.0,
      threshold,
      reason: 'Standard single judge evaluation',
    }
  }

  const disagreement = calculateDisagreementMetric(candidateOutputs)
  const isTriggered = disagreement >= threshold

  if (!isTriggered) {
    return {
      escalated: false,
      escalatedType: 'none',
      judge: primaryJudge,
      councilJudges: [primaryJudge],
      disagreement,
      threshold,
      reason: `Consensus adequate: disagreement ${(disagreement * 100).toFixed(1)}% < threshold ${(threshold * 100).toFixed(1)}%`,
    }
  }

  if (normPolicy === 'auto_upgrade') {
    // Pick designated escalationJudge, or the first available fallbackJudge
    let targetJudge = null
    if (escalationJudge && escalationJudge.model) {
      targetJudge = escalationJudge
    } else if (Array.isArray(fallbackJudges) && fallbackJudges.length > 0 && fallbackJudges[0]?.model) {
      targetJudge = fallbackJudges[0]
    } else {
      targetJudge = primaryJudge
    }

    const upgraded = targetJudge.model !== primaryJudge.model || targetJudge.provider !== primaryJudge.provider
    return {
      escalated: upgraded,
      escalatedType: upgraded ? 'auto_upgrade' : 'none',
      judge: targetJudge,
      originalJudge: primaryJudge,
      councilJudges: [targetJudge],
      disagreement,
      threshold,
      reason: upgraded
        ? `High candidate divergence (${(disagreement * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(1)}%): upgraded judge to ${targetJudge.provider ? targetJudge.provider + ':' : ''}${targetJudge.model}`
        : `High divergence detected (${(disagreement * 100).toFixed(1)}%), but no senior fallback judge configured`,
    }
  }

  if (normPolicy === 'council_majority') {
    const council = [primaryJudge]
    if (escalationJudge && escalationJudge.model && escalationJudge.model !== primaryJudge.model) {
      council.push(escalationJudge)
    }
    if (Array.isArray(fallbackJudges)) {
      for (const fb of fallbackJudges) {
        if (council.length >= 3) break
        if (fb && fb.model && !council.some((c) => c.model === fb.model && c.provider === fb.provider)) {
          council.push(fb)
        }
      }
    }

    const hasMulti = council.length > 1
    return {
      escalated: hasMulti,
      escalatedType: hasMulti ? 'council_majority' : 'none',
      judge: council[0],
      originalJudge: primaryJudge,
      councilJudges: council,
      disagreement,
      threshold,
      reason: hasMulti
        ? `High candidate divergence (${(disagreement * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(1)}%): assembled ${council.length}-judge council`
        : `High divergence detected, but fewer than 2 judges available for council`,
    }
  }

  return {
    escalated: false,
    escalatedType: 'none',
    judge: primaryJudge,
    councilJudges: [primaryJudge],
    disagreement,
    threshold,
    reason: 'Standard single judge',
  }
}
