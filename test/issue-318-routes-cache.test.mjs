import test from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { registerMoaRoutes } from '../lib/routes.js'
import { setCacheEntry } from '../lib/pipeline/semantic-cache.js'

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

test('Issue #318: GET /dsh-moa/cache and POST /dsh-moa/cache/clear routes', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-route-cache-test-'))
  try {
    const routeHandlers = new Map()
    const mockCtx = {
      effect: (fn) => fn(),
      webServer: {
        register: ({ path: rPath, handler }) => {
          routeHandlers.set(rPath, handler)
        },
      },
    }

    registerMoaRoutes(mockCtx, {
      workspaceRoot: tmpDir,
      live: () => ({ enabled: true }),
      historyEngine: { listRuns: () => ({ runs: [], total: 0 }) },
    })

    const cacheHandler = routeHandlers.get('/dsh-moa/cache')
    assert.ok(cacheHandler, 'Route /dsh-moa/cache should be registered')

    // 1. Initial GET: empty stats
    const { req: req1, res: res1, send: send1, getResult: getRes1 } = createMockReqRes({ method: 'GET', url: '/dsh-moa/cache' })
    cacheHandler(req1, res1)
    send1()
    const r1 = await getRes1()
    assert.equal(r1.status, 200)
    assert.equal(r1.json.ok, true)
    assert.equal(r1.json.stats.entriesCount, 0)

    // 2. Populate cache entry
    setCacheEntry('cached_hash_123', {
      model: 'openai:gpt-4o',
      output: 'cached solution',
      usage: { totalTokens: 150 },
    }, { cwd: tmpDir })

    // 3. Second GET: 1 entry
    const { req: req2, res: res2, send: send2, getResult: getRes2 } = createMockReqRes({ method: 'GET', url: '/dsh-moa/cache' })
    cacheHandler(req2, res2)
    send2()
    const r2 = await getRes2()
    assert.equal(r2.status, 200)
    assert.equal(r2.json.stats.entriesCount, 1)

    // 4. POST to clear cache
    const { req: req3, res: res3, send: send3, getResult: getRes3 } = createMockReqRes({
      method: 'POST',
      url: '/dsh-moa/cache',
      body: JSON.stringify({}),
    })
    cacheHandler(req3, res3)
    send3()
    const r3 = await getRes3()
    assert.equal(r3.status, 200)
    assert.equal(r3.json.ok, true)
    assert.equal(r3.json.clearedCount, 1)

    // 5. Final GET: 0 entries
    const { req: req4, res: res4, send: send4, getResult: getRes4 } = createMockReqRes({ method: 'GET', url: '/dsh-moa/cache' })
    cacheHandler(req4, res4)
    send4()
    const r4 = await getRes4()
    assert.equal(r4.status, 200)
    assert.equal(r4.json.stats.entriesCount, 0)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

import { runMoAPipeline } from '../lib/moa-runner.js'
import { MOA_EVENTS } from '../lib/events.js'

test('Issue #318: runMoAPipeline reuses cached candidate generation on identical prompt', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pipeline-cache-test-'))
  try {
    let callLlmCount = 0
    const emittedEvents = []
    const mockCtx = {
      emit: (eventName, payload) => {
        emittedEvents.push({ eventName, payload })
      },
    }

    const mockCallLlm = async (args) => {
      callLlmCount++
      const messages = args.messages || []
      const promptStr = messages.map((m) => m.content).join('\n')
      if (promptStr.includes('Judge Criteria') || promptStr.includes('Solution A')) {
        return 'Winner: Candidate 1\nVerdict: Great output.'
      }
      return 'Here is candidate 1 output:\n```js path="main.js"\nconsole.log(42);\n```'
    }

    const preset = {
      name: 'cache-preset',
      semantic_cache_enabled: true,
      semantic_cache_ttl_hours: 24,
      reference_models: [{ provider: 'test', model: 'cand-1' }],
      aggregator: { provider: 'test', model: 'judge-1' },
      curator_synthesis: true,
    }

    // Run 1: Cold cache
    const res1 = await runMoAPipeline({
      userPrompt: 'Write a small hello script',
      cwd: tmpDir,
      preset,
      callLlm: mockCallLlm,
      ctx: mockCtx,
    })
    assert.ok(res1)
    const initialCalls = callLlmCount
    assert.ok(initialCalls >= 2) // candidate + judge

    // Run 2: Hot cache on identical prompt
    const res2 = await runMoAPipeline({
      userPrompt: '   Write   a   small   hello   script   ',
      cwd: tmpDir,
      preset,
      callLlm: mockCallLlm,
      ctx: mockCtx,
    })
    assert.ok(res2)

    // Candidate model call should have been served from semantic cache!
    // Total calls should only have increased by 1 (the judge call), not candidate!
    assert.equal(callLlmCount, initialCalls + 1)

    // CACHE_HIT event should be emitted
    const hitEvent = emittedEvents.find((e) => e.eventName === MOA_EVENTS.CACHE_HIT)
    assert.ok(hitEvent, 'CACHE_HIT event should be emitted on warm run')
    assert.ok(hitEvent.payload.model.includes('cand-1'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
