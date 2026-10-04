/**
 * Multi-Judge Panel Consensus Voting & Composite Hybrid Synthesis
 * Feature 2 (Multi-Judge Panel) & Feature 3 (Composite Block Synthesis)
 */

import { slotLabel } from './moa-prompts.js'
import { estimateTokenCost } from './pricing.js'

/**
 * Extracts code fences and block-level assets from markdown text.
 */
export function extractCodeBlocks(text = '') {
  if (!text || typeof text !== 'string') return []
  const blocks = []
  const regex = /```([a-zA-Z0-9_\-\.\/:]+)?(?:\s+(?:file|path|filename)=([^\s\n]+))?\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const rawTag = (match[1] || '').trim()
    const explicitFile = (match[2] || '').trim()
    let lang = rawTag
    let filename = explicitFile

    // Handle ```ts:src/app.ts or ```typescript:app.ts
    if (rawTag.includes(':')) {
      const parts = rawTag.split(':')
      lang = parts[0]
      filename = parts.slice(1).join(':')
    } else if (rawTag.includes('/') || rawTag.includes('.')) {
      filename = rawTag
    }

    blocks.push({
      lang: lang || 'text',
      filename: filename || null,
      code: match[3],
      fullBlock: match[0],
    })
  }
  return blocks
}

/**
 * Builds composite block directives highlighting complementary modules across candidates.
 * Supports blind evaluation (#167).
 */
export function buildCompositeBlockDirectives(candidates = [], options = {}) {
  const isBlind = Boolean(options === true || options?.blind)
  const fileMap = new Map()

  for (const c of candidates) {
    if (!c.ok || !c.text) continue
    const blocks = extractCodeBlocks(c.text)
    for (const b of blocks) {
      if (b.filename) {
        if (!fileMap.has(b.filename)) {
          fileMap.set(b.filename, [])
        }
        fileMap.get(b.filename).push(isBlind ? `Candidate ${c.index}` : (c.label || `Candidate ${c.index}`))
      }
    }
  }

  let fileOverview = ''
  if (fileMap.size > 0) {
    fileOverview = '\nDetected modular file contributions across candidates:\n' +
      Array.from(fileMap.entries())
        .map(([file, contributors]) => `- \`${file}\`: available in ${contributors.join(', ')}`)
        .join('\n') + '\n'
  }

  return `
=== COMPOSITE HYBRID SYNTHESIS DIRECTIVE ===
You must synthesize a unified, best-of-all-worlds composite solution from all candidates.
Do NOT simply copy one candidate. Instead:
1. Extract the cleanest and most efficient core logic/algorithm (e.g. from the candidate with the highest reasoning score).
2. Incorporate defensive error handling, input validation, and edge-case guards.
3. Retain complete type annotations, utility helpers, and test coverage provided by any candidate.
4. Ensure all merged modules, functions, and files fit together into a cohesive, non-conflicting solution.
${fileOverview}============================================
`
}

/**
 * Parses judge output into structured scores and candidate choice.
 * Accepts either candidateCount or candidate array/set to support active candidate indexing (#166).
 */
export function parseJudgeEvaluation(rawText = '', candidatesOrCount = 2) {
  let allowedIndices = null
  let defaultCandidate = 1

  if (Array.isArray(candidatesOrCount)) {
    const active = candidatesOrCount.filter((c) => c && c.ok !== false)
    allowedIndices = new Set(active.map((c) => c.index))
    if (active.length > 0 && typeof active[0].index === 'number') {
      defaultCandidate = active[0].index
    }
  } else if (candidatesOrCount instanceof Set) {
    allowedIndices = candidatesOrCount
    defaultCandidate = Array.from(allowedIndices)[0] || 1
  } else if (typeof candidatesOrCount === 'number') {
    allowedIndices = new Set(Array.from({ length: candidatesOrCount }, (_, i) => i + 1))
    defaultCandidate = 1
  } else {
    allowedIndices = new Set([1, 2])
    defaultCandidate = 1
  }

  const scores = {}
  let bestCandidate = defaultCandidate
  let reasoning = ''

  const scoreMatches = rawText.matchAll(/Candidate\s*(\d+)[:\s]+(?:Score\s*[:\s]*)?([0-9]+(?:\.[0-9]+)?)/gi)
  for (const m of scoreMatches) {
    const idx = parseInt(m[1], 10)
    const val = parseFloat(m[2])
    if (allowedIndices.has(idx) && !Number.isNaN(val)) {
      scores[idx] = Math.min(10, Math.max(0, val))
    }
  }

  const bestMatch = rawText.match(/BEST_CANDIDATE\s*[:\s]+(?:Candidate\s*)?(\d+)/i)
  if (bestMatch) {
    const parsedBest = parseInt(bestMatch[1], 10)
    if (allowedIndices.has(parsedBest)) {
      bestCandidate = parsedBest
    }
  } else {
    // Find candidate with max parsed score among allowed indices
    let maxScore = -1
    for (const [idxStr, s] of Object.entries(scores)) {
      const idxNum = parseInt(idxStr, 10)
      if (allowedIndices.has(idxNum) && s > maxScore) {
        maxScore = s
        bestCandidate = idxNum
      }
    }
  }

  const reasonMatch = rawText.match(/CONSENSUS_REASONING\s*[:\s]+([^\n\r]+)/i)
  if (reasonMatch) {
    reasoning = reasonMatch[1].trim()
  }

  return { scores, bestCandidate, reasoning }
}

