import test from 'node:test'
import assert from 'node:assert/strict'
import { stageProjectContext } from '../lib/pipeline/context.js'
import { stageCandidateRound1 } from '../lib/pipeline/candidates.js'
import { stageClarifyingQuestions } from '../lib/pipeline/questions.js'
import { stageFastMode } from '../lib/pipeline/fast-mode.js'
import { stageMultiJudge } from '../lib/pipeline/multi-judge.js'
import { stageSynthesis } from '../lib/pipeline/synthesis.js'

test('pipeline stage: stageProjectContext resolves models, temperature and budget check', async () => {
  const res = await stageProjectContext({
    userPrompt: 'Hello world test',
    messages: [],
    preset: {
      name: 'test-preset',
      reference_models: [{ provider: 'test', model: 'm1' }],
      aggregator: { provider: 'test', model: 'judge' },
      reference_temperature: 0.7,
      aggregator_temperature: 0.2,
    },
    cwd: process.cwd(),
    prices: {},
    maxTokens: 2048,
    startTime: Date.now(),
  })

  assert.equal(res.ok, true)
  assert.equal(res.refTemp, 0.7)
  assert.equal(res.aggTemp, 0.2)
  assert.equal(res.effectiveReferences.length, 1)
  assert.ok(Array.isArray(res.enrichedMessages))
})

test('pipeline stage: stageCandidateRound1 fast-fails when all models fail', async () => {
  const mockCallLlm = async () => {
    throw new Error('API connection refused')
  }

  const res = await stageCandidateRound1({
    effectiveReferences: [{ provider: 'test', model: 'fail1' }, { provider: 'test', model: 'fail2' }],
    enrichedMessages: [{ role: 'user', content: 'hello' }],
    candidateSystemPrompt: 'sys',
    refTemp: 0.5,
    preset: { name: 'test' },
    maxTokens: 1000,
    prices: {},
    refTimeoutSec: 5,
    isQuorumEnabled: false,
    gracePeriodSec: 1,
    candidateRetries: 0,
    signal: null,
    callLlm: mockCallLlm,
    onProgress: null,
    cwd: process.cwd(),
    runId: 'test-run-fail',
    startTime: Date.now(),
    primaryJudge: { provider: 'test', model: 'j1' },
    isRefinement: false,
    isFastMode: false,
    collectedCtx: null,
    testGateEnabled: false,
    testCommand: null,
    execFn: null,
  })

  assert.equal(res.ok, false)
  assert.equal(res.failurePayload.kind, 'failure')
  assert.ok(res.failurePayload.content.includes('All advisor models (2) failed'))
})

test('pipeline stage: stageClarifyingQuestions builds questions payload', async () => {
  const mockCallLlm = async () => '1. Scope? 2. Color theme?'
  const referenceOutputs = [
    { index: 1, label: 'test:m1', ok: true, text: 'proposal 1', usage: { totalTokens: 10 }, costUsd: 0.001 }
  ]

  const res = await stageClarifyingQuestions({
    userPrompt: 'Build me an app',
    referenceOutputs,
    primaryJudge: { provider: 'test', model: 'judge' },
    aggTimeoutSec: 10,
    prices: {},
    callLlm: mockCallLlm,
    cwd: process.cwd(),
    runId: 'test-q-run',
    preset: { name: 'default' },
    isRefinement: false,
    isFastMode: false,
    collectedCtx: null,
    startTime: Date.now(),
    historyFilePath: null,
    onProgress: null,
  })

  assert.equal(res.kind, 'questions')
  assert.equal(res.content, '1. Scope? 2. Color theme?')
  assert.equal(res.winnerModel, 'none')
})

test('pipeline stage: stageFastMode directly synthesizes single candidate', async () => {
  const referenceOutputs = [
    { index: 1, label: 'test:single', ok: true, text: 'Single model output', usage: { totalTokens: 50 }, costUsd: 0.0005, files: [] }
  ]

  const res = await stageFastMode({
    successfulRefs: referenceOutputs,
    referenceOutputs,
    allowCandidateOverride: false,
    promoteOpts: {},
    cwd: process.cwd(),
    runId: 'test-fast-run',
    signal: null,
    userPrompt: 'Quick question',
    preset: { name: 'fast' },
    isRefinement: false,
    historyFilePath: null,
    startTime: Date.now(),
    collectedCtx: null,
    liveCanvas: null,
  })

  assert.equal(res.ok, true)
  assert.equal(res.payload.kind, 'synthesis')
  assert.equal(res.payload.isFastMode, true)
  assert.equal(res.payload.content, 'Single model output')
})

