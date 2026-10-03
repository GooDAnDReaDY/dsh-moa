import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import {
  executeMultiJudgePanel,
  parseJudgeEvaluation,
  buildCompositeBlockDirectives,
} from '../lib/moa-multi-judge.js'
import { summarizeMoAUsage, estimateTokenCost } from '../lib/pricing.js'
import { generateMoABenchmarkReport } from '../lib/moa-report.js'
import {
  recordMoaRun,
  getMoaHistory,
  getMoaLeaderboard,
  readTailLinesSync,
  countFileLinesSync,
  candidatesForHistory,
  invalidateHistoryCache,
} from '../lib/history.js'

test('Block 4 (#165): executeMultiJudgePanel returns consensus: false when all judges fail', async () => {
  const candidates = [
    { index: 1, label: 'p1:m1', text: 'candidate 1 text', ok: true },
    { index: 2, label: 'p2:m2', text: 'candidate 2 text', ok: true },
  ]
  const mockCallLlm = async () => {
    throw new Error('Judge API 500 error')
  }

  const result = await executeMultiJudgePanel({
    judges: [
      { provider: 'p1', model: 'judge1' },
      { provider: 'p2', model: 'judge2' },
    ],
    candidates,
    userPrompt: 'Test task',
    callLlm: mockCallLlm,
    strategy: 'majority',
  })

  assert.equal(result.consensus, false, 'Consensus must be false when all judges fail')
  assert.equal(result.reason, 'all_judges_failed')
  assert.equal(result.isUnanimous, false)
  assert.equal(result.totalUsage.inputTokens, 0)
  assert.equal(result.totalCostUsd, 0)
})

test('Block 4 (#166): parseJudgeEvaluation supports sparse/active candidate indices', () => {
  // Suppose candidate 1 failed, so only candidates 2 and 3 are evaluated
  const activeCandidates = [
    { index: 2, label: 'p2:m2', ok: true },
    { index: 3, label: 'p3:m3', ok: true },
  ]
  const judgeText = `
CANDIDATE_EVALUATION:
Candidate 2: Score 7.5
Candidate 3: Score 9.5
BEST_CANDIDATE: Candidate 3
CONSENSUS_REASONING: Candidate 3 has optimal architecture.
`
  const res = parseJudgeEvaluation(judgeText, activeCandidates)
  assert.equal(res.bestCandidate, 3, 'Candidate 3 should be selected as best candidate')
  assert.equal(res.scores[2], 7.5)
  assert.equal(res.scores[3], 9.5)
  assert.equal(res.reasoning, 'Candidate 3 has optimal architecture.')
})

test('Block 4 (#167): blind evaluation masks model names in summary and composite directives', () => {
  const candidates = [
    { index: 1, label: 'openai:gpt-4o', text: '```js:app.js\nconsole.log(1)\n```', ok: true },
    { index: 2, label: 'anthropic:claude-3-5', text: '```js:app.js\nconsole.log(2)\n```', ok: true },
  ]

  const composite = buildCompositeBlockDirectives(candidates, { blind: true })
  assert.ok(!composite.includes('openai:gpt-4o'), 'Model label must be masked in blind mode')
  assert.ok(!composite.includes('anthropic:claude-3-5'), 'Model label must be masked in blind mode')
  assert.ok(composite.includes('Candidate 1'), 'Must use anonymized Candidate 1 label')
  assert.ok(composite.includes('Candidate 2'), 'Must use anonymized Candidate 2 label')
})

