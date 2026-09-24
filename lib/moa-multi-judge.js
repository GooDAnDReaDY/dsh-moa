/**
 * Multi-Judge Panel Consensus Voting & Composite Hybrid Synthesis
 * Feature 2 (Multi-Judge Panel) & Feature 3 (Composite Block Synthesis)
 */

import { slotLabel } from './moa-prompts.js'

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
 */
export function buildCompositeBlockDirectives(candidates = []) {
  const fileMap = new Map()

  for (const c of candidates) {
    if (!c.ok || !c.text) continue
    const blocks = extractCodeBlocks(c.text)
    for (const b of blocks) {
      if (b.filename) {
        if (!fileMap.has(b.filename)) {
          fileMap.set(b.filename, [])
        }
        fileMap.get(b.filename).push(c.label || `Candidate ${c.index}`)
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
 */
export function parseJudgeEvaluation(rawText = '', candidateCount = 2) {
  const scores = {}
  let bestCandidate = 1
  let reasoning = ''

  const scoreMatches = rawText.matchAll(/Candidate\s*(\d+)[:\s]+(?:Score\s*[:\s]*)?([0-9]+(?:\.[0-9]+)?)/gi)
  for (const m of scoreMatches) {
    const idx = parseInt(m[1], 10)
    const val = parseFloat(m[2])
    if (idx >= 1 && idx <= candidateCount && !Number.isNaN(val)) {
      scores[idx] = Math.min(10, Math.max(0, val))
    }
  }

  const bestMatch = rawText.match(/BEST_CANDIDATE\s*[:\s]+(?:Candidate\s*)?(\d+)/i)
  if (bestMatch) {
    const parsedBest = parseInt(bestMatch[1], 10)
    if (parsedBest >= 1 && parsedBest <= candidateCount) {
      bestCandidate = parsedBest
    }
  } else {
    // Find candidate with max parsed score
    let maxScore = -1
    for (const [idxStr, s] of Object.entries(scores)) {
      if (s > maxScore) {
        maxScore = s
        bestCandidate = parseInt(idxStr, 10)
      }
    }
  }

  const reasonMatch = rawText.match(/CONSENSUS_REASONING\s*[:\s]+([^\n\r]+)/i)
  if (reasonMatch) {
    reasoning = reasonMatch[1].trim()
  } else {
    reasoning = rawText.slice(0, 180).replace(/\n/g, ' ').trim()
  }

  return { scores, bestCandidate, reasoning }
}

/**
 * Executes a panel of judges to reach consensus on candidate solutions.
 */
export async function executeMultiJudgePanel({
  judges = [],
  candidates = [],
  userPrompt = '',
  callLlm,
  strategy = 'majority', // 'majority' | 'highest_score' | 'unanimous'
  timeoutMs = 45000,
  signal,
  onProgress,
}) {
  const activeCandidates = (candidates || []).filter((c) => c && c.ok)
  if (activeCandidates.length === 0) {
    return {
      consensus: false,
      winningCandidateIndex: 1,
      strategy,
      reason: 'no_active_candidates',
    }
  }

  if (activeCandidates.length === 1) {
    return {
      consensus: true,
      winningCandidateIndex: activeCandidates[0].index,
      winningCandidateLabel: activeCandidates[0].label,
      strategy,
      reason: 'single_active_candidate',
    }
  }

  const judgeSlots = Array.isArray(judges) && judges.length > 0
    ? judges
    : [{ provider: 'default', model: 'aggregator-judge', label: 'Primary Judge' }]

  const candidateSummary = activeCandidates.map((c) => {
    return `### Candidate ${c.index} (${c.label}):\n${(c.text || '').slice(0, 4000)}`
  }).join('\n\n---\n\n')

  const judgePrompt = `You are an impartial Expert Code & Logic Judge evaluating multiple AI candidate solutions.
User Prompt:
${userPrompt.slice(0, 1000)}

Candidate Solutions:
${candidateSummary}

Evaluate the solutions on correctness, architecture, edge cases, and maintainability.
Rate each candidate on a scale of 1 to 10.
Pick the single best candidate.

Your response MUST follow this exact format:
SCORES:
${activeCandidates.map((c) => `Candidate ${c.index}: [1-10]`).join('\n')}
BEST_CANDIDATE: [index number]
CONSENSUS_REASONING: [one concise sentence explaining your pick]
`

  if (typeof onProgress === 'function') {
    onProgress(`⚖️ *Convening Multi-Judge Panel (${judgeSlots.length} judges, strategy: ${strategy})...*\n`)
  }

  const judgePromises = judgeSlots.map(async (judge, jIdx) => {
    const label = slotLabel(judge)
    try {
      const abortCtrl = new AbortController()
      if (signal) {
        signal.addEventListener('abort', () => abortCtrl.abort(), { once: true })
      }
      const timer = setTimeout(() => abortCtrl.abort(new Error('Judge evaluation timeout')), timeoutMs)
      timer.unref?.()

      const res = await callLlm({
        provider: judge.provider,
        model: judge.model,
        messages: [
          { role: 'system', content: 'You are an objective expert judge in an ensemble evaluation system.' },
          { role: 'user', content: judgePrompt },
        ],
        temperature: 0.1,
        maxTokens: 512,
        signal: abortCtrl.signal,
      })
      clearTimeout(timer)

      const text = typeof res === 'string' ? res : (res?.content || res?.text || '')
      const evalResult = parseJudgeEvaluation(text, candidates.length)

      return {
        judgeIndex: jIdx + 1,
        judgeLabel: label,
        ok: true,
        ...evalResult,
      }
    } catch (err) {
      return {
        judgeIndex: jIdx + 1,
        judgeLabel: label,
        ok: false,
        bestCandidate: 1,
        scores: {},
        reasoning: err?.message || String(err),
      }
    }
  })

  const results = await Promise.all(judgePromises)
  const validResults = results.filter((r) => r.ok)

  // Tally votes and compute average scores
  const votes = {}
  const totalScores = {}
  const scoreCounts = {}

  for (const r of validResults) {
    votes[r.bestCandidate] = (votes[r.bestCandidate] || 0) + 1
    for (const [cIdx, s] of Object.entries(r.scores || {})) {
      totalScores[cIdx] = (totalScores[cIdx] || 0) + s
      scoreCounts[cIdx] = (scoreCounts[cIdx] || 0) + 1
    }
  }

  const averageScores = {}
  for (const c of activeCandidates) {
    const cnt = scoreCounts[c.index] || 0
    averageScores[c.index] = cnt > 0 ? Number((totalScores[c.index] / cnt).toFixed(2)) : 5.0
  }

  let winner = activeCandidates[0].index
  let isUnanimous = false

  if (strategy === 'highest_score') {
    let highestAvg = -1
    for (const c of activeCandidates) {
      const avg = averageScores[c.index] || 0
      if (avg > highestAvg) {
        highestAvg = avg
        winner = c.index
      }
    }
  } else {
    // majority or unanimous
    let maxVotes = -1
    for (const c of activeCandidates) {
      const v = votes[c.index] || 0
      if (v > maxVotes) {
        maxVotes = v
        winner = c.index
      } else if (v === maxVotes && (averageScores[c.index] || 0) > (averageScores[winner] || 0)) {
        winner = c.index
      }
    }
    isUnanimous = (votes[winner] || 0) === validResults.length && validResults.length > 0
  }

  const winningCand = activeCandidates.find((c) => c.index === winner) || activeCandidates[0]

  const consensusReport = `Multi-Judge Consensus (${validResults.length}/${judgeSlots.length} judges): ` +
    `Winner is Candidate ${winningCand.index} (${winningCand.label}) with ${votes[winner] || 0} votes, ` +
    `avg score ${averageScores[winner] || 0}/10. Strategy: ${strategy}.`

  if (typeof onProgress === 'function') {
    onProgress(`🏁 *${consensusReport}*\n`)
  }

  return {
    consensus: true,
    winningCandidateIndex: winningCand.index,
    winningCandidateLabel: winningCand.label,
    strategy,
    isUnanimous,
    votes,
    averageScores,
    judgesResults: results,
    consensusReport,
  }
}
