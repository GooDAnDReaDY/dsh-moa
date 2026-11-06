/**
 * Blind Embedding Clustering for Zero-LLM Fast Consensus (#312)
 *
 * Clusters candidate responses using local high-dimensional n-gram semantic embeddings.
 * When a dominant cluster exhibits high semantic convergence (cosine similarity >= threshold),
 * the plugin automatically promotes the cluster centroid candidate without invoking
 * the expensive LLM Judge, saving significant tokens and latency.
 */

import { logger } from '../logger.js'
import { promoteCandidateWorkspace, cleanMoaWorkspaces } from '../workspace/fs.js'
import { createPromotedPreview } from '../live-canvas.js'
import { recordMoaRunAsync, candidatesForHistory } from '../history.js'
import { emitEvent, MOA_EVENTS } from '../events.js'
import { estimateTokenCost } from '../pricing.js'

const EMBEDDING_DIMENSIONS = 1024

/**
 * 32-bit FNV-1a hash function for strings
 * @param {string} str
 * @returns {number}
 */
export function fnv1a32(str) {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Normalizes text/code for embedding extraction.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text = '') {
  if (typeof text !== 'string') return ''
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/(^|\s)#.*$/gm, '$1')
    .replace(/\r?\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Generates a unit-normalized Float32Array embedding vector from text
 * using word tokens, code operators, and character n-grams.
 * @param {string} text
 * @param {number} [dimensions=1024]
 * @returns {Float32Array}
 */
export function generateEmbedding(text = '', dimensions = EMBEDDING_DIMENSIONS) {
  const vector = new Float32Array(dimensions)
  const normalized = normalizeText(text)
  if (!normalized) return vector

  // 1. Tokens including keywords, identifiers, and syntax operators
  const tokens = normalized.match(/[a-z0-9_$]+|===|!==|<=|>=|=>|\+\+|--|&&|\|\||\.\.\.|[{}()[\];,+\-*\/%=<>!&|^~?:.]/g) || []
  const counts = new Map()

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const h = fnv1a32(t) % dimensions
    counts.set(h, (counts.get(h) || 0) + 1.2)

    // Token bigrams
    if (i < tokens.length - 1) {
      const bigram = `${t}_${tokens[i + 1]}`
      const h2 = fnv1a32(bigram) % dimensions
      counts.set(h2, (counts.get(h2) || 0) + 0.8)
    }
  }

  // 2. Character 3-grams for morphology and syntax
  const charSpan = Math.min(normalized.length, 12000)
  for (let i = 0; i <= charSpan - 3; i++) {
    const trigram = normalized.slice(i, i + 3)
    const h3 = fnv1a32(trigram) % dimensions
    counts.set(h3, (counts.get(h3) || 0) + 0.3)
  }

  // 3. Sublinear TF weighting: 1 + ln(count)
  let sumSq = 0
  for (const [bucket, count] of counts.entries()) {
    const val = 1 + Math.log(count)
    vector[bucket] = val
    sumSq += val * val
  }

  // 4. L2 Normalization
  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq)
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm
    }
  }

  return vector
}

/**
 * Computes cosine similarity between two unit-normalized vectors.
 * Dot product equals cosine similarity for unit vectors.
 * @param {Float32Array} vecA
 * @param {Float32Array} vecB
 * @returns {number}
 */
export function computeCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0.0
  let dot = 0
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i]
  }
  const clamped = Math.max(0.0, Math.min(1.0, dot))
  return Number(clamped.toFixed(4))
}

/**
 * Builds pairwise cosine similarity matrix for candidate solutions.
 * @param {Array<object>} candidates
 * @returns {{ vectors: Float32Array[], matrix: number[][] }}
 */
export function buildSimilarityMatrix(candidates = []) {
  const n = candidates.length
  const vectors = candidates.map((c) => generateEmbedding(c.text || ''))
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0
    for (let j = i + 1; j < n; j++) {
      const sim = computeCosineSimilarity(vectors[i], vectors[j])
      matrix[i][j] = sim
      matrix[j][i] = sim
    }
  }

  return { vectors, matrix }
}

/**
 * Clusters candidate embeddings and determines if consensus was reached.
 * @param {Array<object>} candidates
 * @param {object} [options={}]
 * @returns {object}
 */
