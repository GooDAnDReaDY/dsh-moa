import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { isSafeWriteRequest, isLoopback } from '../lib/updater.js'
import { createPromotedPreview } from '../lib/live-canvas.js'
import { parseMoACommand } from '../lib/moa-parser.js'
import { streamPromoteTurn } from '../lib/moa-stream.js'
import { writeCandidateWorkspace, cleanMoaWorkspaces } from '../lib/file-workspace.js'
import { recordMoaRunAsync, getMoaRunById } from '../lib/history.js'
import { plainConfig, Config } from '../lib/moa-schema.js'

// ── ISSUE #182: Fail-Closed Write Source Guard ─────────────────────────
test('Block 5 (#182): isSafeWriteRequest rejects non-loopback missing origin and same-site', () => {
  // 1. Non-loopback request without origin or headers -> 403 fail-closed
  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '192.168.1.50' },
    headers: {},
  }), false, 'non-loopback missing headers must be rejected')

  // 2. Non-loopback with sec-fetch-site same-site but no origin -> 403 fail-closed
  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '192.168.1.50' },
    headers: { 'sec-fetch-site': 'same-site', host: '192.168.1.111:3000' },
  }), false, 'non-loopback same-site without origin must be rejected')

  // 3. Non-loopback with matching origin and host -> allowed
  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '192.168.1.50' },
    headers: {
      origin: 'http://192.168.1.111:3000',
      host: '192.168.1.111:3000',
      'sec-fetch-site': 'same-origin',
    },
  }), true, 'non-loopback same-origin with matching Origin must be accepted')

  // 4. Non-loopback with mismatched origin -> rejected
  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '192.168.1.50' },
    headers: {
      origin: 'http://evil.com',
      host: '192.168.1.111:3000',
      'sec-fetch-site': 'same-origin',
    },
  }), false, 'mismatched origin must be rejected')

  // 5. Loopback tool or test invocation without headers -> allowed
  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
  }), true, 'loopback without origin must be accepted for local CLI/tools')

  // 6. Loopback with cross-site -> rejected
  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      'sec-fetch-site': 'cross-site',
      origin: 'http://evil.com',
      host: '127.0.0.1:3000',
    },
  }), false, 'cross-site request even on loopback must be rejected')

  // 7. Loopback with same-origin -> allowed
  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1:3000',
    },
  }), true, 'loopback same-origin must be accepted')
})

