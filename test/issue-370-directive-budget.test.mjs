import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runMoAPipeline, getDirectiveTelemetry } from '../lib/pipeline/runner.js'
import {
  computeDirectiveBudget,
  assembleDirectives,
  orderByPriority,
  estimateDirectiveTokens,
  DIRECTIVE_PRIORITY,
} from '../lib/pipeline/directive-budget.js'
import { MOA_EVENTS } from '../lib/events.js'

test('Issue #370: computeDirectiveBudget scales with candidate size and clamps', () => {
  // 10_000 chars of candidates * 0.15 = 1500 -> clamped to min 4000
  assert.equal(computeDirectiveBudget([{ text: 'x'.repeat(10_000) }]), 4000)
  // 100_000 chars * 0.15 = 15_000
  assert.equal(computeDirectiveBudget([{ text: 'x'.repeat(50_000) }, { text: 'x'.repeat(50_000) }]), 15_000)
  // clamp to max
  assert.equal(computeDirectiveBudget([{ text: 'x'.repeat(1_000_000) }]), 24_000)
})

test('Issue #370: assembleDirectives includes by priority, never splits, reports omissions', () => {
  const items = [
    { key: 'big1', text: 'A'.repeat(5000) },
    { key: 'big2', text: 'B'.repeat(5000) },
    { key: 'small', text: 'C' },
  ]
  const block = assembleDirectives(items, { budgetChars: 10_000, separator: '\n\n' })
  // Greedy, never split: big2 (+2 separator) exceeds the remaining budget after
  // big1, while the tiny directive still fits
  assert.deepEqual(block.included, ['big1', 'small'])
  assert.deepEqual(block.omitted, ['big2'])
  assert.equal(block.chars, 5000 + 2 + 1)
  assert.ok(block.text.includes('A'.repeat(5000)))
  assert.ok(block.text.includes('C'))
  assert.ok(!block.text.includes('B'.repeat(5000)))
})

test('Issue #370: mandatory directives are never omitted by the budget', () => {
  const block = assembleDirectives(
    [{ key: 'huge', text: 'H'.repeat(50_000) }],
    {
      budgetChars: 4000,
      mandatory: [{ key: 'userCriteria', text: 'USER_CRITERIA_MARKER' }],
    },
  )
  assert.ok(block.text.startsWith('USER_CRITERIA_MARKER'))
  assert.ok(!block.text.includes('H'.repeat(100)), 'oversized optional directive must be omitted')
  assert.deepEqual(block.omitted, ['huge'])
})

test('Issue #370: orderByPriority orders by the declared importance list', () => {
  const ordered = orderByPriority([
    { key: 'mutation', text: 'm' },
    { key: 'security', text: 's' },
    { key: 'syntax', text: 'y' },
    { key: 'unknown', text: 'u' },
  ])
  assert.deepEqual(ordered.map((i) => i.key), ['syntax', 'security', 'mutation', 'unknown'])
  assert.equal(DIRECTIVE_PRIORITY[0], 'syntax')
})

test('Issue #370: estimateDirectiveTokens uses chars/4 convention', () => {
  assert.equal(estimateDirectiveTokens(0), 0)
  assert.equal(estimateDirectiveTokens(1200), 300)
  assert.equal(estimateDirectiveTokens(1201), 301)
})

test('Issue #370: pipeline passes each gate directive to a judge prompt exactly once under budget', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-issue-370-'))
  const historyFile = path.join(tmpDir, 'history.jsonl')
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const capturedPrompts = []
  const mockCallLlm = async (opts) => {
    const content = Array.isArray(opts.messages)
      ? opts.messages.map((m) => m.content || '').join('\n')
      : String(opts.prompt || '')
    capturedPrompts.push(content)
    return 'function solve() { let s = 0; for (let i = 0; i < 4; i++) s += i; return s; }'
  }

  try {
    const result = await runMoAPipeline({
      userPrompt: 'Write a solver',
      preset: {
        name: 'directive-budget-test',
        ask_clarifying_questions: false,
        security_gate_enabled: true,
        profiler_gate_enabled: true,
        mutation_testing_enabled: true,
        judge_criteria: 'USER_CRITERIA_TEXT_370',
        reference_models: [
          { provider: 'mock', model: 'c1', role_persona: 'proposer' },
          { provider: 'mock', model: 'c2', role_persona: 'challenger' },
        ],
        aggregator: { provider: 'mock', model: 'judge' },
      },
      callLlm: mockCallLlm,
      ctx: mockCtx,
      cwd: tmpDir,
      historyFilePath: historyFile,
    })
    assert.ok(result, 'pipeline must complete')

    // Budget events emitted for both stages
    const budgetEvents = emitted.filter((e) => e.ev === MOA_EVENTS.DIRECTIVE_BUDGET)
    const stages = budgetEvents.map((e) => e.p.stage)
    assert.ok(stages.includes('judge-criteria'), 'judge-criteria budget event emitted')
    assert.ok(stages.includes('synthesis'), 'synthesis budget event emitted')

    // Every gate directive appears at most once in every captured prompt
    const markers = [
      'ADVERSARIAL RED TEAM SECURITY AUDIT DIRECTIVE',
      'RUNTIME PERFORMANCE & CPU/MEMORY PROFILER REPORT',
      'RUNTIME MUTATION TESTING & FAULT INJECTION REPORT',
    ]
    for (const prompt of capturedPrompts) {
      for (const marker of markers) {
        const occurrences = prompt.split(marker).length - 1
        assert.ok(occurrences <= 1, `directive "${marker}" duplicated ${occurrences}x in a judge prompt`)
      }
    }

    // Telemetry exposes the last-run directive spend with token estimates
    const telemetry = getDirectiveTelemetry()
    assert.ok(telemetry, 'directive telemetry recorded')
    assert.equal(telemetry.runId, result?.runId || telemetry.runId)
    assert.ok(telemetry.judgeCriteria, 'judge-criteria stats present')
    assert.ok(telemetry.synthesis, 'synthesis stats present')
    assert.ok(typeof telemetry.judgeCriteria.tokens === 'number')
    assert.ok(telemetry.judgeCriteria.chars >= 0)
    assert.ok(Array.isArray(telemetry.judgeCriteria.included))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('Issue #370: GET /dsh-moa/status exposes directive telemetry', async () => {
  const registered = []
  const { registerPresetRoutes } = await import('../lib/routes/presets.js')
  const ctx = {
    webServer: { register: (entry) => { registered.push(entry); return () => {} } },
    effect: (fn) => fn(),
    logger: { warn: () => {}, info: () => {}, error: () => {} },
  }
  registerPresetRoutes(ctx, {
    live: () => ({ enabled: true, presets: [{ name: 'default' }] }),
    callLlm: async () => 'ok',
    saveConfig: async () => ({ persisted: true }),
    Config: (v) => v,
    plainConfig: (v) => v,
  })
  const statusRoute = registered.find((r) => r.path === '/dsh-moa/status')
  assert.ok(statusRoute, 'status route registered')

  let code = 0, json = null
  const req = { method: 'GET', url: '/dsh-moa/status', headers: { host: '127.0.0.1:3000' }, socket: { remoteAddress: '127.0.0.1' } }
  const res = { writeHead: (c) => { code = c }, end: (d) => { json = JSON.parse(d) } }
  await statusRoute.handler(req, res)
  assert.equal(code, 200)
  assert.ok('directiveTelemetry' in json, 'status must expose directiveTelemetry')
})