export function clusterCandidateEmbeddings(candidates = [], options = {}) {
  const threshold = typeof options.threshold === 'number' ? options.threshold : 0.88
  const fallbackToJudgeOnSplit = options.fallbackToJudgeOnSplit !== false
  const minMajorityRatio = typeof options.minMajorityRatio === 'number' ? options.minMajorityRatio : 0.60

  if (!Array.isArray(candidates) || candidates.length < 2) {
    return {
      consensusReached: false,
      threshold,
      clusters: [],
      dominantCluster: null,
      centroidCandidate: null,
      centroidIndex: 0,
      similarityMatrix: [],
      fallbackToJudge: fallbackToJudgeOnSplit,
      reason: 'Insufficient candidates (need at least 2)',
    }
  }

  const n = candidates.length
  const { vectors, matrix } = buildSimilarityMatrix(candidates)

  // Threshold clustering: connect candidates with pairwise similarity >= threshold
  const clusters = []
  const assigned = new Set()

  for (let i = 0; i < n; i++) {
    if (assigned.has(i)) continue
    const clusterMembers = [i]
    assigned.add(i)

    // Find all peers reachable with similarity >= threshold
    for (let j = 0; j < n; j++) {
      if (assigned.has(j)) continue
      // Qualifies if similarity to cluster seed or average to cluster >= threshold
      const simToSeed = matrix[i][j]
      const avgSim = clusterMembers.reduce((sum, idx) => sum + matrix[j][idx], 0) / clusterMembers.length
      if (simToSeed >= threshold || avgSim >= threshold) {
        clusterMembers.push(j)
        assigned.add(j)
      }
    }
    clusters.push(clusterMembers)
  }

  // Find dominant cluster (maximum members)
  clusters.sort((a, b) => b.length - a.length)
  const largestCluster = clusters[0] || []

  // Compute intra-cluster average similarity
  let intraClusterSimSum = 0
  let pairCount = 0
  for (let a = 0; a < largestCluster.length; a++) {
    for (let b = a + 1; b < largestCluster.length; b++) {
      intraClusterSimSum += matrix[largestCluster[a]][largestCluster[b]]
      pairCount++
    }
  }
  const avgIntraSimilarity = pairCount > 0 ? Number((intraClusterSimSum / pairCount).toFixed(4)) : 1.0

  // Majority condition: cluster has >= required members and high internal similarity
  const requiredCount = Math.max(2, Math.ceil(n * minMajorityRatio))
  const consensusReached = largestCluster.length >= requiredCount && (avgIntraSimilarity >= threshold || largestCluster.length === n)

  let centroidIndex = -1
  let centroidCandidate = null

  if (consensusReached) {
    // Select centroid: member with highest average similarity to peers in the dominant cluster
    let bestAvgSim = -1
    for (const idx of largestCluster) {
      let simTotal = 0
      for (const peerIdx of largestCluster) {
        if (idx !== peerIdx) simTotal += matrix[idx][peerIdx]
      }
      const candidateAvg = largestCluster.length > 1 ? simTotal / (largestCluster.length - 1) : 1.0

      // Favor syntactically valid candidates in tie/near-tie situations
      const hasSyntaxError = candidates[idx].syntaxValidation?.valid === false
      const adjustedScore = candidateAvg - (hasSyntaxError ? 0.05 : 0)

      if (adjustedScore > bestAvgSim) {
        bestAvgSim = adjustedScore
        centroidIndex = idx
      }
    }

    centroidCandidate = candidates[centroidIndex] || null
  }

  const dominantClusterInfo = {
    size: largestCluster.length,
    memberIndices: largestCluster.map((i) => candidates[i].index ?? (i + 1)),
    avgSimilarity: avgIntraSimilarity,
  }

  return {
    consensusReached,
    threshold,
    dominantCluster: dominantClusterInfo,
    clusters: clusters.map((c, id) => ({
      id,
      size: c.length,
      indices: c.map((i) => candidates[i].index ?? (i + 1)),
    })),
    centroidCandidate,
    centroidIndex: centroidCandidate ? (centroidCandidate.index ?? (centroidIndex + 1)) : 0,
    similarityMatrix: matrix,
    fallbackToJudge: !consensusReached && fallbackToJudgeOnSplit,
    reason: consensusReached
      ? `Blind embedding consensus reached (${largestCluster.length}/${n} models converged with avg similarity ${avgIntraSimilarity} >= ${threshold})`
      : `No dominant embedding cluster converged (largest has ${largestCluster.length}/${n} with avg sim ${avgIntraSimilarity} < ${threshold})`,
  }
}

