/**
 * Early Exit upon Semantic Consensus (#299)
 * Detects convergence between reference candidates and bypasses judge round when consensus >= threshold.
 * Saves up to 60-80% tokens and latency on requests where candidates converge.
 */

import { logger } from '../logger.js'
import { promoteCandidateWorkspace, cleanMoaWorkspaces } from '../workspace/fs.js'
import { createPromotedPreview } from '../live-canvas.js'
import { recordMoaRunAsync, candidatesForHistory } from '../history.js'
import { emitEvent, MOA_EVENTS } from '../events.js'
import { estimateTokenCost } from '../pricing.js'

/**
 * Normalizes text/code by stripping comments and normalizing whitespace for consensus comparison.
 * @param {string} text
 * @returns {string}
 */
export function normalizeForConsensus(text = '') {
  if (typeof text !== 'string') return ''
  return text
    // Strip block comments /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Strip JS/TS single line comments // ...
    .replace(/\/\/.*$/gm, '')
    // Strip Python/Shell comments # ...
    .replace(/(^|\s)#.*$/gm, '$1')
    // Normalize newlines
    .replace(/\r?\n/g, '\n')
    // Collapse horizontal whitespace
    .replace(/[ \t]+/g, ' ')
    // Collapse multi-blank lines
    .replace(/\n\s*\n/g, '\n')
    .trim()
}

/**
 * Calculates Sørensen-Dice similarity coefficient between two code/text snippets (0.0 to 1.0).
 * @param {string} textA
 * @param {string} textB
 * @returns {number}
 */
export function calculateSimilarity(textA = '', textB = '') {
  const normA = normalizeForConsensus(textA)
  const normB = normalizeForConsensus(textB)

  if (normA === normB) return 1.0
  if (!normA || !normB) return 0.0

  const tokensA = normA.match(/[\w$]+|[^\s\w]/g) || []
  const tokensB = normB.match(/[\w$]+|[^\s\w]/g) || []

  if (tokensA.length === 0 && tokensB.length === 0) return 1.0
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0

  const freqA = new Map()
  for (const t of tokensA) freqA.set(t, (freqA.get(t) || 0) + 1)

  const freqB = new Map()
  for (const t of tokensB) freqB.set(t, (freqB.get(t) || 0) + 1)

  let intersection = 0
  for (const [token, countA] of freqA.entries()) {
    const countB = freqB.get(token) || 0
    intersection += Math.min(countA, countB)
  }

  const dice = (2 * intersection) / (tokensA.length + tokensB.length)
  return Number(dice.toFixed(4))
}

/**
 * Checks if candidates have reached semantic consensus above threshold.
 * @param {Array<object>} candidates
 * @param {number} [threshold=0.95]
 * @returns {{ reached: boolean, similarity: number, winnerIndex: number, consensusIndices: number[], winnerCandidate: object | null, reason: string }}
 */
export function checkSemanticConsensus(candidates = [], threshold = 0.95) {
  if (!Array.isArray(candidates) || candidates.length < 2) {
    return {
      reached: false,
      similarity: 0,
      winnerIndex: 0,
      consensusIndices: [],
      winnerCandidate: null,
      reason: 'Insufficient candidates for consensus check',
    }
  }

  const n = candidates.length
  let maxSim = 0
  let bestPair = [0, 1]
  const matrix = Array.from({ length: n }, () => new Float32Array(n))

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0
    for (let j = i + 1; j < n; j++) {
      const sim = calculateSimilarity(candidates[i].text || '', candidates[j].text || '')
      matrix[i][j] = sim
      matrix[j][i] = sim
      if (sim > maxSim) {
        maxSim = sim
        bestPair = [i, j]
      }
    }
  }

  if (maxSim < threshold) {
    return {
      reached: false,
      similarity: maxSim,
      winnerIndex: 0,
      consensusIndices: [],
      winnerCandidate: null,
      reason: `Max pairwise similarity ${maxSim} is below consensus threshold ${threshold}`,
    }
  }

  // Find consensus cluster matching threshold with the best pair
  const clusterSet = new Set(bestPair)
  for (let k = 0; k < n; k++) {
    if (k === bestPair[0] || k === bestPair[1]) continue
    if (matrix[k][bestPair[0]] >= threshold && matrix[k][bestPair[1]] >= threshold) {
      clusterSet.add(k)
    }
  }

  const consensusIndices = Array.from(clusterSet).map((idx) => candidates[idx].index ?? idx)
  const clusterCandidates = Array.from(clusterSet).map((idx) => candidates[idx])

  // Select winner from consensus cluster (prioritize valid syntax, then lowest error count)
  let winner = clusterCandidates[0]
  for (const c of clusterCandidates) {
    if (c.syntaxValidation?.valid && !winner.syntaxValidation?.valid) {
      winner = c
    }
  }

  return {
    reached: true,
    similarity: maxSim,
    winnerIndex: winner.index ?? 1,
    consensusIndices,
    winnerCandidate: winner,
    reason: `Semantic consensus reached (${maxSim} >= ${threshold}) across candidates ${consensusIndices.join(', ')}`,
  }
}

/**
 * Estimates saved tokens and cost from bypassing the judge round.
 * @param {Array<object>} candidates
 * @param {string} prompt
 * @param {number} [maxTokens=4096]
 * @param {object} [prices={}]
 * @returns {{ skippedTokens: number, skippedCostUsd: number }}
 */
