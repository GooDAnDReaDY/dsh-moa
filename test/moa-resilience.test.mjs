import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  rotateHistoryFileIfNeeded,
  recordMoaRun,
  recordMoaRunAsync,
  getMoaHistory,
  getMoaLeaderboard,
  MAX_HISTORY_BYTES,
} from '../lib/history.js'

import {
  slotLabel,
  cleanAdvisoryMessages,
  isBroadPromptRequiringQuestions,
  buildQuestionSynthesisPrompt,
  buildCuratorSynthesisPrompt,
  buildSynthesisPrompt,
  ANTIPATTERNS_RUBRIC,
} from '../lib/moa-prompts.js'

import {
  parseWinnerIndex,
  parseRecommendedAssembler,
  parseMoACommand,
  stripOrSummarizeCode,
  formatMoAResponse,
} from '../lib/moa-parser.js'

import { runMoAPipeline } from '../lib/moa-runner.js'

test('history: rotateHistoryFileIfNeeded rotates files exceeding max size threshold', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-rot-test-'))
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

  const historyFile = path.join(tmpDir, 'moa-history.jsonl')
  const backupFile = `${historyFile}.1`

  // 1. Below threshold: no rotation
  fs.writeFileSync(historyFile, 'line1\nline2\n', 'utf8')
  const rotatedSmall = rotateHistoryFileIfNeeded(historyFile, 1000)
  assert.equal(rotatedSmall, false)
  assert.ok(fs.existsSync(historyFile))
  assert.equal(fs.existsSync(backupFile), false)

  // 2. Above threshold: file is renamed to .1
  const rotatedLarge = rotateHistoryFileIfNeeded(historyFile, 5)
  assert.equal(rotatedLarge, true)
  assert.equal(fs.existsSync(historyFile), false)
  assert.ok(fs.existsSync(backupFile))
  assert.equal(fs.readFileSync(backupFile, 'utf8'), 'line1\nline2\n')
})

test('history: recordMoaRunAsync appends valid JSONL asynchronously and preserves data', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-async-hist-'))
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

  const historyFile = path.join(tmpDir, 'moa-history.jsonl')

  const res1 = await recordMoaRunAsync({
    prompt: 'async test 1',
    preset: 'default',
    candidates: [{ provider: 'p1', model: 'm1', files: ['app.js'], usage: { inputTokens: 10, outputTokens: 20 }, costUsd: 0.001 }],
    aggregator: { provider: 'judge', model: 'j1', usage: { inputTokens: 5, outputTokens: 15 }, costUsd: 0.002 },
    winnerIndex: 1,
    winnerModel: 'p1:m1',
    promotedFiles: ['app.js'],
    totalTokens: 50,
    totalCostUsd: 0.003,
    durationMs: 120,
  }, historyFile)

  assert.ok(res1)
  assert.equal(res1.prompt, 'async test 1')

  const res2 = await recordMoaRunAsync({
    prompt: 'async test 2',
    preset: 'fast',
    winnerIndex: 1,
    winnerModel: 'p1:m1',
  }, historyFile)

  assert.ok(res2)

  const history = getMoaHistory(10, 0, historyFile)
  assert.equal(history.total, 2)
  assert.equal(history.runs[0].prompt, 'async test 2')
  assert.equal(history.runs[1].prompt, 'async test 1')
})

test('moa-prompts: rubric and prompts build consistent structures', () => {
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Strict Antipatterns Evaluation Checklist'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('Lazy Code & Placeholders'))
  assert.ok(ANTIPATTERNS_RUBRIC.includes('AI Slop UI & Poor Ergonomics'))

  const synthPrompt = buildSynthesisPrompt('make an app', [
    { label: 'p1:m1', text: 'code 1', files: [{ relativePath: 'index.html' }] },
  ], 'be fast')

  assert.ok(synthPrompt.includes('Original user prompt:'))
  assert.ok(synthPrompt.includes('make an app'))
  assert.ok(synthPrompt.includes('be fast'))
  assert.ok(synthPrompt.includes('Reference 1 — p1:m1: [Files created: index.html]'))
})

test('moa-parser: commands, winners and summaries extract expected tokens', () => {
  // Command parsing
  const cmd = parseMoACommand('/moa --preset=fast Build a snake game in canvas', [{ name: 'fast' }])
  assert.equal(cmd.presetName, 'fast')
  assert.equal(cmd.prompt, 'Build a snake game in canvas')

  // Winner parsing
  const winner = parseWinnerIndex('Verdict:\nWINNER_CANDIDATE_INDEX: 3\nGreat job!', 1, 4)
  assert.equal(winner, 3)

  // Recommended assembler parsing
  const assembler = parseRecommendedAssembler('Analysis:\nRECOMMENDED_ASSEMBLER: 2 (opencode:v4-flash)', 1, 4)
  assert.equal(assembler.index, 2)
  assert.equal(assembler.label, 'opencode:v4-flash')

  // Code summarizer
  const longCode = '```javascript\n' + 'console.log("hi");\n'.repeat(10) + '```'
  const summarized = stripOrSummarizeCode(longCode)
  assert.ok(summarized.includes('[code `javascript` - 10 lines saved to disk]'))
})

test('moa-runner: passes custom reference_timeout_sec and aggregator_timeout_sec to callLlm', async () => {
  const recordedTimeouts = []

  const mockCallLlm = async (params) => {
    recordedTimeouts.push({
      provider: params.provider,
      model: params.model,
      timeoutMs: params.timeoutMs,
    })
    return {
      content: 'WINNER_CANDIDATE_INDEX: 1\nResult code here',
      text: 'WINNER_CANDIDATE_INDEX: 1\nResult code here',
      usage: { inputTokens: 50, outputTokens: 50 },
    }
  }

  const preset = {
    name: 'custom-timeouts',
    reference_models: [{ provider: 'fast-p', model: 'fast-m' }],
    aggregator: { provider: 'judge-p', model: 'judge-m' },
    reference_timeout_sec: 45,
    aggregator_timeout_sec: 150,
  }

  const result = await runMoAPipeline({
    userPrompt: 'specific implementation of algorithm',
    messages: [],
    preset,
    callLlm: mockCallLlm,
    cwd: os.tmpdir(),
  })

  assert.equal(result.kind, 'synthesis')
  // Reference model received 45000 ms timeout
  assert.equal(recordedTimeouts[0].timeoutMs, 45000)
  assert.equal(recordedTimeouts[0].provider, 'fast-p')
})
