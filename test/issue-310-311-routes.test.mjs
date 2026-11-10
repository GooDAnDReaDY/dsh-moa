import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { registerBenchmarkRoutes } from '../lib/routes/benchmark.js'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'

describe('Issue #310, #311, and #349: Benchmark and PR Review Route Hardening', () => {
  function createCordisContext() {
    return {
      effect: (fn) => fn(),
      // Cordis context throws when un-injected config property is accessed (#349)
      get config() {
        throw new Error('cannot get property "config" without inject')
      },
      webServer: {
        register: ({ path, handler }) => {
          if (path === '/dsh-moa/benchmark') registeredHandlers['/dsh-moa/benchmark'] = handler
          if (path === '/dsh-moa/webhook/pr') registeredHandlers['/dsh-moa/webhook/pr'] = handler
        },
      },
    }
  }

  let registeredHandlers = {}

  it('POST /dsh-moa/benchmark: executes with Cordis context throwing on ctx.config using deps.live', async () => {
    registeredHandlers = {}
    const mockCtx = createCordisContext()

    const mockLive = () => ({
      presets: [{ name: 'test-preset', reference_models: [{ provider: 'test', model: 'mock' }] }],
      prices: {},
    })

    const mockCall = async () => ({
      text: 'function safeDivide(a, b) { if (!isFinite(a)) throw new TypeError(); if (b === 0) return null; return a / b; }',
      usage: { inputTokens: 20, outputTokens: 30 },
    })

    registerBenchmarkRoutes(mockCtx, { live: mockLive, callLlm: mockCall })
    const benchmarkHandler = registeredHandlers['/dsh-moa/benchmark']
    assert.ok(benchmarkHandler, 'Must register /dsh-moa/benchmark')

    let statusCode = 0
    let responseData = null

    const payload = JSON.stringify({ presetName: 'test-preset', maxCases: 1 })
    const mockReq = Readable.from([Buffer.from(payload)])
    mockReq.method = 'POST'
    mockReq.headers = { host: '127.0.0.1:3005', 'content-type': 'application/json' }
    mockReq.socket = { remoteAddress: '127.0.0.1' }

    const mockRes = {
      setHeader: () => {},
      end: (data) => { responseData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await benchmarkHandler(mockReq, mockRes)
    assert.equal(statusCode, 200)
    assert.equal(responseData.ok, true)
    assert.ok(responseData.summary.markdownReport.includes('MoA Preset Regression Benchmark Report'))
  })

  it('POST /dsh-moa/webhook/pr: rejects request with 403 when pr_review_bot_enabled is false', async () => {
    registeredHandlers = {}
    const mockCtx = createCordisContext()
    const mockLive = () => ({
      pr_review_bot_enabled: false,
    })

    registerBenchmarkRoutes(mockCtx, { live: mockLive })
    const webhookHandler = registeredHandlers['/dsh-moa/webhook/pr']

    let statusCode = 0
    let responseData = null
    const mockReq = Readable.from([Buffer.from('{}')])
    mockReq.method = 'POST'
    mockReq.headers = { host: '127.0.0.1:3005' }

    const mockRes = {
      setHeader: () => {},
      end: (data) => { responseData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await webhookHandler(mockReq, mockRes)
    assert.equal(statusCode, 403)
    assert.equal(responseData.ok, false)
    assert.ok(responseData.error.includes('PR review bot is disabled'))
  })

  it('POST /dsh-moa/webhook/pr: rejects fail-closed with 403 when webhook secret is missing/empty', async () => {
    registeredHandlers = {}
    const mockCtx = createCordisContext()
    const mockLive = () => ({
      pr_review_bot_enabled: true,
      pr_review_webhook_secret: '',
    })

    registerBenchmarkRoutes(mockCtx, { live: mockLive })
    const webhookHandler = registeredHandlers['/dsh-moa/webhook/pr']

    let statusCode = 0
    let responseData = null
    const mockReq = Readable.from([Buffer.from('{"action":"opened"}')])
    mockReq.method = 'POST'
    mockReq.headers = { host: '127.0.0.1:3005' }

    const mockRes = {
      setHeader: () => {},
      end: (data) => { responseData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await webhookHandler(mockReq, mockRes)
    assert.equal(statusCode, 403)
    assert.equal(responseData.ok, false)
    assert.ok(responseData.error.includes('secret is not configured'))
  })

  it('POST /dsh-moa/webhook/pr: rejects with 403 when repository is not in allowed list', async () => {
    registeredHandlers = {}
    const mockCtx = createCordisContext()
    const secret = 'valid-secret-123'
    const mockLive = () => ({
      pr_review_bot_enabled: true,
      pr_review_webhook_secret: secret,
      pr_review_allowed_repos: 'goodandready/dsh-moa',
    })

    registerBenchmarkRoutes(mockCtx, { live: mockLive })
    const webhookHandler = registeredHandlers['/dsh-moa/webhook/pr']

    const payload = JSON.stringify({
      action: 'opened',
      repository: { full_name: 'evil-attacker/malicious-repo' },
    })
    const sig = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`

    let statusCode = 0
    let responseData = null
    const mockReq = Readable.from([Buffer.from(payload)])
    mockReq.method = 'POST'
    mockReq.headers = {
      host: '127.0.0.1:3005',
      'x-gitea-signature': sig,
      'content-type': 'application/json',
    }

    const mockRes = {
      setHeader: () => {},
      end: (data) => { responseData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await webhookHandler(mockReq, mockRes)
    assert.equal(statusCode, 403)
    assert.equal(responseData.ok, false)
    assert.ok(responseData.error.includes('not permitted for PR review'))
  })

  it('POST /dsh-moa/webhook/pr: processes pull_request webhook payload and produces review report with Cordis context', async () => {
    registeredHandlers = {}
    const mockCtx = createCordisContext()
    const secret = 'prod-test-secret-456'
    const mockLive = () => ({
      presets: [{ name: 'default' }],
      pr_review_bot_enabled: true,
      pr_review_webhook_secret: secret,
      pr_review_allowed_repos: 'goodandready/dsh-moa',
    })

    const mockCall = async (params) => {
      if (params.model === 'judge') {
        return { text: 'VERDICT: APPROVED\nLGTM!' }
      }
      return { text: 'Code looks good.' }
    }

    registerBenchmarkRoutes(mockCtx, { live: mockLive, callLlm: mockCall })
    const webhookHandler = registeredHandlers['/dsh-moa/webhook/pr']
    assert.ok(webhookHandler, 'Must register /dsh-moa/webhook/pr')

    const payloadObj = {
      action: 'opened',
      repository: {
        owner: { username: 'goodandready' },
        name: 'dsh-moa',
        full_name: 'goodandready/dsh-moa',
      },
      pull_request: {
        number: 77,
        title: 'Feature implementation',
        diff: 'diff --git a/app.js b/app.js\n+console.log("new");\n',
      },
    }
    const payloadStr = JSON.stringify(payloadObj)
    const sig = `sha256=${crypto.createHmac('sha256', secret).update(payloadStr).digest('hex')}`

    let statusCode = 0
    let responseData = null

    const mockReq = Readable.from([Buffer.from(payloadStr)])
    mockReq.method = 'POST'
    mockReq.headers = {
      host: '127.0.0.1:3005',
      'x-gitea-event': 'pull_request',
      'x-gitea-signature': sig,
      'content-type': 'application/json',
    }

    const mockRes = {
      setHeader: () => {},
      end: (data) => { responseData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await webhookHandler(mockReq, mockRes)
    assert.equal(statusCode, 200)
    assert.equal(responseData.ok, true)
    assert.equal(responseData.reviewReport.prNumber, 77)
    assert.equal(responseData.reviewReport.verdict, 'APPROVED')
  })
})
