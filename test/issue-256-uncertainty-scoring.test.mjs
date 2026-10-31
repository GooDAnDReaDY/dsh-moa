import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateTokenEntropy,
  analyzeCandidateUncertainty,
  formatUncertaintyAnnotations,
} from '../lib/moa-uncertainty.js'
import { PresetSchema } from '../lib/moa-schema.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

test('issue #256: PresetSchema accepts uncertainty_scoring_enabled', () => {
  const parsed = PresetSchema({
    name: 'test-unc',
    uncertainty_scoring_enabled: true,
  })
  assert.equal(parsed.uncertainty_scoring_enabled, true)
})

test('issue #256: calculateTokenEntropy computes Shannon entropy from top_logprobs and scalar logprob', () => {
  // High confidence token (p ~ 0.99)
  const lowEntropy = calculateTokenEntropy({
    token: 'const',
    logprob: -0.01,
    top_logprobs: [
      { token: 'const', logprob: -0.01 },
      { token: 'let', logprob: -4.6 },
    ],
  })
  assert.ok(lowEntropy < 0.2, `Expected low entropy (<0.2), got ${lowEntropy}`)

  // High uncertainty token (split across 3 equally likely hallucinatory tokens)
  const lp = Math.log(0.33)
  const highEntropy = calculateTokenEntropy({
    token: 'fastSyncQuery',
    logprob: lp,
    top_logprobs: [
      { token: 'fastSyncQuery', logprob: lp },
      { token: 'syncQuery', logprob: lp },
      { token: 'execFast', logprob: lp },
    ],
  })
  assert.ok(highEntropy > 1.4, `Expected high entropy (>1.4), got ${highEntropy}`)

  // Scalar logprob fallback
  const scalarH = calculateTokenEntropy({ token: 'unknownFn', logprob: -2.0 })
  assert.ok(scalarH > 2.5)
})

test('issue #256: analyzeCandidateUncertainty & formatUncertaintyAnnotations flag high-entropy spans for Judge', () => {
  const candidate1 = {
    index: 1,
    label: 'openai:gpt-4o',
    text: 'const res = db.magicHallucinatedMethod(x);',
    logprobs: [
      { token: 'const', logprob: -0.01 },
      { token: ' res', logprob: -0.02 },
      { token: ' = ', logprob: -0.01 },
      { token: 'db.', logprob: -0.05 },
      { token: 'magicHallucinatedMethod', logprob: -1.85 }, // high entropy
      { token: '(x);', logprob: -0.02 },
    ],
  }

  const candidate2 = {
    index: 2,
    label: 'deepseek:deepseek-chat',
    text: 'const res = db.query(x);',
    logprobs: [
      { token: 'const', logprob: -0.01 },
      { token: ' db.query', logprob: -0.02 },
    ],
  }

  const analysis1 = analyzeCandidateUncertainty(candidate1, { entropyThreshold: 1.2 })
  assert.equal(analysis1.highEntropySpans.length, 1)
  assert.match(analysis1.highEntropySpans[0].span, /magicHallucinatedMethod/)
  assert.ok(analysis1.maxEntropy > 2.0)

  const report = formatUncertaintyAnnotations([candidate1, candidate2], { entropyThreshold: 1.2 })
  assert.equal(report.hasHighUncertainty, true)
  assert.match(report.reportText, /Token-Level Uncertainty & Hallucination Warnings/)
  assert.match(report.reportText, /Candidate 1 \(openai:gpt-4o\)/)
  assert.match(report.reportText, /magicHallucinatedMethod/)
})

test('issue #256: pipeline injects uncertainty warnings into Judge prompt when uncertainty_scoring_enabled=true', async () => {
  let judgePromptReceived = ''

  const mockCallLlm = async (args) => {
    if (args.model === 'ref-model') {
      return {
        content: 'function solve() { return lib.nonExistentCall(); }',
        logprobs: [
          { token: 'lib.', logprob: -0.02 },
          { token: 'nonExistentCall', logprob: -2.1 },
          { token: '()', logprob: -0.01 },
        ],
      }
    }
    if (args.model === 'judge-model') {
      judgePromptReceived = args.messages[0].content
      return 'Synthesized safe solution without hallucinated method.'
    }
    return 'ok'
  }

  const res = await runMoAPipeline({
    userPrompt: 'Implement solve() function with database call',
    preset: {
      name: 'unc-preset',
      ask_clarifying_questions: false,
      uncertainty_scoring_enabled: true,
      reference_models: [
        { provider: 'p1', model: 'ref-model' },
        { provider: 'p2', model: 'ref-model' },
      ],
      aggregator: { provider: 'p1', model: 'judge-model' },
    },
    callLlm: mockCallLlm,
  })

  assert.equal(res.kind, 'synthesis')
  assert.match(judgePromptReceived, /Token-Level Uncertainty & Hallucination Warnings/)
  assert.match(judgePromptReceived, /nonExistentCall/)
})
