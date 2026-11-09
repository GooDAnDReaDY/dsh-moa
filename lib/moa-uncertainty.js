/**
 * Token-Level Uncertainty & Entropy Scoring for Hallucination Detection (#256)
 * Calculates Shannon entropy across token logprob distributions, detects high-uncertainty
 * identifier/method call spans, and builds diagnostic annotations for the Judge.
 */

const LN2 = Math.LN2

/**
 * Computes token entropy in bits from a token logprob entry.
 * Supports full top_logprobs distributions as well as scalar logprob surprisal.
 *
 * @param {object|number} entry
 * @returns {number} Entropy in bits (>= 0)
 */
export function calculateTokenEntropy(entry) {
  if (typeof entry === 'number') {
    if (!Number.isFinite(entry) || entry >= 0) return 0
    return Number((-entry / LN2).toFixed(4))
  }
  if (!entry || typeof entry !== 'object') return 0

  const topList = Array.isArray(entry.top_logprobs) ? entry.top_logprobs : null
  if (topList && topList.length > 0) {
    let entropy = 0
    let totalProb = 0
    for (const item of topList) {
      const lp = typeof item === 'number' ? item : Number(item?.logprob)
      if (!Number.isFinite(lp)) continue
      const p = Math.min(1, Math.max(1e-9, Math.exp(lp)))
      totalProb += p
      entropy -= p * (lp / LN2)
    }
    // Account for remaining probability mass if top_logprobs is truncated
    if (totalProb < 0.999 && totalProb > 0) {
      const rem = 1 - totalProb
      entropy -= rem * Math.log2(rem)
    }
    return Number(Math.max(0, entropy).toFixed(4))
  }

  const lp = Number(entry.logprob)
  if (Number.isFinite(lp) && lp < 0) {
    return Number((-lp / LN2).toFixed(4))
  }
  return 0
}

/**
 * Analyzes a candidate output's token logprobs (and code heuristics) to identify
 * high-uncertainty zones where hallucinations are likely.
 *
 * @param {object} candidate
 * @param {object} [options]
 * @returns {object}
 */
export function analyzeCandidateUncertainty(candidate, options = {}) {
  const threshold = typeof options.entropyThreshold === 'number' ? options.entropyThreshold : 1.2
  const rawLogprobs = Array.isArray(candidate?.logprobs)
    ? candidate.logprobs
    : (Array.isArray(candidate?.logprobs?.content) ? candidate.logprobs.content : [])

  const highEntropySpans = []
  let sumEntropy = 0
  let maxEntropy = 0
  let tokenCount = 0

  if (rawLogprobs.length > 0) {
    for (let i = 0; i < rawLogprobs.length; i++) {
      const item = rawLogprobs[i]
      const h = calculateTokenEntropy(item)
      const tok = String(item?.token ?? '').trim()
      sumEntropy += h
      if (h > maxEntropy) maxEntropy = h
      tokenCount++

      if (h >= threshold && tok.length > 0 && !/^[\s{}()\[\];,.:'"`]+$/.test(tok)) {
        // Reconstruct local context window around token
        const prev = rawLogprobs.slice(Math.max(0, i - 2), i).map((t) => t?.token || '').join('')
        const next = rawLogprobs.slice(i + 1, Math.min(rawLogprobs.length, i + 3)).map((t) => t?.token || '').join('')
        const contextSpan = (prev + (item?.token || '') + next).replace(/\s+/g, ' ').trim()
        const prob = Number.isFinite(Number(item?.logprob))
          ? Number(Math.exp(Number(item.logprob)).toFixed(3))
          : Number(Math.pow(2, -h).toFixed(3))

        highEntropySpans.push({
          token: tok,
          span: contextSpan || tok,
          entropy: h,
          probability: prob,
          warning: `Warning: high entropy in segment "${contextSpan || tok}" (H=${h.toFixed(2)} bits, p=${prob})`,
        })
      }
    }
  }

  const avgEntropy = tokenCount > 0 ? Number((sumEntropy / tokenCount).toFixed(4)) : 0
  let riskLevel = 'low'
  if (maxEntropy >= threshold * 1.6 || highEntropySpans.length >= 3) {
    riskLevel = 'high'
  } else if (maxEntropy >= threshold || highEntropySpans.length >= 1) {
    riskLevel = 'medium'
  }

  return {
    candidateIndex: candidate?.index ?? 0,
    model: candidate?.label || candidate?.model || 'unknown',
    tokenCount,
    avgEntropy,
    maxEntropy: Number(maxEntropy.toFixed(4)),
    riskLevel,
    highEntropySpans,
  }
}

/**
 * Formats uncertainty analysis across all candidates into a Judge prompt directive.
 *
 * @param {Array<object>} candidates
 * @param {object} [options]
 * @returns {{ reportText: string, analyses: Array<object>, hasHighUncertainty: boolean }}
 */
export function formatUncertaintyAnnotations(candidates, options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { reportText: '', analyses: [], hasHighUncertainty: false }
  }

  const analyses = candidates.map((c, idx) =>
    analyzeCandidateUncertainty({ ...c, index: c.index ?? idx + 1 }, options)
  )

  const flagged = analyses.filter((a) => a.highEntropySpans.length > 0)
  if (flagged.length === 0) {
    return { reportText: '', analyses, hasHighUncertainty: false }
  }

  const lines = [
    '\n### 🔬 Token-Level Uncertainty & Hallucination Warnings:',
    'The following candidate segments exhibited abnormally high token entropy (low model confidence). Carefully verify API existence, method signatures, and edge cases before adopting these fragments:',
  ]

  for (const a of flagged) {
    lines.push(`- **Candidate ${a.candidateIndex} (${a.model})** [Risk: ${a.riskLevel.toUpperCase()}, Avg H=${a.avgEntropy}, Max H=${a.maxEntropy}]:`)
    for (const span of a.highEntropySpans.slice(0, 5)) {
      lines.push(`  - ⚠️ ${span.warning}`)
    }
  }

  return {
    reportText: lines.join('\n') + '\n',
    analyses,
    hasHighUncertainty: true,
  }
}
