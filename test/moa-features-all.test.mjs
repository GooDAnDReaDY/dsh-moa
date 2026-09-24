import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyPromptIntent, resolvePresetForPrompt } from '../lib/moa-router.js'
import { extractCodeBlocks, buildCompositeBlockDirectives, parseJudgeEvaluation, executeMultiJudgePanel } from '../lib/moa-multi-judge.js'
import { estimateCandidateRunCost, applyBudgetGuardrails } from '../lib/moa-budget.js'
import { extractPriorTurnBaseline, pruneMultiTurnMessages } from '../lib/moa-context.js'
import { generateMoABenchmarkReport } from '../lib/moa-report.js'
import { runReferencesParallel } from '../lib/moa-candidates.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

test('Feature 4: Smart Router - keyword classification & resolvePresetForPrompt', async (t) => {
  assert.equal(classifyPromptIntent('Please create a react landing page component with css'), 'frontend-ui')
  assert.equal(classifyPromptIntent('Find security cve injection vulnerabilities in this file'), 'security-audit')
  assert.equal(classifyPromptIntent('Review this PR diff and audit code quality'), 'code-review')
  assert.equal(classifyPromptIntent('Fix this bug crash exception'), 'bug-hunter')
  assert.equal(classifyPromptIntent('Refactor and clean dead code ponytail style'), 'refactor-cleanup')

  const presets = [{ name: 'frontend-ui' }, { name: 'code-review' }, { name: 'default' }]

  // Disabled returns default
  const resDisabled = await resolvePresetForPrompt({
    prompt: 'create a button component',
    presets,
    defaultPreset: 'default',
    enabled: false,
  })
  assert.equal(resDisabled.presetName, 'default')

  // Enabled heuristic routing
  const resHeuristic = await resolvePresetForPrompt({
    prompt: 'create a tailwind button component',
    presets,
    defaultPreset: 'default',
    enabled: true,
  })
  assert.equal(resHeuristic.presetName, 'frontend-ui')
  assert.equal(resHeuristic.isAutoRouted, true)

  // LLM / JEV routing
  const mockJevLlm = async ({ messages }) => {
    return { content: 'code-review' }
  }
  const resLlm = await resolvePresetForPrompt({
    prompt: 'analyze these algorithmic changes',
    presets,
    defaultPreset: 'default',
    routingModel: { provider: 'opencode-go', model: 'jev' },
    callLlm: mockJevLlm,
    enabled: true,
  })
  assert.equal(resLlm.presetName, 'code-review')
  assert.equal(resLlm.reason, 'llm_classifier')
})

test('Feature 2: Multi-Judge Panel - evaluation parsing and consensus voting', async (t) => {
  const rawOutput = `
SCORES:
Candidate 1: 9.5
Candidate 2: 7.0
BEST_CANDIDATE: 1
CONSENSUS_REASONING: Candidate 1 had far superior architecture and test coverage.
`
  const parsed = parseJudgeEvaluation(rawOutput, 2)
  assert.equal(parsed.bestCandidate, 1)
  assert.equal(parsed.scores[1], 9.5)
  assert.equal(parsed.scores[2], 7.0)
  assert.ok(parsed.reasoning.includes('superior architecture'))

  // Multi-judge execution
  const candidates = [
    { index: 1, label: 'm1', ok: true, text: 'Solution 1 code' },
    { index: 2, label: 'm2', ok: true, text: 'Solution 2 code' },
  ]

  let judgeCallCount = 0
  const mockJudgeLlm = async ({ messages }) => {
    judgeCallCount++
    return `SCORES:\nCandidate 1: 9\nCandidate 2: 8\nBEST_CANDIDATE: 1\nCONSENSUS_REASONING: Model 1 provides cleaner implementation.`
  }

  const result = await executeMultiJudgePanel({
    judges: [
      { provider: 'p1', model: 'j1' },
      { provider: 'p2', model: 'j2' },
    ],
    candidates,
    userPrompt: 'Write a quicksort function',
    callLlm: mockJudgeLlm,
    strategy: 'majority',
  })

  assert.equal(judgeCallCount, 2)
  assert.equal(result.consensus, true)
  assert.equal(result.winningCandidateIndex, 1)
  assert.equal(result.isUnanimous, true)
  assert.equal(result.votes[1], 2)
})

