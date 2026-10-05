import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import EventEmitter from 'node:events'
import { computeLineDiff, createPrePromotionCheckpoint, writeCandidateWorkspace } from '../lib/file-workspace.js'
import { registerMoaRoutes } from '../lib/routes.js'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { runCandidateTestGate } from '../lib/moa-test-gate.js'
import { apply } from '../lib/index.js'
import { recordMoaRun, invalidateHistoryCache } from '../lib/history.js'

function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = '' } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin', ...headers }
  req.socket = { remoteAddress: '127.0.0.1' }

  let statusCode = 200
  let resHeaders = {}
  let resBody = ''

  const res = new EventEmitter()
  res.writeHead = (code, h) => {
    statusCode = code
    if (h) Object.assign(resHeaders, h)
  }
  res.end = (chunk) => {
    if (chunk) resBody += chunk
    res.emit('finish')
  }

  const send = () => {
    process.nextTick(() => {
      if (body) req.emit('data', Buffer.from(body))
      req.emit('end')
    })
  }

  return {
    req,
    res,
    send,
    getResult: () => new Promise((resolve) => {
      if (resBody) {
        let json = null
        try { json = JSON.parse(resBody) } catch {}
        resolve({ status: statusCode, headers: resHeaders, body: resBody, json })
        return
      }
      res.once('finish', () => {
        let json = null
        try { json = JSON.parse(resBody) } catch {}
        resolve({ status: statusCode, headers: resHeaders, body: resBody, json })
      })
    }),
  }
}

// 1. #227: Large diff 150k lines without RangeError
test('#227: computeLineDiff handles 150k line inputs without stack overflow', () => {
  const a = 'old line\n'.repeat(150000)
  const b = 'new line\n'.repeat(150000)
  const start = Date.now()
  const diff = computeLineDiff(a, b)
  const duration = Date.now() - start
  assert.equal(diff.length, 300001)
  assert.ok(duration < 2000, `computeLineDiff took too long: ${duration}ms`)
})

// 2. #210: Checkpoint fetch rejects redirects (redirect: 'error')
test('#210: createPrePromotionCheckpoint fetch options specify redirect: error', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-210-'))
  let recordedRedirect = null
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    recordedRedirect = options?.redirect
    return { ok: true, json: async () => ({ snapshot: { id: 'snap-1' } }) }
  }
  try {
    const res = await createPrePromotionCheckpoint(tmpDir, 1, {
      webServerPort: 9999,
      timeMachineUrl: 'http://127.0.0.1:9999/checkpoint',
    })
    assert.equal(recordedRedirect, 'error', 'checkpoint fetch must enforce redirect: error')
    assert.equal(res?.id, 'snap-1')
  } finally {
    globalThis.fetch = originalFetch
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
})