test('Block 4 (#168): multi-judge usage and costs are tracked and included in pipeline summary', async () => {
  const candidates = [
    { index: 1, label: 'p1:m1', text: 'code 1', ok: true, usage: { inputTokens: 100, outputTokens: 50 }, costUsd: 0.001 },
    { index: 2, label: 'p2:m2', text: 'code 2', ok: true, usage: { inputTokens: 100, outputTokens: 60 }, costUsd: 0.001 },
  ]
  const mockCallLlm = async () => ({
    text: 'CANDIDATE_EVALUATION:\nCandidate 1: Score 8\nCandidate 2: Score 9\nBEST_CANDIDATE: Candidate 2\nCONSENSUS_REASONING: Good',
    usage: { inputTokens: 200, outputTokens: 50 },
  })

  const panelRes = await executeMultiJudgePanel({
    judges: [{ provider: 'p-judge', model: 'm-judge' }],
    candidates,
    userPrompt: 'Test',
    callLlm: mockCallLlm,
    prices: { 'p-judge:m-judge': { inputPricePerM: 10, outputPricePerM: 30 } },
  })

  assert.equal(panelRes.totalUsage.inputTokens, 200)
  assert.equal(panelRes.totalUsage.outputTokens, 50)
  assert.equal(panelRes.totalUsage.totalTokens, 250)
  assert.ok(panelRes.totalCostUsd > 0)

  // Pipeline usage integration
  const aggUsage = { inputTokens: 500, outputTokens: 300, totalTokens: 800, costUsd: 0.005 }
  const totalSummary = summarizeMoAUsage(candidates, aggUsage, panelRes.totalUsage)

  assert.equal(totalSummary.totalInputTokens, 200 + 500 + 200) // cand1 + cand2 + agg + judge
  assert.equal(totalSummary.totalOutputTokens, 110 + 300 + 50)
  assert.equal(totalSummary.totalTokens, 150 + 160 + 800 + 250)
  assert.ok(totalSummary.totalCostUsd > 0.007)
})

