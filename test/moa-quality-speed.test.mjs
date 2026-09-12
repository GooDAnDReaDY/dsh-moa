import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

import {
  ANTIPATTERNS_RUBRIC,
  buildCuratorSynthesisPrompt,
  parseRecommendedAssembler,
  callWithTransientRetry,
  runReferencesParallel,
  runMoAPipeline,
} from '../lib/moa-runner.js'

test('quality: ANTIPATTERNS_RUBRIC contains essential engineering and UI checks', () => {
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Lazy Code & Placeholders'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Blind Mocking'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Silent Failures & Missing Error Handling'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('AI Slop UI & Poor Ergonomics'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Missing UI States'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Broken Layout & Mobile Incompatibility'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Monolithic God Objects & Overengineering'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Context Amnesia & Regressions'))
})

test('quality: buildCuratorSynthesisPrompt includes role, rubric, and recommended assembler instructions', () => {
  const refs = [
    { label: 'model-a', text: 'Solution A with clean logic', files: [{ relativePath: 'app.js' }] },
    { label: 'model-b', text: 'Solution B with great UI', files: [{ relativePath: 'style.css' }] },
  ]
  const prompt = buildCuratorSynthesisPrompt('Build interactive todo app', refs, 'Prefer vanilla JS')

  assert.ok(prompt.includes('Lead Technical Curator and Solution Architect'))
  assert.ok(prompt.includes('RECOMMENDED_ASSEMBLER: <number from 1 to N>'))
  assert.ok(prompt.includes('WINNER_CANDIDATE_INDEX: <number from 1 to N>'))
  assert.ok(prompt.includes('Strict Antipatterns Evaluation Checklist'))
  assert.ok(prompt.includes('Prefer vanilla JS'))
  assert.ok(prompt.includes('Candidate 1 — model-a: [Files created: app.js]'))
  assert.ok(prompt.includes('Candidate 2 — model-b: [Files created: style.css]'))
})

test('quality: parseRecommendedAssembler extracts recommended assembler model and index', () => {
  const sampleText = `
### 1. Curator Analysis
Candidate 1 has better JS architecture.
Candidate 2 has better CSS layout.

### 2. Assembly Recipe
RECOMMENDED_ASSEMBLER: 2 (opencode-go:deepseek-v4-flash)
WINNER_CANDIDATE_INDEX: 2
`
  const res = parseRecommendedAssembler(sampleText, 1, 3)
  assert.equal(res.index, 2)
  assert.equal(res.label, 'opencode-go:deepseek-v4-flash')

  // Out-of-range index falls back to default
  const outOfRange = `RECOMMENDED_ASSEMBLER: 99 (some:model)`
  const resFallback = parseRecommendedAssembler(outOfRange, 1, 3)
  assert.equal(resFallback.index, 1)

  // Empty string falls back to default
  assert.equal(parseRecommendedAssembler('', 1, 2).index, 1)
})

test('speed & resilience: callWithTransientRetry recovers from 429 and 503 transient errors', async () => {
  let callCount = 0
  const mockFlakyCall = async () => {
    callCount++
    if (callCount === 1) {
      throw new Error('429 Rate limit exceeded')
    }
    return 'Success after retry'
  }

  const result = await callWithTransientRetry(mockFlakyCall, {}, 1, 50)
  assert.equal(result, 'Success after retry')
  assert.equal(callCount, 2)

  // Non-transient error (e.g. 401 Unauthorized) should fail immediately without retrying
  let authCallCount = 0
  const mockAuthError = async () => {
    authCallCount++
    throw new Error('401 Invalid Token')
  }

  await assert.rejects(
    () => callWithTransientRetry(mockAuthError, {}, 1, 50),
    /401 Invalid Token/
  )
  assert.equal(authCallCount, 1)
})

test('speed: runReferencesParallel quorum mitigation finishes early with grace period', async () => {
  const references = [
    { provider: 'p1', model: 'fast-1' },
    { provider: 'p2', model: 'fast-2' },
    { provider: 'p3', model: 'straggler-slow' },
  ]

  const mockCallLlm = async (params) => {
    if (params.model === 'straggler-slow') {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve('Slow output'), 2000)
        if (params.signal) {
          params.signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('Aborted by quorum'))
          })
        } else {
          console.error("DEBUG: params.signal is undefined!");
        }
      })
    }
    return `Fast output from ${params.model}`
  }

  const progressUpdates = []
  const startTime = Date.now()

  const results = await runReferencesParallel(
    references,
    [{ role: 'user', content: 'test quorum' }],
    {
      quorumEnabled: true,
      gracePeriodSec: 0.2, // 200ms grace period for test speed
      timeoutMs: 5000,
    },
    mockCallLlm,
    (msg) => progressUpdates.push(msg)
  )

  const duration = Date.now() - startTime
  assert.ok(duration < 1500, `Execution took ${duration}ms, expected under 1500ms due to quorum`)

  assert.equal(results.length, 3)
  assert.equal(results[0].ok, true)
  assert.equal(results[0].text, 'Fast output from fast-1')
  assert.equal(results[1].ok, true)
  assert.equal(results[1].text, 'Fast output from fast-2')

  // Straggler should either be finished or marked as timed out via quorum
  assert.ok(results[2].text.includes('timed out') || results[2].ok)
  assert.ok(progressUpdates.some((p) => p.includes('Quorum reached') || p.includes('Grace period')))
})

