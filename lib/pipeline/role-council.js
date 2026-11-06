/**
 * Multi-Persona Role-Playing Council for Holistic Arbitration (#313)
 *
 * Replaces monolithic single-arbitrator bias by evaluating candidate proposals
 * through a structured jury of three specialized expert personas:
 * 1. Systems Architect (Modularity, Scalability, Separation of Concerns)
 * 2. Security Auditor (Defensive boundaries, Sanitization, Vulnerability protection)
 * 3. Pragmatic Minimalist YAGNI (Zero boilerplate, Standard library first, Anti-overengineering)
 *
 * Computes a normalized weighted score across all three quality axes and generates
 * a comprehensive arbitration report for final synthesis.
 */

import { logger } from '../logger.js'
import { emitEvent, MOA_EVENTS } from '../events.js'

/**
 * Normalizes council weights so they sum to 100%.
 * @param {object} weights
 * @returns {{ architect: number, security: number, minimalist: number }}
 */
export function normalizeCouncilWeights(weights = {}) {
  const rawA = Math.max(0, Number(weights.architect ?? weights.council_weight_architect ?? 35))
  const rawS = Math.max(0, Number(weights.security ?? weights.council_weight_security ?? 35))
  const rawM = Math.max(0, Number(weights.minimalist ?? weights.council_weight_minimalist ?? 30))

  const total = rawA + rawS + rawM
  if (total <= 0) {
    return { architect: 35, security: 35, minimalist: 30 }
  }

  return {
    architect: Number(((rawA / total) * 100).toFixed(1)),
    security: Number(((rawS / total) * 100).toFixed(1)),
    minimalist: Number(((rawM / total) * 100).toFixed(1)),
  }
}

/**
 * Evaluates a candidate proposal along the three expert council axes.
 * Heuristic static and structural code analysis.
 * @param {object} candidate
 * @returns {object}
 */
