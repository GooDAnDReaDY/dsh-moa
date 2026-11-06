import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  fnv1a32,
  normalizeText,
  generateEmbedding,
  computeCosineSimilarity,
  buildSimilarityMatrix,
  clusterCandidateEmbeddings,
  stageEmbeddingClustering,
} from '../lib/pipeline/embedding-clustering.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #312: Blind Embedding Clustering for Zero-LLM Fast Consensus', () => {
  it('generateEmbedding & computeCosineSimilarity: produces unit vectors and accurate cosine similarity', () => {
    const textA = 'function calculateSum(items) { return items.reduce((acc, val) => acc + val, 0); }'
    const textB = 'function calculateSum(list) { return list.reduce((total, x) => total + x, 0); }'
    const textC = 'class MatrixDatabaseEngine extends CloudStore { connect() {} }'

    const vecA = generateEmbedding(textA)
    const vecB = generateEmbedding(textB)
    const vecC = generateEmbedding(textC)

    assert.equal(vecA instanceof Float32Array, true)
    assert.equal(vecA.length, 1024)

    const simSelf = computeCosineSimilarity(vecA, vecA)
    assert.ok(Math.abs(simSelf - 1.0) < 0.001, `Expected ~1.0, got ${simSelf}`)

    const simAB = computeCosineSimilarity(vecA, vecB)
    const simAC = computeCosineSimilarity(vecA, vecC)

    assert.ok(simAB > 0.60, `Expected high similarity for similar implementations, got ${simAB}`)
    assert.ok(simAB > simAC, `Expected sim(A,B) [${simAB}] > sim(A,C) [${simAC}]`)
  })

  it('clusterCandidateEmbeddings: identifies dominant cluster and centroid candidate when candidates converge', () => {
    const candidate1 = {
      index: 1,
      label: 'Model A',
      text: 'function quicksort(arr) { if (arr.length <= 1) return arr; const pivot = arr[0]; return [...quicksort(arr.slice(1).filter(x => x <= pivot)), pivot, ...quicksort(arr.slice(1).filter(x => x > pivot))]; }',
    }
    const candidate2 = {
      index: 2,
      label: 'Model B',
      text: 'function quicksort(arr) { if (arr.length <= 1) return arr; const pivot = arr[0]; return [...quicksort(arr.slice(1).filter(item => item <= pivot)), pivot, ...quicksort(arr.slice(1).filter(item => item > pivot))]; }',
    }
    const candidate3 = {
      index: 3,
      label: 'Model C',
      text: 'function quicksort(list) { if (list.length <= 1) return list; const pivot = list[0]; return [...quicksort(list.slice(1).filter(x => x <= pivot)), pivot, ...quicksort(list.slice(1).filter(x => x > pivot))]; }',
    }
    const outlier = {
      index: 4,
      label: 'Model D',
      text: 'console.log("Completely different string and no sorting function implemented here at all!");',
    }

    const candidates = [candidate1, candidate2, candidate3, outlier]
    const result = clusterCandidateEmbeddings(candidates, { threshold: 0.80 })

    assert.equal(result.consensusReached, true)
    assert.ok(result.dominantCluster.size >= 3)
    assert.ok(result.centroidCandidate !== null)
    assert.ok([1, 2, 3].includes(result.centroidIndex))
  })

  it('clusterCandidateEmbeddings: fails consensus and flags fallbackToJudge on split opinions', () => {
    const candidate1 = { index: 1, text: 'export function renderCanvas() { return document.createElement("canvas"); }' }
    const candidate2 = { index: 2, text: 'export function parseXml(xml) { return new DOMParser().parseFromString(xml, "text/xml"); }' }
    const candidate3 = { index: 3, text: 'export async function fetchUser(id) { const res = await fetch(`/api/users/${id}`); return res.json(); }' }

    const candidates = [candidate1, candidate2, candidate3]
    const result = clusterCandidateEmbeddings(candidates, { threshold: 0.88, fallbackToJudgeOnSplit: true })

    assert.equal(result.consensusReached, false)
    assert.equal(result.fallbackToJudge, true)
    assert.equal(result.centroidCandidate, null)
    assert.ok(result.reason.includes('No dominant embedding cluster converged'))
  })

  it('stageEmbeddingClustering: executes zero-LLM fast consensus, emits events and bypasses judge', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const text = 'function calculateTax(subtotal, rate) { return subtotal * rate; }'
    const successfulRefs = [
      { index: 1, label: 'Model 1', text, files: [{ relativePath: 'tax.js', content: text }] },
      { index: 2, label: 'Model 2', text, files: [{ relativePath: 'tax.js', content: text }] },
    ]

    const res = await stageEmbeddingClustering({
      successfulRefs,
      referenceOutputs: successfulRefs,
      preset: {
        embedding_clustering_enabled: true,
        embedding_consensus_threshold: 0.88,
      },
      userPrompt: 'Calculate tax function',
      cwd: '/tmp',
      runId: 'test-run-embed-1',
      ctx: mockCtx,
    })

    assert.equal(res.ok, true)
    assert.equal(res.consensusReached, true)
    assert.equal(res.payload.kind, 'synthesis')
    assert.equal(res.payload.isEmbeddingConsensus, true)
    assert.equal(res.payload.aggregator, 'Blind Embedding Consensus (Bypassed)')
    assert.ok(res.payload.usage.skippedJudgeTokens > 0)

    const clusterEvt = events.find((e) => e.evt === MOA_EVENTS.EMBEDDING_CLUSTER)
    assert.ok(clusterEvt)
    assert.equal(clusterEvt.payload.consensusReached, true)

    const finishEvt = events.find((e) => e.evt === MOA_EVENTS.RUN_FINISH)
    assert.ok(finishEvt)
    assert.equal(finishEvt.payload.isEmbeddingConsensus, true)
  })

  it('stageEmbeddingClustering: gracefully returns consensusReached=false when opinions split', async () => {
    const successfulRefs = [
      { index: 1, label: 'Model 1', text: 'function renderA() {}' },
      { index: 2, label: 'Model 2', text: 'class DatabaseClusterManager {}' },
    ]

    const res = await stageEmbeddingClustering({
      successfulRefs,
      referenceOutputs: successfulRefs,
      preset: {
        embedding_clustering_enabled: true,
        embedding_consensus_threshold: 0.88,
      },
      userPrompt: 'Build app',
      runId: 'test-run-split',
    })

    assert.equal(res.ok, true)
    assert.equal(res.consensusReached, false)
    assert.equal(res.fallbackToJudge, true)
  })
})
