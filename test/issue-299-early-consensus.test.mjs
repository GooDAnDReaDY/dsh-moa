import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeForConsensus,
  calculateSimilarity,
  checkSemanticConsensus,
  estimateSkippedJudgeUsage,
  stageEarlyConsensus,
} from '../lib/pipeline/early-consensus.js'

test('early-consensus: normalizeForConsensus strips comments and normalizes whitespace', () => {
  const codeWithComments = `
    // single line comment
    const a = 10; /* block comment */
    # python style
    function test() {
      return a * 2;
    }
  `
  const normalized = normalizeForConsensus(codeWithComments)
  assert.ok(!normalized.includes('single line comment'))
  assert.ok(!normalized.includes('block comment'))
  assert.ok(!normalized.includes('python style'))
  assert.ok(normalized.includes('const a = 10;'))
  assert.ok(normalized.includes('function test()'))
})

test('early-consensus: calculateSimilarity returns 1.0 for exact/comment-only diffs and high score for near-duplicates', () => {
  const code1 = 'function add(a, b) {\n  // returns sum\n  return a + b;\n}'
  const code2 = 'function add(a, b) {\n  return a + b;\n}'
  const sim = calculateSimilarity(code1, code2)
  assert.equal(sim, 1.0)

  const code3 = 'function add(a, b) {\n  const res = a + b;\n  return res;\n}'
  const nearSim = calculateSimilarity(code1, code3)
  assert.ok(nearSim >= 0.7 && nearSim < 1.0)

  const diffCode = 'class DatabaseConnectionPool { connect() {} }'
  const lowSim = calculateSimilarity(code1, diffCode)
  assert.ok(lowSim < 0.45)
})

test('early-consensus: checkSemanticConsensus detects consensus above threshold', () => {
  const candidates = [
    {
      index: 1,
      label: 'model-a',
      text: '```js\nfunction fib(n) { if (n <= 1) return n; return fib(n-1) + fib(n-2); }\n```',
    },
    {
      index: 2,
      label: 'model-b',
      text: '```js\nfunction fib(n) {\n  // recursion\n  if (n <= 1) return n;\n  return fib(n-1) + fib(n-2);\n}\n```',
    },
    {
      index: 3,
      label: 'model-c',
      text: '```js\nconst fib = n => n <= 1 ? n : fib(n-1) + fib(n-2);\n```',
    },
  ]

  const consensus = checkSemanticConsensus(candidates, 0.95)
  assert.equal(consensus.reached, true)
  assert.ok(consensus.similarity >= 0.95)
  assert.ok(consensus.winnerIndex === 1 || consensus.winnerIndex === 2)
  assert.equal(consensus.consensusIndices.length >= 2, true)
})

test('early-consensus: checkSemanticConsensus returns reached=false when candidates diverge', () => {
  const candidates = [
    { index: 1, label: 'model-a', text: 'function sort(arr) { return arr.sort(); }' },
    { index: 2, label: 'model-b', text: 'function quicksort(arr) { /* custom implementation */ }' },
  ]
  const consensus = checkSemanticConsensus(candidates, 0.95)
  assert.equal(consensus.reached, false)
  assert.ok(consensus.similarity < 0.95)
})

test('early-consensus: estimateSkippedJudgeUsage estimates tokens and cost accurately', () => {
  const candidates = [
    { text: '1234567890'.repeat(100), usage: { totalTokens: 250 } },
    { text: '1234567890'.repeat(100), usage: { totalTokens: 250 } },
  ]
  const prompt = 'Implement algorithm'
  const usage = estimateSkippedJudgeUsage(candidates, prompt, 4096, {})
  assert.ok(usage.skippedTokens > 0)
  assert.equal(typeof usage.skippedTokens, 'number')
  assert.equal(typeof usage.skippedCostUsd, 'number')
})

test('early-consensus: stageEarlyConsensus bypasses synthesis when enabled and consensus is met', async () => {
  const mockCandidates = [
    {
      index: 1,
      label: 'cand-1',
      text: 'export function hello() { return "world"; }',
      usage: { totalTokens: 100 },
      costUsd: 0.001,
      files: [],
    },
    {
      index: 2,
      label: 'cand-2',
      text: 'export function hello() {\n  // comment\n  return "world";\n}',
      usage: { totalTokens: 110 },
      costUsd: 0.0011,
      files: [],
    },
  ]

  const emittedEvents = []
  const mockCtx = {
    emit: (name, payload) => emittedEvents.push({ name, payload }),
  }

  const result = await stageEarlyConsensus({
    successfulRefs: mockCandidates,
    referenceOutputs: mockCandidates,
    preset: {
      name: 'test-preset',
      early_exit_consensus_enabled: true,
      early_exit_threshold: 0.95,
    },
    userPrompt: 'Write hello world function',
    prices: {},
    maxTokens: 2048,
    cwd: process.cwd(),
    runId: 'test-run-123',
    signal: null,
    promoteOpts: {},
    isRefinement: false,
    startTime: Date.now(),
    collectedCtx: null,
    liveCanvas: null,
    ctx: mockCtx,
  })

  assert.equal(result.ok, true)
  assert.equal(result.consensusReached, true)
  assert.ok(result.payload)
  assert.equal(result.payload.aggregator, 'Early Consensus (Bypassed)')
  assert.equal(result.payload.isEarlyConsensus, true)
  assert.ok(result.payload.usage.skippedJudgeTokens > 0)
  assert.ok(emittedEvents.some((e) => e.name === 'moa/early-consensus'))
})