test('resilience: runMoAPipeline fails over to aggregator_fallbacks when primary judge fails', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-fallback-chain-'))

  try {
    const preset = {
      name: 'test-fallback-chain',
      ask_clarifying_questions: false,
      reference_models: [
        { provider: 'p1', model: 'cand-1' },
        { provider: 'p2', model: 'cand-2' },
      ],
      aggregator: { provider: 'judge-p', model: 'primary-failing-judge' },
      aggregator_fallbacks: [
        { provider: 'backup-p', model: 'backup-working-judge' },
      ],
    }

    const judgesCalled = []
    const mockCallLlm = async (params) => {
      if (params.model === 'primary-failing-judge') {
        judgesCalled.push(params.model)
        throw new Error('500 Internal Server Error')
      }
      if (params.model === 'backup-working-judge') {
        judgesCalled.push(params.model)
        return 'WINNER_CANDIDATE_INDEX: 1\nBackup judge synthesized answer successfully.'
      }
      return `Proposal from ${params.model}\n\`\`\`html file="index.html"\n<h1>Test</h1>\n\`\`\``
    }

    const res = await runMoAPipeline({
      userPrompt: 'Detailed task prompt for fallback chain verification without broad question trigger',
      preset,
      callLlm: mockCallLlm,
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
    })

    assert.equal(res.kind, 'synthesis')
    assert.ok(res.content.includes('Backup judge synthesized answer successfully.'))
    assert.equal(res.aggregator, 'backup-p:backup-working-judge')
    assert.deepEqual(judgesCalled, ['primary-failing-judge', 'backup-working-judge'])
    assert.equal(res.promotedFiles.length, 1)
    assert.equal(res.promotedFiles[0], 'index.html')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('quality: curator synthesis mode promotes synthesized files directly when curator provides code', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-curator-synthesis-'))

  try {
    const preset = {
      name: 'curator-test',
      curator_synthesis: true,
      ask_clarifying_questions: false,
      reference_models: [
        { provider: 'p1', model: 'cand-1' },
        { provider: 'p2', model: 'cand-2' },
      ],
      aggregator: { provider: 'curator-p', model: 'curator-model' },
    }

    const mockCallLlm = async (params) => {
      if (params.model === 'curator-model') {
        return `
### 1. Curator Analysis
Candidate 1 has great HTML. Candidate 2 has great JS.

### 2. Assembly Recipe
RECOMMENDED_ASSEMBLER: 1 (p1:cand-1)
WINNER_CANDIDATE_INDEX: 1

### 3. Unified Solution
\`\`\`html file="unified.html"
<!DOCTYPE html><html><body>Unified by Curator</body></html>
\`\`\`
`
      }
      return `Candidate code from ${params.model}`
    }

    const res = await runMoAPipeline({
      userPrompt: 'Detailed specification for building custom application with curator fusion',
      preset,
      callLlm: mockCallLlm,
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
    })

    assert.equal(res.isCuratorSynthesis, true)
    assert.equal(res.recommendedAssembler?.index, 1)
    assert.equal(res.recommendedAssembler?.label, 'p1:cand-1')

    // Unified files created by curator should be promoted!
    assert.ok(res.promotedFiles.includes('unified.html'))
    const promotedContent = fs.readFileSync(path.join(tmpDir, 'unified.html'), 'utf8')
    assert.ok(promotedContent.includes('Unified by Curator'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('speed: stream_aggregator passes onStreamDelta chunks to listener', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-stream-agg-'))

  try {
    const preset = {
      name: 'stream-agg-test',
      stream_aggregator: true,
      ask_clarifying_questions: false,
      reference_models: [
        { provider: 'p1', model: 'cand-1' },
        { provider: 'p2', model: 'cand-2' },
      ],
      aggregator: { provider: 'judge-p', model: 'streaming-judge' },
    }

    const streamedDeltas = []
    const mockCallLlm = async (params) => {
      if (params.model === 'streaming-judge') {
        if (typeof params.onStreamDelta === 'function') {
          params.onStreamDelta('Chunk 1 ')
          params.onStreamDelta('Chunk 2')
        }
        return 'Chunk 1 Chunk 2'
      }
      return 'Candidate output'
    }

    await runMoAPipeline({
      userPrompt: 'Detailed prompt for testing streaming token delivery across chunks',
      preset,
      callLlm: mockCallLlm,
      cwd: tmpDir,
      onStreamDelta: (delta) => streamedDeltas.push(delta),
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
    })

    assert.deepEqual(streamedDeltas, ['Chunk 1 ', 'Chunk 2'])
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