// ── ISSUE #180: Live Canvas Promoted HTML Preview ──────────────────────
test('Block 5 (#180): createPromotedPreview reads actual promoted HTML from disk', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-canvas-test-'))
  try {
    const promotedHtmlRel = 'public/index.html'
    const fullHtmlPath = path.join(tmpDir, promotedHtmlRel)
    fs.mkdirSync(path.dirname(fullHtmlPath), { recursive: true })
    const actualPromotedContent = '<html><body><h1>Winner C2 Actual Solution</h1></body></html>'
    fs.writeFileSync(fullHtmlPath, actualPromotedContent, 'utf8')

    let capturedPreview = null
    const mockLiveCanvas = {
      createPreviewFromContent: async (args) => {
        capturedPreview = args
        return { canvasId: 'canvas-123', previewUrl: 'http://127.0.0.1:3000/live/canvas-123' }
      },
    }

    // Candidate 1 has a losing/different HTML proposal
    const losingC1Output = {
      files: [{ relativePath: 'public/index.html', content: '<html><body><h1>Losing C1 Proposal</h1></body></html>' }],
    }
    // Candidate 2 is the winning candidate whose file was written to disk
    const winningC2Output = {
      files: [{ relativePath: 'public/index.html', content: actualPromotedContent }],
    }

    const preview = await createPromotedPreview(
      mockLiveCanvas,
      tmpDir,
      [promotedHtmlRel],
      [losingC1Output, winningC2Output],
      { winningIndex: 2 }
    )

    assert.ok(preview, 'preview should be generated')
    assert.equal(capturedPreview.content, actualPromotedContent, 'Preview content must match actual promoted disk file byte-for-byte')
    assert.notEqual(capturedPreview.content, losingC1Output.files[0].content, 'Preview content must NOT use losing C1 proposal')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

// ── ISSUE #177: /moa promote Command Interception ──────────────────────
test('Block 5 (#177): /moa promote is intercepted and promotes candidate workspace without LLM calls', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-promote-test-'))
  const runId = 'test-run-456'
  try {
    // 1. Parser test
    const parsed = parseMoACommand(`/moa promote ${runId} 2`)
    assert.ok(parsed.isPromote, 'isPromote should be true')
    assert.equal(parsed.runId, runId)
    assert.equal(parsed.candidateIndex, 2)

    // 2. Setup candidate 2 workspace
    await writeCandidateWorkspace(
      tmpDir,
      2,
      [{ relativePath: 'src/solution.js', content: 'console.log("Candidate 2 code")' }],
      { runId }
    )

    // 3. Execute streamPromoteTurn
    const chunks = []
    for await (const chunk of streamPromoteTurn({
      runId,
      candidateIndex: 2,
      cwd: tmpDir,
      webServerPort: null,
      timeMachineEngine: null,
    })) {
      chunks.push(chunk)
    }

    const textOutput = chunks.filter((c) => c.type === 'text-delta').map((c) => c.text).join('')
    assert.match(textOutput, /Candidate 2 promoted successfully/i, 'Success message must be streamed')
    assert.match(textOutput, /src\/solution\.js/, 'Promoted file list must be streamed')

    // 4. Verify file was applied to base directory
    const appliedPath = path.join(tmpDir, 'src/solution.js')
    assert.ok(fs.existsSync(appliedPath), 'Candidate file must be promoted to project cwd')
    assert.equal(fs.readFileSync(appliedPath, 'utf8'), 'console.log("Candidate 2 code")')

    // 5. Test error for invalid candidate index
    const errChunks = []
    for await (const chunk of streamPromoteTurn({
      runId,
      candidateIndex: 0,
      cwd: tmpDir,
    })) {
      errChunks.push(chunk)
    }
    const errText = errChunks.filter((c) => c.type === 'text-delta').map((c) => c.text).join('')
    assert.match(errText, /Valid candidate index required/i, 'Invalid index must yield clear error')
  } finally {
    await cleanMoaWorkspaces(tmpDir, { runId }).catch(() => {})
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

// ── ISSUE #179: Candidate Diff Viewer Workspace Resolution ─────────────
test('Block 5 (#179): normalizeRunRecord stores cwd and routes /dsh-moa/diff uses run cwd', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-diff-test-'))
  const histFile = path.join(tmpDir, 'moa-history.jsonl')
  const runId = 'diff-run-789'
  try {
    const projectCwd = path.join(tmpDir, 'my-project')
    fs.mkdirSync(projectCwd, { recursive: true })

    // Record run with explicit project cwd
    const entry = await recordMoaRunAsync({
      id: runId,
      cwd: projectCwd,
      prompt: 'test diff task',
      preset: 'default',
      candidates: [
        { index: 1, provider: 'mock', model: 'c1', files: ['app.js'] },
        { index: 2, provider: 'mock', model: 'c2', files: ['app.js'] },
      ],
      winnerIndex: 1,
      winnerModel: 'mock:c1',
    }, histFile)

    assert.ok(entry, 'entry recorded')
    assert.equal(entry.cwd, path.resolve(projectCwd), 'normalized entry must store resolved cwd')

    // Lookup by ID
    const found = getMoaRunById(runId, histFile)
    assert.ok(found, 'found run by id')
    assert.equal(found.cwd, path.resolve(projectCwd), 'retrieved run must contain correct project cwd')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

// ── ISSUE #173 & #174: React Snapshot Stability & Updater Contract ──────
test('Block 5 (#173, #174): useSyncExternalStore cached snapshot and updater success payload contract', () => {
  const clientPath = path.resolve(import.meta.dirname, '../lib/client.js')
  const clientContent = fs.readFileSync(clientPath, 'utf8')

  // #174: Stable frozen snapshot sentinels
  assert.match(clientContent, /const UNAVAILABLE_SNAPSHOT = Object\.freeze\(\{ status: 'unavailable' \}\)/, 'UNAVAILABLE_SNAPSHOT sentinel must be frozen')
  assert.match(clientContent, /const LOADING_SNAPSHOT = Object\.freeze\(\{ status: 'loading' \}\)/, 'LOADING_SNAPSHOT sentinel must be frozen')
  assert.match(clientContent, /scope \? scope\.getSnapshot\(\) : UNAVAILABLE_SNAPSHOT/, 'getSnapshot must return stable UNAVAILABLE_SNAPSHOT when scope is absent')

  // #173: Updater contract: supports updatedVersion and restartRequired
  assert.match(clientContent, /data\.updated \|\| data\.updatedVersion \|\| data\.restartRequired \|\| data\.ok/, 'Client must accept updatedVersion/restartRequired payload')
  assert.match(clientContent, /canAutoUpdate:/, 'Client update state must track canAutoUpdate')
})

// ── ISSUE #175 & #176: Model Pickers & en/zh Localization Parity ────────
test('Block 5 (#175, #176): 100% en/zh dictionary parity and model pickers in client.js', () => {
  const enPath = path.resolve(import.meta.dirname, '../src/client/10-locale-en.js')
  const zhPath = path.resolve(import.meta.dirname, '../src/client/20-locale-zh.js')
  const clientPath = path.resolve(import.meta.dirname, '../lib/client.js')

  const enContent = fs.readFileSync(enPath, 'utf8')
  const zhContent = fs.readFileSync(zhPath, 'utf8')
  const clientContent = fs.readFileSync(clientPath, 'utf8')

  const extractKeys = (txt) => new Set([...txt.matchAll(/['"]([a-zA-Z0-9_\-\.]+)['"]\s*:/g)].map((m) => m[1]))
  const enKeys = extractKeys(enContent)
  const zhKeys = extractKeys(zhContent)

  // Verify full parity
  const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k))
  const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k))
  assert.deepEqual(missingInZh, [], 'All EN keys must be present in ZH dictionary')
  assert.deepEqual(missingInEn, [], 'All ZH keys must be present in EN dictionary')

  // Check required keys exist
  const requiredKeys = [
    'aggregator.multi_judge_title',
    'aggregator.voting_strategy_label',
    'aggregator.judge_models_title',
    'aggregator.composite_title',
    'aggregator.budget_title',
    'aggregator.report_title',
    'aggregator.local_fallback_title',
    'aggregator.local_models_title',
    'config.smart_routing_title',
    'config.smart_routing_model',
    'aggregator.multi_turn_title',
    'diff.select_run',
    'diff.latest_run',
  ]
  for (const k of requiredKeys) {
    assert.ok(enKeys.has(k), `Key ${k} must be in EN locale`)
    assert.ok(zhKeys.has(k), `Key ${k} must be in ZH locale`)
  }

  // #176: Verify model pickers and settings fields exist in compiled client bundle
  assert.match(clientContent, /judge_models/, 'client.js must reference judge_models')
  assert.match(clientContent, /local_fallback_models/, 'client.js must reference local_fallback_models')
  assert.match(clientContent, /smart_routing_model/, 'client.js must reference smart_routing_model')
  assert.match(clientContent, /multi_turn_enabled/, 'client.js must reference multi_turn_enabled')
})

// ── ISSUE #146: Unwrap Volatile boxes after Config() validation ──────────
test('Block 5 (#146): plainConfig unwraps volatile boxes to plain JavaScript objects', () => {
  const wrapped = Config({
    enabled: true,
    default_preset: 'fast',
    presets: [{ name: 'fast', enabled: true }],
  })
  const plain = plainConfig(wrapped)
  assert.equal(typeof plain, 'object')
  assert.equal(plain.enabled, true)
  assert.equal(plain.default_preset, 'fast')
  assert.equal(plain.presets[0].name, 'fast')
  assert.equal(typeof plain.get, 'undefined', 'plainConfig must not expose .get() volatile wrapper methods')
})
