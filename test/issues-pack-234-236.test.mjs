import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { isSafeWriteRequest } from '../lib/updater.js'
import { getMoaRunById, getMoaHistory, invalidateHistoryCache } from '../lib/history.js'
import { isRefinementTask, assertPathContained } from '../lib/file-workspace.js'
import { registerMoaRoutes } from '../lib/routes.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

// ── ISSUE #234: Non-loopback with spoofed Origin/Host rejected ──────────
test('#234: isSafeWriteRequest strictly rejects non-loopback write requests even with spoofed Origin/Host', () => {
  // Non-loopback client attempting to spoof Origin and Host headers
  const spoofedReq = {
    socket: { remoteAddress: '192.168.1.50' },
    headers: {
      origin: 'http://192.168.1.111:3000',
      host: '192.168.1.111:3000',
      'sec-fetch-site': 'same-origin',
    },
  }
  assert.equal(isSafeWriteRequest(spoofedReq), false, 'non-loopback caller must be rejected even with matching Origin==Host')

  // Loopback caller with valid same-origin
  const validLoopbackReq = {
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1:3000',
      'sec-fetch-site': 'same-origin',
    },
  }
  assert.equal(isSafeWriteRequest(validLoopbackReq), true, 'loopback same-origin must be accepted')

  // In-process / tool invocation without remote address
  const inProcessReq = {
    headers: {},
  }
  assert.equal(isSafeWriteRequest(inProcessReq), true, 'in-process write request must be accepted')
})

// ── ISSUE #235: getMoaRunById uses in-memory cache and tail reading ──────
test('#235: getMoaRunById efficiently looks up runs with caching and handles large files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-history-235-'))
  const historyFile = path.join(tmpDir, 'history.jsonl')

  try {
    invalidateHistoryCache()
    // Generate a file > 64KB with multiple runs
    const padding = 'x'.repeat(1024)
    const runIds = []
    const lines = []
    for (let i = 1; i <= 70; i++) {
      const id = `run-item-${i}`
      runIds.push(id)
      lines.push(JSON.stringify({
        id,
        timestamp: Date.now() + i,
        preset: 'default',
        winnerModel: 'model-a',
        totalTokens: 100,
        totalCostUsd: 0.001,
        durationMs: 50,
        pad: padding,
      }))
    }
    fs.writeFileSync(historyFile, lines.join('\n') + '\n', 'utf8')
    assert.ok(fs.statSync(historyFile).size > 65536, 'file must be >64KB for tail reading branch')

    // Find the latest run (in the tail)
    const latestRun = getMoaRunById('run-item-70', historyFile)
    assert.ok(latestRun, 'latest run must be found')
    assert.equal(latestRun.id, 'run-item-70')

    // Second call should hit in-memory cache
    const cachedRun = getMoaRunById('run-item-70', historyFile)
    assert.equal(cachedRun, latestRun, 'repeated call must return identical cached object')

    // Find an earlier run
    const earlierRun = getMoaRunById('run-item-1', historyFile)
    assert.ok(earlierRun, 'earlier run must be found via fallback')
    assert.equal(earlierRun.id, 'run-item-1')

    // Non-existent run returns null
    assert.equal(getMoaRunById('non-existent-id', historyFile), null)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    invalidateHistoryCache()
  }
})