test('Feature 3: Composite Hybrid Synthesis - AST/block extraction & directives', async (t) => {
  const sampleMarkdown = `
Here is the first module:
\`\`\`ts:src/core/math.ts
export function add(a: number, b: number) { return a + b }
\`\`\`
And the test:
\`\`\`javascript:test/math.test.js
test('adds', () => {})
\`\`\`
`
  const blocks = extractCodeBlocks(sampleMarkdown)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].filename, 'src/core/math.ts')
  assert.equal(blocks[1].filename, 'test/math.test.js')

  const candidates = [
    { index: 1, label: 'Candidate 1', ok: true, text: '```js:utils.js\nconst x = 1\n```' },
    { index: 2, label: 'Candidate 2', ok: true, text: '```js:app.js\nconst y = 2\n```' },
  ]
  const directive = buildCompositeBlockDirectives(candidates)
  assert.ok(directive.includes('COMPOSITE HYBRID SYNTHESIS DIRECTIVE'))
  assert.ok(directive.includes('utils.js'))
  assert.ok(directive.includes('app.js'))
})

test('Feature 6: Cost Budget Guardrails - estimate, trim, and abort', async (t) => {
  const references = [
    { provider: 'deepseek', model: 'deepseek-chat' }, // cheap
    { provider: 'openai', model: 'gpt-4o' },          // expensive
  ]
  const prices = {
    'deepseek:deepseek-chat': { input: 0.14, output: 0.28 },
    'openai:gpt-4o': { input: 5.0, output: 15.0 },
  }

  // 1. Unlimited / disabled
  const passRes = applyBudgetGuardrails({
    references,
    enabled: false,
    maxBudgetUsd: 0.05,
    prices,
  })
  assert.equal(passRes.allowed, true)
  assert.equal(passRes.action, 'none')

  // 2. Budget abort when exceeded
  const abortRes = applyBudgetGuardrails({
    references,
    enabled: true,
    maxBudgetUsd: 0.001, // extremely low
    action: 'abort',
    prices,
  })
  assert.equal(abortRes.allowed, false)
  assert.equal(abortRes.action, 'abort')
  assert.ok(abortRes.reason.includes('exceeds'))

  // 3. Budget trim
  const trimRes = applyBudgetGuardrails({
    references,
    enabled: true,
    maxBudgetUsd: 0.01,
    action: 'trim',
    prices,
  })
  assert.equal(trimRes.allowed, true)
  assert.equal(trimRes.action, 'trim')
  assert.equal(trimRes.references.length, 1)
})

test('Feature 7: Temperature Gradient Exploration & Per-Candidate Temperature', async (t) => {
  const references = [
    { provider: 'p1', model: 'm1', temperature: 0.15 },
    { provider: 'p2', model: 'm2' }, // should get gradient
    { provider: 'p3', model: 'm3' }, // should get gradient
  ]

  const capturedTemps = []
  const mockLlm = async (args) => {
    capturedTemps.push(args.temperature)
    return { content: `Response from ${args.model}` }
  }

  const results = await runReferencesParallel(
    references,
    [{ role: 'user', content: 'test' }],
    {
      temperature: 0.6,
      temperature_gradient_enabled: true,
    },
    mockLlm
  )

  assert.equal(results.length, 3)
  assert.equal(capturedTemps[0], 0.15) // Explicit candidate temp
  assert.equal(capturedTemps[1], 0.55) // Gradient mid
  assert.equal(capturedTemps[2], 0.90) // Gradient top
})

test('Feature 8: Multi-Turn Conversation Memory & Context Pruning', async (t) => {
  const messages = [
    { role: 'system', content: 'System instruction' },
    { role: 'user', content: 'Turn 1 user request' },
    { role: 'assistant', content: '### 🌟 Winning Candidate\n```js\nconsole.log("Turn 1 solution")\n```' },
    { role: 'user', content: 'Turn 2 user request' },
  ]

  const baseline = extractPriorTurnBaseline(messages)
  assert.ok(baseline.includes('console.log("Turn 1 solution")'))

  const pruned = pruneMultiTurnMessages(messages, 1000)
  assert.equal(pruned.length, 4)
  assert.equal(pruned[0].role, 'system')
  assert.equal(pruned[pruned.length - 1].content, 'Turn 2 user request')
})

