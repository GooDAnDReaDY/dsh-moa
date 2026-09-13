import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { verifyFileSyntax } from '../lib/file-workspace.js'
import {
  ROLE_PERSONA_PROMPTS,
  SYNTAX_CORRECTION_DIRECTIVE,
  buildPeerCritiquePrompt,
  buildSynthesisPrompt,
  buildCuratorSynthesisPrompt,
} from '../lib/moa-prompts.js'
import {
  parseMoACommand,
  formatMoAResponse,
} from '../lib/moa-parser.js'
import {
  getMoaLeaderboard,
  exportMoaHistory,
  recordMoaRun,
} from '../lib/history.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

test('verifyFileSyntax: accurately validates syntax for JS, MJS, and JSON files', () => {
  // Valid files
  const validFiles = [
    { relativePath: 'src/index.js', content: 'const a = 1;\nfunction foo() { return a + 2; }\nexport default foo;' },
    { relativePath: 'config.json', content: '{"name": "test", "active": true, "count": 42}' },
  ]
  const noWarnings = verifyFileSyntax(validFiles)
  assert.equal(noWarnings.length, 0)

  // Invalid JS syntax (unclosed curly brace)
  const brokenJs = [
    { relativePath: 'src/broken.js', content: 'function bad() { const x = 10;\nreturn x;' },
  ]
  const jsWarnings = verifyFileSyntax(brokenJs)
  assert.equal(jsWarnings.length, 1)
  assert.equal(jsWarnings[0].file, 'src/broken.js')
  assert.ok(jsWarnings[0].error.length > 0)

  // Invalid JSON syntax (trailing comma / missing quote)
  const brokenJson = [
    { relativePath: 'data.json', content: '{ name: invalid }' },
  ]
  const jsonWarnings = verifyFileSyntax(brokenJson)
  assert.equal(jsonWarnings.length, 1)
  assert.equal(jsonWarnings[0].file, 'data.json')
})

test('ROLE_PERSONA_PROMPTS: defines specialized engineering archetypes', () => {
  assert.ok(ROLE_PERSONA_PROMPTS.minimalist.includes('Ponytail'))
  assert.ok(ROLE_PERSONA_PROMPTS.minimalist.includes('standard library'))
  assert.ok(ROLE_PERSONA_PROMPTS.robustness.includes('ROBUSTNESS'))
  assert.ok(ROLE_PERSONA_PROMPTS.performance.includes('PERFORMANCE'))
  assert.ok(ROLE_PERSONA_PROMPTS.tester.includes('TESTABILITY'))
})

test('SYNTAX_CORRECTION_DIRECTIVE: injected into judge prompts when candidates have syntax warnings', () => {
  const responsesWithWarning = [
    {
      label: 'prov:model-a',
      text: '```javascript file="index.js"\nconst a = 1;\n```',
      syntaxWarning: 'index.js: Unexpected token',
      files: [{ relativePath: 'index.js' }],
    },
    {
      label: 'prov:model-b',
      text: 'Clean solution',
      files: [],
    },
  ]

  const prompt = buildSynthesisPrompt('Implement task', responsesWithWarning, '', { blindEvaluation: false })
  assert.ok(prompt.includes('[⚠️ Syntax Warning: index.js: Unexpected token]'))
  assert.ok(prompt.includes(SYNTAX_CORRECTION_DIRECTIVE))
  assert.ok(prompt.includes('CRITICAL JUDGE DIRECTIVE: If a candidate with a syntax flaw presents superior architecture'))

  const curatorPrompt = buildCuratorSynthesisPrompt('Implement task', responsesWithWarning, '', { blindEvaluation: false })
  assert.ok(curatorPrompt.includes('[⚠️ Syntax Warning: index.js: Unexpected token]'))
  assert.ok(curatorPrompt.includes(SYNTAX_CORRECTION_DIRECTIVE))
})

test('buildPeerCritiquePrompt: generates Round 2 Consilium review prompt with opponent solutions', () => {
  const myProposal = 'function myAlgo() { return 42; }'
  const opponents = [
    { label: 'prov:model-b', text: 'function opponentAlgo() { return 100; }' },
  ]

  const prompt = buildPeerCritiquePrompt('Optimize sorting', myProposal, opponents, true)
  assert.ok(prompt.includes('Round 2 (Consilium / Peer Critique'))
  assert.ok(prompt.includes('Your Initial Solution (Round 1):'))
  assert.ok(prompt.includes(myProposal))
  assert.ok(prompt.includes('Alternative Solutions from Peer Candidates:'))
  assert.ok(prompt.includes('Candidate 1 Alternative Proposal:'))
  assert.ok(prompt.includes('function opponentAlgo()'))
})

test('parseMoACommand: parses /moa promote subcommands', () => {
  const parsedFull = parseMoACommand('/moa promote run-xyz-123 2')
  assert.ok(parsedFull.isPromote)
  assert.equal(parsedFull.runId, 'run-xyz-123')
  assert.equal(parsedFull.candidateIndex, 2)

  const parsedShort = parseMoACommand('/moa promote 3')
  assert.ok(parsedShort.isPromote)
  assert.equal(parsedShort.candidateIndex, 3)

  const parsedRegular = parseMoACommand('/moa refactor-cleanup clean the code', [{ name: 'refactor-cleanup' }])
  assert.equal(parsedRegular.isPromote, undefined)
  assert.equal(parsedRegular.presetName, 'refactor-cleanup')
  assert.equal(parsedRegular.prompt, 'clean the code')
})