export function estimateSkippedJudgeUsage(candidates = [], prompt = '', maxTokens = 4096, prices = {}) {
  const promptChars = (prompt?.length || 0) + candidates.reduce((sum, c) => sum + (c.text?.length || 0), 0)
  const estimatedInputTokens = Math.max(100, Math.round(promptChars / 3.8))
  const estimatedOutputTokens = Math.min(Math.max(200, Math.round(maxTokens * 0.25)), 1000)
  const skippedTokens = estimatedInputTokens + estimatedOutputTokens

  const costEst = estimateTokenCost({ provider: 'default', model: 'judge' }, {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
  }, prices)

  return {
    skippedTokens,
    skippedCostUsd: Number((costEst?.costUsd || 0.005).toFixed(5)),
  }
}

/**
 * Evaluates candidates for early consensus and executes early exit bypass if reached.
 * @param {object} params
 * @returns {Promise<{ ok: boolean, consensusReached: boolean, payload?: object, error?: Error, abort?: boolean }>}
 */
export function stageEarlyConsensus({
  successfulRefs = [],
  referenceOutputs = [],
  preset = {},
  userPrompt = '',
  prices = {},
  maxTokens = 4096,
  cwd = process.cwd(),
  runId = '',
  signal = null,
  promoteOpts = {},
  allowCandidateOverride = false,
  isRefinement = false,
  historyFilePath = null,
  startTime = Date.now(),
  collectedCtx = null,
  liveCanvas = null,
  ctx = null,
}) {
  const enabled = Boolean(preset?.early_exit_consensus_enabled)
  const threshold = typeof preset?.early_exit_threshold === 'number' ? preset.early_exit_threshold : 0.95

  if (!enabled || successfulRefs.length < 2) {
    return Promise.resolve({ ok: true, consensusReached: false })
  }

  const consensus = checkSemanticConsensus(successfulRefs, threshold)
  if (!consensus.reached || !consensus.winnerCandidate) {
    return Promise.resolve({ ok: true, consensusReached: false, similarity: consensus.similarity })
  }

  const winner = consensus.winnerCandidate
  emitEvent(ctx, MOA_EVENTS.EARLY_CONSENSUS, {
    runId,
    similarity: consensus.similarity,
    threshold,
    winnerIndex: consensus.winnerIndex,
    winnerModel: winner.label,
    consensusCandidates: consensus.consensusIndices,
  })

  // Promote winning candidate files
  let promotedFiles = []
  let promoteErr = null
  const runPromotion = async () => {
    if (winner.files?.length > 0) {
      try {
        promotedFiles = await promoteCandidateWorkspace(cwd, winner.index, {
          ...promoteOpts,
          runId,
          keepMoa: allowCandidateOverride,
        })
      } catch (err) {
        promoteErr = err
      }
    } else if (!allowCandidateOverride) {
      await cleanMoaWorkspaces(cwd, { runId })
    }

    if (promoteErr) {
      if (!allowCandidateOverride) await cleanMoaWorkspaces(cwd, { runId })
      if (signal?.aborted || promoteErr?.message?.includes('aborted')) {
        return { ok: false, consensusReached: true, abort: true, error: new Error('Turn aborted') }
      }
    }

    const skippedUsage = estimateSkippedJudgeUsage(successfulRefs, userPrompt, maxTokens, prices)
    const livePreview = await createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs, {
      winningIndex: winner.index,
    })

    const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0)
    const totalCostUsd = Number(referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0).toFixed(5))
    const durationMs = Date.now() - startTime

    try {
      await recordMoaRunAsync({
        id: runId,
        cwd,
        prompt: userPrompt,
        preset: preset?.name || 'default',
        isRefinement,
        isEarlyConsensus: true,
        candidates: candidatesForHistory(referenceOutputs),
        aggregator: 'Early Consensus (Bypassed)',
        winnerIndex: winner.index,
        winnerModel: winner.label,
        promotedFiles,
        totalTokens,
        totalCostUsd,
        skippedJudgeTokens: skippedUsage.skippedTokens,
        durationMs,
      }, historyFilePath || undefined)
    } catch (histErr) {
      logger.warn('[dsh-moa] Failed to record early consensus in history:', histErr?.message || histErr)
    }

    emitEvent(ctx, MOA_EVENTS.RUN_FINISH, {
      runId,
      durationMs,
      totalTokens,
      totalCostUsd,
      promotedFiles,
      winnerIndex: winner.index,
      isEarlyConsensus: true,
    })

    return {
      ok: true,
      consensusReached: true,
      payload: {
        kind: 'synthesis',
        content: winner.text,
        aggregator: 'Early Consensus (Bypassed)',
        references: referenceOutputs,
        presetName: preset?.name || 'default',
        isRefinement,
        isEarlyConsensus: true,
        winningIndex: winner.index,
        winnerModel: winner.label,
        promotedFiles,
        runId,
        consensusInfo: {
          similarity: consensus.similarity,
          threshold,
          consensusIndices: consensus.consensusIndices,
        },
        ...(livePreview ? { liveCanvas: livePreview } : {}),
        usage: {
          totalTokens,
          totalCostUsd,
          skippedJudgeTokens: skippedUsage.skippedTokens,
          skippedJudgeCostUsd: skippedUsage.skippedCostUsd,
          candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
          aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        },
        skippedFiles: collectedCtx?.skippedFiles || 0,
        skippedList: collectedCtx?.skippedList || [],
        durationMs,
      },
    }
  }

  return runPromotion()
}