export function evaluateCandidateByCouncil(candidate) {
  const text = candidate.text || ''
  const files = candidate.files || []

  // 1. Systems Architect (Modularity, Separation of concerns, Scalability)
  let scoreArchitect = 7.0
  const architectCritiques = []

  if (files.length > 1) {
    scoreArchitect += 1.5
    architectCritiques.push('Clean modularity: separates components into discrete files.')
  } else if (text.length > 3000 && files.length <= 1) {
    scoreArchitect -= 1.5
    architectCritiques.push('Monolithic structure: large implementation packed into single file.')
  }

  if (/export\s+(function|class|const|default)/.test(text)) {
    scoreArchitect += 0.5
    architectCritiques.push('Well-defined export boundaries and module interfaces.')
  }

  if (/(interface|type\s+\w+\s*=|class\s+\w+)/.test(text)) {
    scoreArchitect += 0.5
    architectCritiques.push('Explicit domain modeling and type contracts.')
  }

  // 2. Security Auditor (Input validation, Sanitization, Error handling)
  let scoreSecurity = 7.0
  const securityCritiques = []

  if (/try\s*\{[\s\S]*?\}\s*catch/.test(text)) {
    scoreSecurity += 1.0
    securityCritiques.push('Defensive design: explicit error trapping and failure boundaries.')
  } else {
    scoreSecurity -= 1.0
    securityCritiques.push('Missing try/catch blocks on critical execution paths.')
  }

  if (/(if\s*\(!|typeof\s+\w+|===\s*null|===\s*undefined|\.trim\(\))/.test(text)) {
    scoreSecurity += 1.0
    securityCritiques.push('Thorough input validation and null/undefined guard clauses.')
  }

  if (candidate.securityAudit?.passed === false || candidate.syntaxValidation?.valid === false) {
    scoreSecurity -= 3.0
    securityCritiques.push('Critical vulnerability or syntax defect flagged in security audit.')
  }

  if (/(exec\s*\(|eval\s*\(|innerHTML\s*=|\bSELECT\b[\s\S]*?\+\s*\w+)/i.test(text)) {
    scoreSecurity -= 2.0
    securityCritiques.push('Unsafe pattern detected: potential injection vector.')
  }

  // 3. Pragmatic Minimalist YAGNI (Stdlib first, Anti-bloat, Zero unnecessary boilerplate)
  let scoreMinimalist = 7.0
  const minimalistCritiques = []

  const lineCount = text.split('\n').length
  if (lineCount < 80 && lineCount > 10) {
    scoreMinimalist += 1.5
    minimalistCritiques.push('Concise, elegant implementation with zero extraneous bloat.')
  } else if (lineCount > 300) {
    scoreMinimalist -= 1.0
    minimalistCritiques.push('High code volume: potential over-abstraction or boilerplate.')
  }

  if (/(Abstract\w+Factory|\bSingleton\b|\bBuilder\b|\bSubject\b|\bObserver\b)/i.test(text)) {
    scoreMinimalist -= 1.5
    minimalistCritiques.push('Speculative design patterns and unnecessary abstraction layers.')
  }

  if (/require\s*\(|from\s+['"][^./]/.test(text) && !/node:/.test(text)) {
    scoreMinimalist -= 0.5
    minimalistCritiques.push('External third-party dependency introduced where stdlib may suffice.')
  } else {
    scoreMinimalist += 1.0
    minimalistCritiques.push('Leverages standard library and native primitives.')
  }

  // Clamp individual scores 1.0 to 10.0
  scoreArchitect = Math.max(1.0, Math.min(10.0, Number(scoreArchitect.toFixed(1))))
  scoreSecurity = Math.max(1.0, Math.min(10.0, Number(scoreSecurity.toFixed(1))))
  scoreMinimalist = Math.max(1.0, Math.min(10.0, Number(scoreMinimalist.toFixed(1))))

  return {
    candidateIndex: candidate.index ?? 1,
    label: candidate.label || `Candidate ${candidate.index ?? 1}`,
    scores: {
      architect: scoreArchitect,
      security: scoreSecurity,
      minimalist: scoreMinimalist,
    },
    critiques: {
      architect: architectCritiques.join(' ') || 'Standard architecture.',
      security: securityCritiques.join(' ') || 'Adequate security precautions.',
      minimalist: minimalistCritiques.join(' ') || 'Moderate complexity.',
    },
  }
}

/**
 * Formats council deliberations into a structured markdown directive.
 * @param {Array<object>} councilEvaluations
 * @param {object} weights
 * @returns {string}
 */
export function formatCouncilDirective(councilEvaluations = [], weights = { architect: 35, security: 35, minimalist: 30 }) {
  if (!Array.isArray(councilEvaluations) || councilEvaluations.length === 0) return ''

  const lines = []
  lines.push('=== 🏛️ MULTI-PERSONA ROLE-PLAYING COUNCIL ARBITRATION ===')
  lines.push('A specialized 3-expert jury independently scored each candidate along orthogonal quality axes:')
  lines.push(`Council Weights: Architect (${weights.architect}%), Security (${weights.security}%), Minimalist (${weights.minimalist}%)\n`)

  for (const item of councilEvaluations) {
    const s = item.scores
    lines.push(`### ${item.label} — Weighted Composite: ${item.compositeScore}/10`)
    lines.push(`- 🏗️ **Systems Architect** [${s.architect}/10]: ${item.critiques.architect}`)
    lines.push(`- 🛡️ **Security Auditor** [${s.security}/10]: ${item.critiques.security}`)
    lines.push(`- ✂️ **Pragmatic Minimalist** [${s.minimalist}/10]: ${item.critiques.minimalist}\n`)
  }

  const leader = councilEvaluations[0]
  lines.push(`🏛️ COUNCIL RECOMMENDATION: ${leader.label} (Composite Score: ${leader.compositeScore}/10)`)
  lines.push('CRITICAL JUDGE DIRECTIVE: Reconcile all three quality axes. Ensure your final synthesized deliverable incorporates the security defenses and architectural modularity while eliminating all bloated boilerplate.')
  lines.push('========================================================')

  return lines.join('\n')
}

/**
 * Orchestrates multi-persona council arbitration (#313).
 * @param {object} params
 * @returns {object}
 */
export function runCouncilArbitrationGate(candidates = [], preset = {}, options = {}) {
  const enabled = Boolean(preset?.council_arbitration_enabled || preset?.councilArbitrationEnabled)
  if (!enabled || !Array.isArray(candidates) || candidates.length === 0) {
    return { ok: true, councilEvaluations: [], councilDirective: '', winnerIndex: 0 }
  }

  const { ctx, runId = 'council-run', onProgress = null } = options
  const weights = normalizeCouncilWeights({
    architect: preset?.council_weight_architect,
    security: preset?.council_weight_security,
    minimalist: preset?.council_weight_minimalist,
  })

  if (typeof onProgress === 'function') {
    onProgress(`🏛️ *Role-Playing Council: Convening 3-expert jury (Architect: ${weights.architect}%, Security: ${weights.security}%, Minimalist: ${weights.minimalist}%)...*\n`)
  }

  const evaluations = candidates.map((cand) => {
    const evalData = evaluateCandidateByCouncil(cand)
    const compositeScore = Number(
      ((evalData.scores.architect * weights.architect +
        evalData.scores.security * weights.security +
        evalData.scores.minimalist * weights.minimalist) / 100).toFixed(2)
    )

    cand.councilScore = compositeScore
    cand.councilDetails = evalData

    return {
      ...evalData,
      compositeScore,
    }
  })

  // Sort descending by composite score
  evaluations.sort((a, b) => b.compositeScore - a.compositeScore)
  const winnerIndex = evaluations[0]?.candidateIndex ?? 1

  const councilDirective = formatCouncilDirective(evaluations, weights)

  emitEvent(ctx, MOA_EVENTS.COUNCIL_VERDICT, {
    runId,
    weights,
    evaluations,
    winnerIndex,
    winnerScore: evaluations[0]?.compositeScore,
  })

  return {
    ok: true,
    councilEvaluations: evaluations,
    councilDirective,
    winnerIndex,
  }
}