test('formatMoAResponse: renders candidate override actions when allowCandidateOverride is true', () => {
  const moaResult = {
    kind: 'synthesis',
    content: 'Final synthesized code',
    aggregator: 'judge:gpt-5',
    winningIndex: 1,
    runId: 'test-run-999',
    allowCandidateOverride: true,
    references: [
      { label: 'prov1:model-alpha', ok: true, text: 'Solution 1' },
      { label: 'prov2:model-beta', ok: true, text: 'Solution 2' },
    ],
  }

  const output = formatMoAResponse({ moaResult, presetName: 'code-review' })
  assert.ok(output.includes('### 🔄 Candidate Override Actions'))
  assert.ok(output.includes('/moa promote test-run-999 1'))
  assert.ok(output.includes('/moa promote test-run-999 2'))
})

test('exportMoaHistory: exports filtered CSV and JSON telemetry', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-export-test-'))
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

  const historyFile = path.join(tmpDir, 'moa-history.jsonl')
  recordMoaRun({
    id: 'run-1',
    preset: 'code-review',
    winnerModel: 'p1:m1',
    totalTokens: 1200,
    totalCostUsd: 0.005,
    durationMs: 1500,
    candidates: [{ provider: 'p1', model: 'm1', costUsd: 0.005 }],
  }, historyFile)

  recordMoaRun({
    id: 'run-2',
    preset: 'fast-audit',
    winnerModel: 'p2:m2',
    totalTokens: 800,
    totalCostUsd: 0.002,
    durationMs: 800,
    candidates: [{ provider: 'p2', model: 'm2', costUsd: 0.002 }],
  }, historyFile)

  // CSV export all
  const csvAll = exportMoaHistory(historyFile, { format: 'csv' })
  assert.ok(csvAll.includes('id,timestamp,preset,winnerModel,totalTokens,totalCostUsd,durationMs'))
  assert.ok(csvAll.includes('run-1'))
  assert.ok(csvAll.includes('code-review'))
  assert.ok(csvAll.includes('run-2'))

  // CSV export filtered by preset
  const csvFiltered = exportMoaHistory(historyFile, { format: 'csv', preset: 'code-review' })
  assert.ok(csvFiltered.includes('run-1'))
  assert.ok(!csvFiltered.includes('run-2'))

  // JSON export filtered
  const jsonFiltered = exportMoaHistory(historyFile, { format: 'json', preset: 'fast-audit' })
  const parsed = JSON.parse(jsonFiltered)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].id, 'run-2')
})

test('getMoaLeaderboard: calculates stats with preset filter', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-lb-filter-'))
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

  const historyFile = path.join(tmpDir, 'moa-history.jsonl')
  recordMoaRun({
    preset: 'code-review',
    winnerModel: 'p1:m1',
    candidates: [
      { provider: 'p1', model: 'm1' },
      { provider: 'p2', model: 'm2' },
    ],
  }, historyFile)

  recordMoaRun({
    preset: 'math-logic',
    winnerModel: 'p2:m2',
    candidates: [
      { provider: 'p1', model: 'm1' },
      { provider: 'p2', model: 'm2' },
    ],
  }, historyFile)

  const lbAll = getMoaLeaderboard(historyFile)
  assert.equal(lbAll.totalRuns, 2)

  const lbCodeReview = getMoaLeaderboard(historyFile, { preset: 'code-review' })
  assert.equal(lbCodeReview.totalRuns, 1)
  const m1 = lbCodeReview.models.find((m) => m.modelKey === 'p1:m1')
  assert.ok(m1)
  assert.equal(m1.wins, 1)
})

test('runMoAPipeline: Consilium Round 2 executes peer critique when enabled', async () => {
  const callLog = []
  const mockCallLlm = async (callArgs) => {
    callLog.push({ model: callArgs.model, messages: callArgs.messages })
    if (callArgs.model === 'judge-model') {
      return {
        content: 'WINNER_CANDIDATE_INDEX: 1\nRECOMMENDED_ASSEMBLER: 1\nFinal assembly code',
        usage: { inputTokens: 50, outputTokens: 20 },
      }
    }
    const isRound2 = callArgs.messages.some((m) => m.content.includes('Round 2 (Consilium'))
    if (isRound2) {
      return {
        content: `Refined and improved solution by ${callArgs.model}`,
        usage: { inputTokens: 20, outputTokens: 20 },
      }
    }
    return {
      content: `Initial proposal by ${callArgs.model}`,
      usage: { inputTokens: 10, outputTokens: 10 },
    }
  }

  const result = await runMoAPipeline({
    userPrompt: 'Implement concurrent queue in Go',
    preset: {
      reference_models: [
        { provider: 'p1', model: 'model-a', role_persona: 'performance' },
        { provider: 'p2', model: 'model-b', role_persona: 'robustness' },
      ],
      aggregator: { provider: 'p-judge', model: 'judge-model' },
      peer_critique_enabled: true,
      ask_clarifying_questions: false,
    },
    callLlm: mockCallLlm,
  })

  assert.ok(result)
  // Verify Round 2 was invoked
  const round2Calls = callLog.filter((c) => c.messages.some((m) => m.content.includes('Round 2 (Consilium')))
  assert.equal(round2Calls.length, 2, 'Both candidates must participate in Round 2 Consilium')
})