/**
 * Runs a multi-judge consensus panel across candidate solutions.
 * Supports majority, unanimous, and highest_score strategies.
 * Returns consensus, votes, usage, and cost tracking (#165, #167, #168).
 */
export async function executeMultiJudgePanel({
  judges = [],
  candidates = [],
  userPrompt = '',
  callLlm,
  strategy = 'majority',
  timeoutMs = 45000,
  signal,
  onProgress,
  prices = {},
  blind = false,
}) {
  const activeCandidates = (candidates || []).filter((c) => c && c.ok)
  if (activeCandidates.length === 0) {
    return {
      consensus: false,
      winningCandidateIndex: 1,
      strategy,
      isUnanimous: false,
      votes: {},
      averageScores: {},
      judgesResults: [],
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      totalCostUsd: 0,
      reason: 'no_active_candidates',
    }
  }

  if (activeCandidates.length === 1) {
    return {
      consensus: true,
      winningCandidateIndex: activeCandidates[0].index,
      winningCandidateLabel: activeCandidates[0].label,
      strategy,
      isUnanimous: true,
      votes: { [activeCandidates[0].index]: 1 },
      averageScores: { [activeCandidates[0].index]: 10.0 },
      judgesResults: [],
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      totalCostUsd: 0,
      reason: 'single_active_candidate',
    }
  }

  const judgePanel = (judges && judges.length > 0)
    ? judges
    : [{ provider: 'default', model: 'aggregator-judge', label: 'Primary Judge' }]

  // Blind evaluation: mask model labels in judge prompt (#167)
  const candidateSummary = activeCandidates.map((c) => {
    const label = blind ? `Candidate ${c.index}` : `Candidate ${c.index} (${c.label})`
    return `### ${label}:\n${(c.text || '').slice(0, 4000)}`
  }).join('\n\n---\n\n')

  const judgePrompt = `You are an impartial Expert Code & Logic Judge evaluating multiple AI candidate solutions.
User Task:
${userPrompt}

Candidates Under Review:
${candidateSummary}

INSTRUCTIONS:
1. Carefully compare all candidates on correctness, efficiency, architectural cleanliness, and edge-case resilience.
2. Assign each candidate a score from 0.0 to 10.0.
3. State your chosen best candidate and a brief reasoning sentence.

Format your response EXACTLY as follows:
CANDIDATE_EVALUATION:
Candidate [index]: Score [0-10]
...
BEST_CANDIDATE: Candidate [winning index]
CONSENSUS_REASONING: [one concise sentence explaining your pick]
`

  const judgePromises = judgePanel.map(async (judge, jIdx) => {
    const label = judge.label || slotLabel(judge)
    try {
      const abortCtrl = new AbortController()
      if (signal) {
        signal.addEventListener('abort', () => abortCtrl.abort(signal.reason || new Error('Turn aborted')), { once: true })
      }
      const timer = setTimeout(() => abortCtrl.abort(new Error('Judge evaluation timeout')), timeoutMs)
      timer.unref?.()

      const res = await callLlm({
        provider: judge.provider,
        model: judge.model,
        messages: [
          { role: 'system', content: 'You are an objective AI code evaluation judge.' },
          { role: 'user', content: judgePrompt },
        ],
        signal: abortCtrl.signal,
      })

      clearTimeout(timer)

      const text = typeof res === 'string' ? res : (res?.content || res?.text || '')
      // Preserve active candidate indices rather than assuming 1..N (#166)
      const evalResult = parseJudgeEvaluation(text, activeCandidates)

      // Track usage and cost (#168)
      const usage = (typeof res === 'object' && res?.usage) ? res.usage : {
        inputTokens: Math.max(1, Math.round((judgePrompt.length + 50) / 4)),
        outputTokens: Math.max(1, Math.round(text.length / 4)),
      }
      const costInfo = estimateTokenCost(judge, usage, prices)

      return {
        judgeIndex: jIdx + 1,
        judgeLabel: label,
        ok: true,
        usage,
        costUsd: costInfo.costUsd || 0,
        ...evalResult,
      }
    } catch (err) {
      return {
        judgeIndex: jIdx + 1,
        judgeLabel: label,
        ok: false,
        bestCandidate: activeCandidates[0].index,
        scores: {},
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
        reasoning: err?.message || String(err),
      }
    }
  })

  const results = await Promise.all(judgePromises)
  const validResults = results.filter((r) => r.ok)

  // Accumulate total usage and cost across all judges (#168)
  let sumInTokens = 0
  let sumOutTokens = 0
  let sumCostUsd = 0
  for (const r of results) {
    if (r.usage) {
      sumInTokens += r.usage.inputTokens || r.usage.promptTokens || 0
      sumOutTokens += r.usage.outputTokens || r.usage.completionTokens || 0
    }
    if (typeof r.costUsd === 'number') {
      sumCostUsd += r.costUsd
    }
  }
  const totalUsage = {
    inputTokens: sumInTokens,
    outputTokens: sumOutTokens,
    totalTokens: sumInTokens + sumOutTokens,
    costUsd: Number(sumCostUsd.toFixed(5)),
  }
  const totalCostUsd = totalUsage.costUsd

  // #165: If all judges failed, consensus is false with 0 votes
  if (validResults.length === 0) {
    return {
      consensus: false,
      winningCandidateIndex: activeCandidates[0].index,
      winningCandidateLabel: activeCandidates[0].label,
      strategy,
      isUnanimous: false,
      votes: {},
      averageScores: {},
      judgesResults: results,
      totalUsage,
      totalCostUsd,
      reason: 'all_judges_failed',
    }
  }

  // Tally votes and compute average scores
  const votes = {}
  const totalScores = {}
  const scoreCounts = {}

  for (const vr of validResults) {
    votes[vr.bestCandidate] = (votes[vr.bestCandidate] || 0) + 1
    for (const [candIdx, sc] of Object.entries(vr.scores)) {
      totalScores[candIdx] = (totalScores[candIdx] || 0) + sc
      scoreCounts[candIdx] = (scoreCounts[candIdx] || 0) + 1
    }
  }

  const averageScores = {}
  for (const [candIdx, sum] of Object.entries(totalScores)) {
    averageScores[candIdx] = Number((sum / (scoreCounts[candIdx] || 1)).toFixed(2))
  }

  let winner = activeCandidates[0].index
  let isUnanimous = false
  let hasConsensus = true

  if (strategy === 'highest_score') {
    let highestAvg = -1
    for (const c of activeCandidates) {
      const avg = averageScores[c.index] ?? -1
      if (avg > highestAvg) {
        highestAvg = avg
        winner = c.index
      }
    }
    hasConsensus = validResults.length > 0
  } else {
    // majority or unanimous
    let maxVotes = -1
    for (const [cIdxStr, count] of Object.entries(votes)) {
      const cIdx = parseInt(cIdxStr, 10)
      if (count > maxVotes) {
        maxVotes = count
        winner = cIdx
      }
    }
    isUnanimous = (votes[winner] || 0) === validResults.length && validResults.length > 0
    if (strategy === 'unanimous') {
      hasConsensus = isUnanimous && validResults.length > 0
    } else {
      hasConsensus = maxVotes > (validResults.length / 2) || validResults.length === 1
    }
  }

  const winningCand = activeCandidates.find((c) => c.index === winner) || activeCandidates[0]
  const winnerVotes = votes[winner] || 0
  const winnerLabel = blind ? '' : ` (${winningCand.label})`
  const consensusReport = `Multi-judge consensus (${strategy}): Candidate ${winner}${winnerLabel} won with ${winnerVotes}/${validResults.length} votes.`

  if (typeof onProgress === 'function') {
    onProgress(`⚖️ *${consensusReport}*\n`)
  }

  return {
    consensus: hasConsensus,
    winningCandidateIndex: winningCand.index,
    winningCandidateLabel: winningCand.label,
    strategy,
    isUnanimous,
    votes,
    averageScores,
    judgesResults: results,
    totalUsage,
    totalCostUsd,
    consensusReport,
  }
}