/**
 * Estimates saved tokens and USD cost from bypassing the judge round.
 * @param {Array<object>} candidates
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @param {object} prices
 * @returns {{ skippedTokens: number, skippedCostUsd: number }}
 */
export function estimateSkippedJudgeUsage(candidates = [], userPrompt = '', maxTokens = 4096, prices = {}) {
  const candidateChars = candidates.reduce((acc, c) => acc + (c.text?.length || 0), 0)
  const promptChars = userPrompt.length
  const estimatedInputTokens = Math.round((candidateChars + promptChars) / 3.8)
  const estimatedOutputTokens = Math.min(maxTokens, 1500)
  const skippedTokens = estimatedInputTokens + estimatedOutputTokens

  const costEst = estimateTokenCost({
    provider: 'default',
    model: 'judge',
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
    prices,
  })

  return {
    skippedTokens,
    skippedCostUsd: Number((costEst?.costUsd || 0.005).toFixed(5)),
  }
}

/**
 * Evaluates candidate responses for blind embedding clustering and executes fast zero-LLM consensus if reached.
 * @param {object} params
 * @returns {Promise<{ ok: boolean, consensusReached: boolean, payload?: object, error?: Error, abort?: boolean }>}
 */
export async function stageEmbeddingClustering({
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
  const enabled = Boolean(preset?.embedding_clustering_enabled || preset?.embeddingClusteringEnabled)
  const threshold = typeof (preset?.embedding_consensus_threshold ?? preset?.embeddingConsensusThreshold) === 'number'
    ? (preset.embedding_consensus_threshold ?? preset.embeddingConsensusThreshold)
    : 0.88
  const fallbackToJudgeOnSplit = (preset?.fallback_to_judge_on_split ?? preset?.fallbackToJudgeOnSplit) !== false

  if (!enabled || successfulRefs.length < 2) {
    return { ok: true, consensusReached: false }
  }

  const result = clusterCandidateEmbeddings(successfulRefs, {
    threshold,
    fallbackToJudgeOnSplit,
  })

  emitEvent(ctx, MOA_EVENTS.EMBEDDING_CLUSTER, {
    runId,
    consensusReached: result.consensusReached,
    threshold,
    dominantCluster: result.dominantCluster,
    clusters: result.clusters,
    centroidIndex: result.centroidIndex,
    fallbackToJudge: result.fallbackToJudge,
    reason: result.reason,
  })

  if (!result.consensusReached || !result.centroidCandidate) {
    logger.info(`[dsh-moa] Embedding clustering: ${result.reason}. Proceeding to arbitration.`)
    return { ok: true, consensusReached: false, fallbackToJudge: result.fallbackToJudge }
  }

  const winner = result.centroidCandidate
  logger.info(`[dsh-moa] Blind embedding fast consensus reached! Winner centroid: candidate ${result.centroidIndex}`)

  // Promote centroid candidate files to project workspace
  let promotedFiles = []
  let promoteErr = null
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
      isEmbeddingConsensus: true,
      candidates: candidatesForHistory(referenceOutputs),
      aggregator: 'Blind Embedding Consensus (Bypassed)',
      winnerIndex: winner.index,
      winnerModel: winner.label,
      promotedFiles,
      totalTokens,
      totalCostUsd,
      skippedJudgeTokens: skippedUsage.skippedTokens,
      durationMs,
    }, historyFilePath || undefined)
  } catch (histErr) {
    logger.warn('[dsh-moa] Failed to record embedding consensus in history:', histErr?.message || histErr)
  }

  emitEvent(ctx, MOA_EVENTS.RUN_FINISH, {
    runId,
    durationMs,
    totalTokens,
    totalCostUsd,
    promotedFiles,
    winnerIndex: winner.index,
    isEarlyConsensus: true,
    isEmbeddingConsensus: true,
  })

  return {
    ok: true,
    consensusReached: true,
    payload: {
      kind: 'synthesis',
      content: winner.text,
      aggregator: 'Blind Embedding Consensus (Bypassed)',
      references: referenceOutputs,
      presetName: preset?.name || 'default',
      isRefinement,
      isEarlyConsensus: true,
      isEmbeddingConsensus: true,
      winningIndex: winner.index,
      winnerModel: winner.label,
      promotedFiles,
      runId,
      embeddingInfo: {
        dominantCluster: result.dominantCluster,
        threshold,
        clusters: result.clusters,
        centroidIndex: result.centroidIndex,
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
