import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { registerBenchmarkRoutes } from '../lib/routes/benchmark.js'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'

describe('Issue #310 and #311 Route Integration', () => {
  it('POST /dsh-moa/benchmark: executes benchmark suite and returns summary', async () => {
    let benchmarkHandler = null
    const mockCtx = {
      effect: (fn) => fn(),
      config: { presets: [{ name: 'test-preset', reference_models: [{ provider: 'test', model: 'mock' }] }] },
      webServer: {
        register: ({ path, handler }) => {
          if (path === '/dsh-moa/benchmark') benchmarkHandler = handler
        },
      },
    }

    const mockCall = async () => ({
      text: 'function safeDivide(a, b) { if (!isFinite(a)) throw new TypeError(); if (b === 0) return null; return a / b; }',
      usage: { inputTokens: 20, outputTokens: 30 },
    })

    registerBenchmarkRoutes(mockCtx, { callLlm: mockCall })
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

  it('POST /dsh-moa/webhook/pr: processes pull_request webhook payload and produces review report', async () => {
    let webhookHandler = null
    const mockCtx = {
      effect: (fn) => fn(),
      config: {
        presets: [{ name: 'default' }],
        pr_review_webhook_secret: 'test-secret',
      },
      webServer: {
        register: ({ path, handler }) => {
          if (path === '/dsh-moa/webhook/pr') webhookHandler = handler
        },
      },
    }

    const mockCall = async (params) => {
      if (params.model === 'judge') {
        return { text: 'VERDICT: APPROVED\nLGTM!' }
      }
      return { text: 'Code looks good.' }
    }

    registerBenchmarkRoutes(mockCtx, { callLlm: mockCall })
    assert.ok(webhookHandler, 'Must register /dsh-moa/webhook/pr')

    const payloadObj = {
      action: 'opened',
      pull_request: {
        number: 77,
        title: 'Feature implementation',
        diff: 'diff --git a/app.js b/app.js\n+console.log("new");\n',
      },
    }
    const payloadStr = JSON.stringify(payloadObj)
    const sig = `sha256=${crypto.createHmac('sha256', 'test-secret').update(payloadStr).digest('hex')}`

    let statusCode = 0
    let responseData = null

    const mockReq = Readable.from([Buffer.from(payloadStr)])
    mockReq.method = 'POST'
    mockReq.headers = {
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
