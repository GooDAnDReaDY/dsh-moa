import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { runCandidateTestGate } from '../lib/moa-test-gate.js'
import { writeCandidateWorkspace } from '../lib/file-workspace.js'
import { applyBudgetGuardrails, checkPhaseBudget } from '../lib/moa-budget.js'

test('#158: budget guardrail accounts for all phases and blocks $0.001 limit run upfront', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-158-audit-'))
  const prices = { '*': { input: 1, output: 1 } }
  const limit = 0.001
  const preset = {
    name: 'audit44',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'one' }, { provider: 'mock', model: 'two' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 64,
    peer_critique_enabled: true,
    budget_guard_enabled: true,
    max_budget_usd: limit,
    budget_action: 'abort',
  }

  try {
    // 1. Upfront estimation must include candidate generation, peer critique, and downstream judge
    const upfront = applyBudgetGuardrails({
      references: preset.reference_models,
      aggregator: preset.aggregator,
      enabled: true,
      maxBudgetUsd: limit,
      action: 'abort',
      promptLength: 11,
      maxTokens: 64,
      prices,
      peerCritiqueEnabled: true,
    })
    assert.equal(upfront.allowed, false, 'Upfront estimate must reject run exceeding $0.001 budget')
    assert.equal(upfront.action, 'abort')
    assert.match(upfront.reason, /exceeds.*budget/i)

    // 2. Pipeline execution must abort upfront without making LLM calls
    const calls = []
    const result = await runMoAPipeline({
      userPrompt: 'modify code',
      cwd: tmpDir,
      preset,
      prices,
      callLlm: async ({ model, messages, maxTokens }) => {
        calls.push({ model, messages, maxTokens })
        return { text: 'code', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } }
      },
    })
    assert.equal(result.kind, 'failure')
    assert.equal(calls.length, 0, 'No LLM calls must be dispatched when upfront budget guard triggers')
    assert.match(result.content, /Budget Guardrail Abort/i)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#158: runtime phase budget check skips Round 2 when remaining budget is insufficient', () => {
  const phaseCheck = checkPhaseBudget({
    phaseName: 'Consilium Round 2',
    currentSpentUsd: 0.0008,
    nextPhaseCostUsd: 0.0004,
    maxBudgetUsd: 0.001,
    action: 'trim',
    enabled: true,
  })
  assert.equal(phaseCheck.allowed, false)
  assert.equal(phaseCheck.action, 'trim')
  assert.match(phaseCheck.reason, /Consilium Round 2 exceeds max budget/i)
})

test('#161: test gate sandboxing blocks shell script escape attempting to read host files', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-161-audit-'))
  const outsideFile = path.join(os.tmpdir(), `moa-outside-${Date.now()}.txt`)
  await fs.writeFile(outsideFile, 'SYNTHETIC_HOST_MARKER_44')

  try {
    await writeCandidateWorkspace(tmpDir, 1, [{
      relativePath: 'probe.sh',
      content: `cat "${outsideFile}"\n`,
    }])

    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'sh probe.sh',
    })

    assert.equal(res.passed, false, 'Shell script escape must fail gate')
    assert.equal(res.exitCode, 1)
    assert.match(res.output, /Access denied/i)
    assert.doesNotMatch(res.output, /SYNTHETIC_HOST_MARKER_44/, 'Must not leak host marker')
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
    fsSync.rmSync(outsideFile, { force: true })
  }
})

test('#206: test gate permits standard npm test execution within workspace sandbox', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-206-audit-'))
  const priorHome = process.env.HOME
  process.env.HOME = path.join(tmpDir, 'fake-home')
  await fs.mkdir(process.env.HOME, { recursive: true })

  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      {
        relativePath: 'package.json',
        content: JSON.stringify({
          name: 'synthetic-test-gate',
          version: '1.0.0',
          scripts: { test: 'node check.cjs' },
        }),
      },
      {
        relativePath: 'check.cjs',
        content: 'console.log("VALID_NPM_TEST_44")',
      },
    ])

    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'npm test',
      maxOutputChars: 9000,
    })

    assert.equal(res.passed, true, `Standard npm test must pass inside test gate: ${res.output}`)
    assert.equal(res.exitCode, 0)
    assert.match(res.output, /VALID_NPM_TEST_44/)
  } finally {
    process.env.HOME = priorHome
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#207: fast mode promotion failure preserves token usage, cost, references and records history', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-207-audit-'))
  const appFile = path.join(tmpDir, 'app.js')
  await fs.writeFile(appFile, 'ORIGINAL')
  const historyFilePath = path.join(tmpDir, 'failed-history.jsonl')
  const fence = '```'

  const preset = {
    name: 'audit207',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'fast-cand' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 64,
  }

  try {
    const res = await runMoAPipeline({
      userPrompt: 'modify code',
      cwd: tmpDir,
      preset,
      prices: { '*': { input: 1, output: 1 } },
      historyFilePath,
      force: false,
      checkpointFn: async () => {
        throw new Error('SYNTHETIC_CHECKPOINT_FAILURE')
      },
      callLlm: async () => ({
        text: `${fence}js file="app.js"\nREPLACEMENT\n${fence}`,
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      }),
    })

    assert.equal(res.kind, 'failure')
    assert.match(res.content, /Checkpoint or Promotion Failure/i)
    assert.equal(res.winningIndex, 0)
    assert.equal(res.winnerModel, 'none')
    assert.deepEqual(res.promotedFiles, [])

    // Preserved tokens & cost
    assert.equal(res.usage.totalTokens, 120, 'Candidate tokens must be preserved on failure')
    assert.equal(res.usage.totalCostUsd, 0.00012, 'Candidate cost must be preserved on failure')
    assert.equal(res.references.length, 1)
    assert.equal(res.references[0].usage.totalTokens, 120)

    // Unmodified disk file
    const diskContent = await fs.readFile(appFile, 'utf8')
    assert.equal(diskContent, 'ORIGINAL', 'Original file must remain untouched')

    // History record persistence
    assert.equal(fsSync.existsSync(historyFilePath), true, 'History record must be saved')
    const historyLines = fsSync.readFileSync(historyFilePath, 'utf8').trim().split('\n')
    assert.equal(historyLines.length, 1)
    const entry = JSON.parse(historyLines[0])
    assert.equal(entry.totalTokens, 120)
    assert.equal(entry.totalCostUsd, 0.00012)
    assert.match(entry.error, /Pre-promotion checkpoint failed|SYNTHETIC_CHECKPOINT_FAILURE/i)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})
