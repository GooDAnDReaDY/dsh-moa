import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { calcSynthesisPromptTokens, createBudgetAbortPayload } from '../lib/moa-budget.js'
import { buildSynthesisPrompt } from '../lib/moa-prompts.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

test('#242: calcSynthesisPromptTokens supports both positional and object signatures', () => {
  const refs = [
    { label: 'mock:c1', text: 'candidate 1 implementation', files: [{ relativePath: 'src/a.js' }] },
    { label: 'mock:c2', text: 'candidate 2 implementation', files: [{ relativePath: 'src/b.js' }] },
  ]
  const prompt = 'refactor application architecture'
  const criteria = 'must be modular and testable'

  const tokensPos = calcSynthesisPromptTokens(prompt, refs, criteria)
  const tokensObj = calcSynthesisPromptTokens({
    userPrompt: prompt,
    referenceOutputs: refs,
    judgeCriteria: criteria,
  })

  assert.equal(typeof tokensPos, 'number')
  assert.equal(typeof tokensObj, 'number')
  assert.equal(tokensPos, tokensObj, 'Positional and object calls must yield identical token estimates')
  assert.ok(tokensPos > 650, 'Tokens must account for prompt, criteria, overhead, and candidate texts')
})

test('#242: calcSynthesisPromptTokens accounts for testResult output and Test Gate directive', () => {
  const baseRefs = [
    { label: 'mock:c1', text: 'const x = 1;', files: [] },
    { label: 'mock:c2', text: 'const y = 2;', files: [] },
  ]
  const prompt = 'optimize database access'

  const baseTokens = calcSynthesisPromptTokens(prompt, baseRefs, '')

  const testOutputLog = 'PASS test/auth.test.js\n'.repeat(120) // ~2760 chars
  const refsWithTest = [
    {
      label: 'mock:c1',
      text: 'const x = 1;',
      files: [],
      testResult: { passed: true, exitCode: 0, durationMs: 25, output: testOutputLog, summary: '120 passed' },
    },
    { label: 'mock:c2', text: 'const y = 2;', files: [] },
  ]

  const tokensWithTest = calcSynthesisPromptTokens(prompt, refsWithTest, '')
  assert.ok(tokensWithTest > baseTokens, `Prompt tokens with test results (${tokensWithTest}) must exceed base (${baseTokens})`)

  // Expected increase: ~550 chars (directive) + ~150 chars (report header) + 2760 chars (output) = ~3460 chars (~865 tokens)
  const expectedIncrease = Math.ceil((550 + 150 + testOutputLog.length) / 4)
  const actualIncrease = tokensWithTest - baseTokens
  const delta = Math.abs(actualIncrease - expectedIncrease)
  assert.ok(delta < 30, `Token increase (${actualIncrease}) must closely align with expected (${expectedIncrease}), delta=${delta}`)

  // Verify alignment with buildSynthesisPrompt
  const builtPrompt = buildSynthesisPrompt(prompt, refsWithTest, '')
  const builtTokens = Math.ceil(builtPrompt.length / 4)
  const alignmentDelta = Math.abs(tokensWithTest - builtTokens)
  assert.ok(alignmentDelta < 50, `calcSynthesisPromptTokens (${tokensWithTest}) must closely align with buildSynthesisPrompt (${builtTokens}), delta=${alignmentDelta}`)
})

test('#242: createBudgetAbortPayload aggregates totalTokens, input/output tokens, and multiJudge usage', () => {
  const payload = createBudgetAbortPayload({
    reason: 'Downstream judge cost exceeds max budget limit',
    primaryJudge: { provider: 'mock', model: 'eval-judge' },
    referenceOutputs: [
      { label: 'c1', usage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 }, costUsd: 0.0001 },
      { label: 'c2', usage: { inputTokens: 74, outputTokens: 100, totalTokens: 174 }, costUsd: 0.0001 },
    ],
    currentSpentUsd: 0.00222,
    preset: { name: 'test-preset' },
    multiJudgeResult: {
      totalUsage: { inputTokens: 182, outputTokens: 1755, totalTokens: 1937, costUsd: 0.002 },
      judgesResults: [{ judge: 'panel-1', score: 9.5 }],
    },
  })

  assert.equal(payload.kind, 'failure')
  assert.equal(payload.usage.totalTokens, 2211, 'Total tokens must accurately sum 274 (candidates) + 1937 (multiJudge) = 2211')
  assert.equal(payload.usage.totalInputTokens, 50 + 74 + 182, 'Total input tokens must sum candidates + panel')
  assert.equal(payload.usage.totalOutputTokens, 50 + 100 + 1755, 'Total output tokens must sum candidates + panel')
  assert.equal(payload.usage.totalCostUsd, 0.00222)
  assert.ok(payload.usage.multiJudge, 'multiJudge usage object must be retained')
  assert.equal(payload.usage.multiJudge.totalTokens, 1937)
})

test('#242: End-to-end pipeline preserves full panel tokens on post-panel budget abort', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-242-pipeline-'))
  const preset = {
    name: 'test-242-post-panel-abort',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'c1' }, { provider: 'mock', model: 'c2' }],
    aggregator: { provider: 'mock', model: 'judge' },
    multi_judge_enabled: true,
    judge_models: [{ provider: 'mock', model: 'panel-judge' }],
    max_tokens: 64,
    budget_guard_enabled: true,
    max_budget_usd: 0.0025,
    budget_action: 'abort',
  }

  const calls = []
  const res = await runMoAPipeline({
    cwd: tmp,
    userPrompt: 'refactor mission-critical architecture',
    preset,
    prices: { '*': { input: 1, output: 1 } },
    callLlm: async ({ model, messages, maxTokens }) => {
      const inputTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4)
      const text = model === 'panel-judge'
        ? 'BEST_CANDIDATE: 1\n' + ('A'.repeat(7000))
        : 'candidate implementation code'
      const outputTokens = Math.ceil(text.length / 4)
      calls.push({ model, inputTokens, outputTokens, maxTokens })
      return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } }
    },
  })

  assert.ok(res, 'Pipeline result must exist')
  assert.equal(res.kind, 'failure', 'Must abort before judge synthesis')
  assert.ok(calls.some((c) => c.model === 'panel-judge'), 'Panel judge MUST have been invoked')
  assert.ok(!calls.some((c) => c.model === 'judge'), 'Downstream judge MUST NOT have been invoked')

  const actualTokenSum = calls.reduce((acc, c) => acc + c.inputTokens + c.outputTokens, 0)
  assert.equal(res.usage?.totalTokens, actualTokenSum, `Reported totalTokens (${res.usage?.totalTokens}) must equal actual (${actualTokenSum})`)
  assert.ok(res.usage?.multiJudge, 'multiJudge usage object must be present')
  assert.ok((res.usage?.multiJudge?.totalTokens || 0) > 0, 'multiJudge tokens must be greater than zero')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})