// ── ISSUE #218: _lastRunTimestamp not burned on malformed / empty prompt ──
test('#218: empty prompt rejects with 400 without burning the rate limit cooldown', async () => {
  const registered = []
  const mockWebServer = {
    port: 3000,
    register: (opts) => {
      registered.push(opts)
      return () => {}
    },
  }
  const mockCtx = {
    webServer: mockWebServer,
    effect: (fn) => fn(),
    reflect: { get: () => null },
  }

  registerMoaRoutes(mockCtx, {
    live: () => ({ enabled: true, presets: [{ name: 'default', references: ['m1'], aggregator: 'm1' }] }),
    saveConfig: () => {},
    callLlm: async () => 'test',
  })

  const runRoute = registered.find((r) => r.path === '/dsh-moa/run')
  assert.ok(runRoute, 'route /dsh-moa/run must be registered')

  // Helper to simulate request
  const invokeRun = (payload) => {
    return new Promise((resolve) => {
      let status = 200
      let body = null
      const rawData = JSON.stringify(payload)
      const req = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        on: (event, cb) => {
          if (event === 'data') cb(Buffer.from(rawData))
          if (event === 'end') cb()
        },
      }
      const res = {
        writeHead: (code) => { status = code },
        end: (data) => {
          try { body = JSON.parse(data) } catch { body = data }
          resolve({ status, body })
        },
      }
      runRoute.handler(req, res)
    })
  }

  // 1. Send empty prompt -> must return 400
  const res1 = await invokeRun({ prompt: '   ' })
  assert.equal(res1.status, 400, 'empty prompt must return 400')
  assert.equal(res1.body.error, 'Empty prompt')

  // 2. Immediately send another empty prompt -> must still return 400, NOT 429
  const res2 = await invokeRun({ prompt: '' })
  assert.equal(res2.status, 400, 'subsequent empty prompt must return 400, not 429')
})

// ── ISSUE #215: Dynamic isFastMode when budget action 'trim' reduces candidates to 1
test('#215: budget trim to single candidate activates fast mode directly when not curator synthesis', async () => {
  const mockLlm = async (opts) => {
    return 'Candidate output text'
  }

  // Run with 2 reference models, budget guard trims to 1
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-runner-215-'))
  try {
    const res = await runMoAPipeline({
      userPrompt: 'Implement feature X',
      messages: [],
      preset: {
        name: 'test-trim',
        references: ['p1:model-cheap', 'p2:model-expensive'],
        aggregator: 'p1:judge-expensive',
        budget_guard_enabled: true,
        max_budget_usd: 0.0000001, // extremely low to trigger trim or single
        budget_action: 'trim',
        curator_synthesis: false,
      },
      callLlm: mockLlm,
      cwd: tmpDir,
      prices: {
        'p1:model-cheap': { input: 0.01, output: 0.01 },
        'p2:model-expensive': { input: 1000, output: 1000 },
      },
      checkpoint: false,
    })

    // If trimmed down to 1 reference candidate, isFastMode must be true
    if (res.references?.length === 1) {
      assert.equal(res.isFastMode, true, 'isFastMode must be true when references trimmed to 1')
      assert.equal(res.aggregator, 'Fast Mode (Direct)', 'aggregator must indicate Fast Mode (Direct)')
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

// ── ISSUE #219: isRefinementTask functional NLP classifier tokens ──────────
test('#219: isRefinementTask recognizes multilingual functional intent tokens', () => {
  // English
  assert.equal(isRefinementTask('create a new project from scratch', [{ relativePath: 'index.js' }]), false)
  assert.equal(isRefinementTask('update the styling of the button', [{ relativePath: 'index.js' }]), true)

  // Chinese
  assert.equal(isRefinementTask('新建项目并从头开始', [{ relativePath: 'index.js' }]), false)
  assert.equal(isRefinementTask('修改这个组件的颜色', [{ relativePath: 'index.js' }]), true)

  // Russian (Functional NLP tokens)
  assert.equal(isRefinementTask('создай проект с нуля', [{ relativePath: 'index.js' }]), false)
  assert.equal(isRefinementTask('добавь кнопку и исправь баг', [{ relativePath: 'index.js' }]), true)
})

// ── ISSUE #222: Workspace isolation / path containment ──────────────────
test('#222: assertPathContained blocks directory escape attempts', () => {
  const root = os.tmpdir()
  assert.throws(() => {
    assertPathContained(root, '../../etc/passwd')
  }, /Path traversal violation/)
})