// 3. #208: Promote route fail-closed checks
test('#208: POST /dsh-moa/promote fails closed on unknown runId, empty history, and cwd mismatch', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-208-'))
  const histFile = path.join(tmpDir, 'history.jsonl')
  const origHist = process.env.DSH_HISTORY_FILE
  process.env.DSH_HISTORY_FILE = histFile
  invalidateHistoryCache()

  const routes = {}
  const ctx = {
    webServer: { register: (r) => { routes[r.path] = r.handler } },
    effect: (fn) => fn(),
    logger: { warn: () => {} },
  }
  registerMoaRoutes(ctx, { live: () => ({ enabled: true }) })
  const handler = routes['/dsh-moa/promote']

  try {
    // 3a. Unknown explicit runId -> 404
    {
      const { req, res, send, getResult } = createMockReqRes({
        method: 'POST',
        url: '/dsh-moa/promote',
        body: JSON.stringify({ cwd: tmpDir, candidateIndex: 1, runId: 'nonexistent-run-123' }),
      })
      send()
      await handler(req, res)
      const resData = await getResult()
      assert.equal(resData.status, 404)
      assert.match(resData.json?.error, /Run 'nonexistent-run-123' not found/i)
    }

    // 3b. Missing runId with empty history -> 400
    {
      const { req, res, send, getResult } = createMockReqRes({
        method: 'POST',
        url: '/dsh-moa/promote',
        body: JSON.stringify({ cwd: tmpDir, candidateIndex: 1 }),
      })
      send()
      await handler(req, res)
      const resData = await getResult()
      assert.equal(resData.status, 400)
      assert.match(resData.json?.error, /No recorded MoA run found/i)
    }

    // Record a valid run
    const rec = recordMoaRun({ cwd: tmpDir, prompt: 'test prompt', candidateCount: 1 })

    // 3c. Recorded run exists, but caller passes mismatched cwd -> 403
    {
      const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-208-other-'))
      try {
        const { req, res, send, getResult } = createMockReqRes({
          method: 'POST',
          url: '/dsh-moa/promote',
          body: JSON.stringify({ cwd: otherDir, candidateIndex: 1, runId: rec.id }),
        })
        send()
        await handler(req, res)
        const resData = await getResult()
        assert.equal(resData.status, 403)
        assert.match(resData.json?.error, /Forbidden: cwd does not match recorded run cwd/i)
      } finally {
        await fs.rm(otherDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  } finally {
    process.env.DSH_HISTORY_FILE = origHist
    invalidateHistoryCache()
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
})

// 4. #211: Diff route fail-closed checks
test('#211: GET /dsh-moa/diff fails closed on unknown runId and empty history', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-211-'))
  const histFile = path.join(tmpDir, 'history.jsonl')
  const origHist = process.env.DSH_HISTORY_FILE
  process.env.DSH_HISTORY_FILE = histFile
  invalidateHistoryCache()

  const routes = {}
  const ctx = {
    webServer: { register: (r) => { routes[r.path] = r.handler } },
    effect: (fn) => fn(),
    logger: { warn: () => {} },
  }
  registerMoaRoutes(ctx, { live: () => ({ enabled: true }) })
  const handler = routes['/dsh-moa/diff']

  try {
    // 4a. Unknown explicit runId -> 404
    {
      const { req, res, send, getResult } = createMockReqRes({
        method: 'GET',
        url: `/dsh-moa/diff?runId=nonexistent-run-diff&cwd=${encodeURIComponent(tmpDir)}`,
      })
      send()
      await handler(req, res)
      const resData = await getResult()
      assert.equal(resData.status, 404)
      assert.match(resData.json?.error, /Run 'nonexistent-run-diff' not found/i)
    }

    // 4b. Missing runId with empty history -> 404
    {
      const { req, res, send, getResult } = createMockReqRes({
        method: 'GET',
        url: `/dsh-moa/diff?cwd=${encodeURIComponent(tmpDir)}`,
      })
      send()
      await handler(req, res)
      const resData = await getResult()
      assert.equal(resData.status, 404)
      assert.match(resData.json?.error, /No recorded MoA run found/i)
    }

    // Record a valid run
    const rec = recordMoaRun({ cwd: tmpDir, prompt: 'diff prompt', candidateCount: 1 })

    // 4c. Query cwd mismatch with recorded run -> 403
    {
      const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-211-other-'))
      try {
        const { req, res, send, getResult } = createMockReqRes({
          method: 'GET',
          url: `/dsh-moa/diff?runId=${rec.id}&cwd=${encodeURIComponent(otherDir)}`,
        })
        send()
        await handler(req, res)
        const resData = await getResult()
        assert.equal(resData.status, 403)
        assert.match(resData.json?.error, /Forbidden: cwd does not match recorded run cwd/i)
      } finally {
        await fs.rm(otherDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  } finally {
    process.env.DSH_HISTORY_FILE = origHist
    invalidateHistoryCache()
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
})

// 5. #158: Judge fallback chain respects budget guard
test('#158: expensive fallback judge is skipped and aborted when exceeding max budget', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-158-fb-'))
  const prices = {
    'mock:one': { input: 1, output: 1 },
    'mock:two': { input: 1, output: 1 },
    'mock:primary': { input: 1, output: 1 },
    'mock:expensive': { input: 100, output: 100 },
  }
  const maxBudget = 0.0022
  const preset = {
    name: 'test-fallback-budget',
    ask_clarifying_questions: false,
    reference_models: [
      { provider: 'mock', model: 'one' },
      { provider: 'mock', model: 'two' },
    ],
    aggregator: { provider: 'mock', model: 'primary' },
    aggregator_fallbacks: [
      { provider: 'mock', model: 'expensive' },
    ],
    budget_guard_enabled: true,
    budget_action: 'abort',
    max_budget_usd: maxBudget,
    max_tokens: 64,
  }

  const calls = []
  try {
    const result = await runMoAPipeline({
      userPrompt: 'modify code',
      cwd: tmpDir,
      preset,
      prices,
      callLlm: async ({ model, messages, maxTokens }) => {
        calls.push(model)
        if (model === 'primary') {
          throw new Error('SYNTHETIC_PRIMARY_UNAVAILABLE')
        }
        return {
          text: model === 'expensive' ? 'EXPENSIVE_WINNER' : 'candidate output',
          usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        }
      },
    })

    assert.equal(result.kind, 'failure')
    assert.match(result.content, /Budget Guardrail Abort/i)
    assert.ok(!calls.includes('expensive'), 'Expensive fallback judge must NOT be called when exceeding budget')
    assert.ok(result.usage.totalCostUsd <= maxBudget, `Total cost ${result.usage.totalCostUsd} must not exceed budget ${maxBudget}`)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
})

// 6. #225: Route string literals like "/health" are not flagged as file leaks
test('#225: Test Gate does NOT flag route literals like /health as path leaks', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-225-routes-'))
  try {
    const script = `
const routes = {
  '/health': () => 200,
  '/api/v1/users': () => ({ ok: true }),
};
if (routes['/health']() !== 200) process.exit(1);
console.log('SAFE_ROUTE_TEST_OK');
`
    await writeCandidateWorkspace(tmpDir, 1, [{ relativePath: 'test.cjs', content: script }])
    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'node test.cjs',
    })
    assert.equal(res.passed, true)
    assert.match(res.output, /SAFE_ROUTE_TEST_OK/)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
})

// 7. #161: Nested script scanning & fence argument scanning
test('#161: Test Gate catches nested scripts and intercepts outside child arguments', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-161-contain-'))
  const outsideSecret = path.join(tmpDir, 'outside-secret.txt')
  await fs.writeFile(outsideSecret, 'TOP_SECRET_OUTSIDE')
  const sandboxDir = path.join(tmpDir, 'sandbox')
  await fs.mkdir(sandboxDir, { recursive: true })

  try {
    // 7a. Nested script in subfolder with outside path literal is detected
    await writeCandidateWorkspace(sandboxDir, 1, [
      { relativePath: 'entry.sh', content: 'sh scripts/payload.sh\n' },
      { relativePath: 'scripts/payload.sh', content: `cat "${outsideSecret}"\n` },
    ])
    const resNested = await runCandidateTestGate({
      cwd: sandboxDir,
      candidateIndex: 1,
      testCommand: 'sh entry.sh',
    })
    assert.equal(resNested.passed, false)
    assert.match(resNested.output, /Access denied: test script specifies path outside workspace sandbox/i)

    // 7b. Node child_process.spawnSync with dynamically computed outside path is blocked by fence at runtime
    const chars = JSON.stringify([...outsideSecret].map((c) => c.charCodeAt(0)))
    const probeScript = `
const p = String.fromCharCode(...${chars});
const cp = require('node:child_process');
try {
  cp.spawnSync('sh', ['-c', 'cat ' + p]);
  console.log('UNEXPECTED_PASS');
} catch (err) {
  console.log('FENCE_CAUGHT: ' + err.message);
}
`
    await writeCandidateWorkspace(sandboxDir, 2, [{ relativePath: 'probe.cjs', content: probeScript }])
    const resFence = await runCandidateTestGate({
      cwd: sandboxDir,
      candidateIndex: 2,
      testCommand: 'node probe.cjs',
    })
    assert.match(resFence.output, /ERR_ACCESS_DENIED/)
    assert.ok(!resFence.output.includes('UNEXPECTED_PASS'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
})

// 8. #213: Settings persistence honesty and in-memory update
test('#213: saveConfig updates config object in-memory and returns persisted status', async () => {
  const cfg = { enabled: true, presets: [{ name: 'default' }] }
  const routes = new Map()
  const ctx = {
    effect: (fn) => fn(),
    inject: (deps, cb) => cb({ settings: null, effect: (fn) => fn() }),
    webServer: { register: (r) => { routes.set(r.path, r.handler); return () => {} } },
    on: () => () => {},
    logger: { warn: () => {} },
  }

  apply(ctx, cfg)

  const invoke = async (fn, payload, method = 'POST') => {
    let status, body
    const req = {
      method,
      url: '/dsh-moa/presets',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { origin: 'http://app.test', host: 'app.test', 'sec-fetch-site': 'same-origin' },
      on(e, cb) {
        if (e === 'data') queueMicrotask(() => cb(JSON.stringify(payload)))
        if (e === 'end') queueMicrotask(cb)
        return this
      },
    }
    await fn(req, { writeHead: (s) => { status = s }, end: (v) => { body = JSON.parse(v) } })
    return { status, body }
  }

  const res = await invoke(routes.get('/dsh-moa/presets'), { enabled: false, presets: [] })
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
  assert.equal(res.body.persisted, false, 'persisted diagnostic must report false when settings service is absent')
  assert.equal(cfg.enabled, false, 'in-memory config must be updated in place')
})