test('Feature 9: Automated Benchmark & Post-Mortem PR Reports', async (t) => {
  const report = generateMoABenchmarkReport({
    runId: 'test-run-123',
    timestamp: '2026-09-24T21:00:00Z',
    preset: 'deep-reasoning',
    prompt: 'Implement a binary search tree in TypeScript',
    durationMs: 4500,
    usage: { inputTokens: 500, outputTokens: 800, totalTokens: 1300 },
    costUsd: 0.0055,
    candidates: [
      { index: 1, label: 'deepseek-v3', role_persona: 'robustness', ok: true, costUsd: 0.002, usage: { totalTokens: 600 } },
      { index: 2, label: 'claude-3-5', role_persona: 'performance', ok: true, costUsd: 0.0035, usage: { totalTokens: 700 } },
    ],
    winningIndex: 1,
    winningLabel: 'deepseek-v3',
    consensus: {
      consensus: true,
      strategy: 'majority',
      isUnanimous: true,
      averageScores: { 1: 9.5, 2: 8.0 },
      consensusReport: 'DeepSeek-V3 chosen for complete balance invariant validation.',
    },
    testGate: {
      enabled: true,
      passed: true,
      command: 'npm test',
      exitCode: 0,
      output: 'pass 5, fail 0',
    },
    isComposite: true,
  })

  assert.ok(report.markdown.includes('Mixture of Agents (MoA) Benchmark & Post-Mortem Report'))
  assert.ok(report.markdown.includes('test-run-123'))
  assert.ok(report.markdown.includes('deepseek-v3'))
  assert.ok(report.markdown.includes('npm test'))
  assert.ok(report.markdown.includes('Composite Hybrid AST/Block Merge'))
  assert.equal(report.json.runId, 'test-run-123')
  assert.equal(report.json.costUsd, 0.0055)
})

test('Feature 10: Graceful Degradation & Local Fallback Resilience', async (t) => {
  const references = [
    { provider: 'online-fail', model: 'primary-cloud' },
  ]

  let onlineCalled = false
  let fallbackCalled = false

  const mockLlm = async (args) => {
    if (args.provider === 'online-fail') {
      onlineCalled = true
      throw new Error('500 Internal Server Error (Cloud Outage)')
    }
    if (args.provider === 'ollama') {
      fallbackCalled = true
      return { content: 'Recovered response from local Ollama model' }
    }
    throw new Error('Unknown model')
  }

  const results = await runReferencesParallel(
    references,
    [{ role: 'user', content: 'test prompt' }],
    {
      local_fallback_enabled: true,
      local_fallback_models: [{ provider: 'ollama', model: 'qwen2.5-coder:7b' }],
      maxRetries: 0,
    },
    mockLlm
  )

  assert.equal(onlineCalled, true)
  assert.equal(fallbackCalled, true)
  assert.equal(results.length, 1)
  assert.equal(results[0].ok, true)
  assert.equal(results[0].was_fallback, true)
  assert.ok(results[0].text.includes('Recovered response from local Ollama'))
})

test('Integrated Pipeline: End-to-end execution with Multi-Judge, Report & Budget', async (t) => {
  const mockCallLlm = async ({ provider, model, messages }) => {
    const text = messages.map((m) => m.content).join('\n')
    if (text.includes('expert judge in an ensemble')) {
      return 'SCORES:\nCandidate 1: 9.0\nCandidate 2: 7.5\nBEST_CANDIDATE: 1\nCONSENSUS_REASONING: Superior tests.'
    }
    if (text.includes('expert aggregator/judge')) {
      return 'WINNER_CANDIDATE_INDEX: 1\n### 1. Judge verdict\nWinner: Candidate 1.\n### 2. Files\nNone.\n### 3. Usage\nRun node app.js'
    }
    return 'Candidate solution code\n```js:main.js\nconsole.log("hello")\n```'
  }

  const preset = {
    name: 'integrated-test',
    ask_clarifying_questions: false,
    reference_models: [
      { provider: 'p1', model: 'm1' },
      { provider: 'p2', model: 'm2' },
    ],
    aggregator: { provider: 'p-agg', model: 'm-agg' },
    multi_judge_enabled: true,
    judge_models: [{ provider: 'p-j1', model: 'm-j1' }],
    composite_merge_enabled: true,
    budget_guard_enabled: true,
    max_budget_usd: 1.0,
    report_generation_enabled: true,
    temperature_gradient_enabled: true,
  }

  const result = await runMoAPipeline({
    userPrompt: 'Build an express server',
    preset,
    callLlm: mockCallLlm,
    cwd: '/tmp',
  })

  assert.equal(result.kind, 'synthesis')
  assert.equal(result.winningIndex, 1)
  assert.ok(result.consensus)
  assert.equal(result.consensus.winningCandidateIndex, 1)
  assert.ok(result.benchmarkReport)
  assert.ok(result.benchmarkReport.markdown.includes('Mixture of Agents (MoA) Benchmark'))
})