test('Block 4 (#169): history records preserve persona, temperature, fallback, testResult, and slot details', () => {
  const refs = [
    {
      index: 1,
      slot: { provider: 'p1', model: 'm1' },
      role_persona: 'security_auditor',
      temperature: 0.2,
      was_fallback: true,
      original_model: 'p1:expensive-model',
      files: [{ relativePath: 'src/auth.js' }],
      usage: { inputTokens: 150, outputTokens: 120 },
      costUsd: 0.002,
      testResult: { passed: true, exitCode: 0, summary: 'Security checks passed', durationMs: 450 },
    },
  ]

  const histItems = candidatesForHistory(refs)
  assert.equal(histItems[0].role, 'security_auditor')
  assert.equal(histItems[0].temperature, 0.2)
  assert.equal(histItems[0].wasFallback, true)
  assert.equal(histItems[0].originalModel, 'p1:expensive-model')
  assert.equal(histItems[0].testResult.passed, true)
  assert.equal(histItems[0].testResult.summary, 'Security checks passed')
  assert.deepEqual(histItems[0].slot, { provider: 'p1', model: 'm1' })

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-hist-169-'))
  const histFile = path.join(tmpDir, 'history.jsonl')
  try {
    const recorded = recordMoaRun({
      prompt: 'Refactor security',
      candidates: histItems,
      winnerIndex: 1,
      winnerModel: 'p1:m1',
    }, histFile)

    assert.equal(recorded.candidates[0].role, 'security_auditor')
    assert.equal(recorded.candidates[0].temperature, 0.2)
    assert.equal(recorded.candidates[0].wasFallback, true)
    assert.equal(recorded.candidates[0].originalModel, 'p1:expensive-model')
    assert.equal(recorded.candidates[0].testResult.passed, true)
    assert.deepEqual(recorded.candidates[0].slot, { provider: 'p1', model: 'm1' })
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Block 4 (#170): generateMoABenchmarkReport handles testGate array and flexible token fields', () => {
  const report = generateMoABenchmarkReport({
    runId: 'report-multi-tg',
    usage: { totalInputTokens: 1200, totalOutputTokens: 800 },
    candidates: [
      {
        index: 1,
        label: 'prov:cand1',
        usage: { prompt_tokens: 600, completion_tokens: 400 },
        costUsd: 0.004,
      },
    ],
    testGate: [
      { label: 'Candidate 1', passed: true, command: 'npm test', exitCode: 0, output: '10 pass' },
      { label: 'Candidate 2', passed: false, command: 'npm test', exitCode: 1, output: '1 fail' },
    ],
  })

  assert.ok(report.markdown.includes('**Tokens**: `2000` (In: 1200, Out: 800)'))
  assert.ok(report.markdown.includes('1/2 FAILED'))
  assert.ok(report.markdown.includes('**Candidate 1**: ✅ PASSED'))
  assert.ok(report.markdown.includes('**Candidate 2**: ❌ FAILED'))
  assert.equal(report.json.usage.totalTokens, 2000)
  assert.equal(report.json.candidates[0].usage.totalTokens, 1000)
})

test('Block 4 (#183): history line counting uses buffer-scanned newlines rather than guessing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-hist-183-'))
  const histFile = path.join(tmpDir, 'history.jsonl')
  try {
    // Generate a file with exactly 15 large lines (> 70KB to exceed 64KB fast-path)
    let content = ''
    for (let i = 1; i <= 15; i++) {
      content += JSON.stringify({ id: `run-${i}`, padding: 'x'.repeat(5000) }) + '\n'
    }
    fs.writeFileSync(histFile, content, 'utf8')
    const stat = fs.statSync(histFile)
    assert.ok(stat.size > 65536, 'File should exceed 64KB')

    invalidateHistoryCache()
    const counted = countFileLinesSync(histFile, stat)
    assert.equal(counted, 15, 'Line count must be exact (15), not an estimate like stat.size/250')

    const history = getMoaHistory(5, 0, histFile)
    assert.equal(history.total, 15, 'getMoaHistory total must be exact 15')
    assert.equal(history.runs.length, 5)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Block 4 (#184): readTailLinesSync does not corrupt UTF-8 multi-byte characters at chunk boundaries', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-hist-184-'))
  const histFile = path.join(tmpDir, 'history-utf8.jsonl')
  try {
    // 64KB chunk boundary test with Cyrillic text
    const targetRussian = 'Тестирование многобайтовых символов UTF-8 без повреждения данных'
    // Build a file where line 2 crosses the 64KB boundary right in the middle of Cyrillic text
    const paddingLength = 65536 - 30
    const line1 = JSON.stringify({ id: 'run-1', text: 'a'.repeat(paddingLength) })
    const line2 = JSON.stringify({ id: 'run-2', text: targetRussian })
    const line3 = JSON.stringify({ id: 'run-3', text: 'Последняя строка' })

    fs.writeFileSync(histFile, `${line1}\n${line2}\n${line3}\n`, 'utf8')

    const lines = readTailLinesSync(histFile, 3)
    assert.equal(lines.length, 3)

    const parsedLine2 = JSON.parse(lines[1])
    assert.equal(parsedLine2.text, targetRussian, 'Multi-byte UTF-8 string must NOT contain \\uFFFD replacement characters')
    assert.ok(!lines[1].includes('\uFFFD'), 'Must contain 0 replacement characters')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('Block 4 (#185): getMoaLeaderboard correctly credits wins for fallback models and winnerIndex', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-hist-185-'))
  const histFile = path.join(tmpDir, 'history-lb.jsonl')
  try {
    // Run where candidate 1 is a fallback model with fallback label
    recordMoaRun({
      prompt: 'Code task with fallback winner',
      candidates: [
        {
          index: 1,
          provider: 'anthropic',
          model: 'claude-3-haiku',
          wasFallback: true,
          originalModel: 'anthropic:claude-3-5-sonnet',
          usage: { inputTokens: 100, outputTokens: 200 },
          costUsd: 0.001,
        },
        {
          index: 2,
          provider: 'openai',
          model: 'gpt-4o-mini',
          usage: { inputTokens: 100, outputTokens: 150 },
          costUsd: 0.001,
        },
      ],
      winnerIndex: 1,
      // runner produces this exact label format for recovered fallbacks
      winnerModel: 'anthropic:claude-3-haiku [fallback for anthropic:claude-3-5-sonnet]',
    }, histFile)

    invalidateHistoryCache()
    const lb = getMoaLeaderboard(histFile)
    assert.equal(lb.totalRuns, 1)

    const haikuStats = lb.models.find((m) => m.modelKey === 'anthropic:claude-3-haiku')
    assert.ok(haikuStats, 'Fallback model must exist in leaderboard')
    assert.equal(haikuStats.wins, 1, 'Fallback winner must be credited with 1 win despite [fallback for ...] suffix')
    assert.equal(haikuStats.winRate, 100)

    const miniStats = lb.models.find((m) => m.modelKey === 'openai:gpt-4o-mini')
    assert.ok(miniStats)
    assert.equal(miniStats.wins, 0)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
