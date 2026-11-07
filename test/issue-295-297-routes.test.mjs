import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { registerStreamRoutes } from '../lib/routes/stream.js'
import { registerHeatmapRoutes } from '../lib/routes/heatmap.js'

describe('Issues #295 & #297 Route Integration Tests', () => {
  it('Stream Routes: initializes session, pushes delta, and checks status', async () => {
    let streamHandler = null
    const mockCtx = {
      effect: (fn) => fn(),
      webServer: {
        register: ({ path, handler }) => {
          if (path === '/dsh-moa/stream') streamHandler = handler
        },
      },
    }

    registerStreamRoutes(mockCtx)
    assert.ok(streamHandler, 'Must register /dsh-moa/stream')

    // 1. POST /dsh-moa/stream/init
    const initPayload = JSON.stringify({
      sessionId: 'test-route-session-1',
      candidates: [{ index: 1, label: 'Model 1' }, { index: 2, label: 'Model 2' }],
    })
    const reqInit = Readable.from([Buffer.from(initPayload)])
    reqInit.method = 'POST'
    reqInit.url = '/dsh-moa/stream/init'
    reqInit.headers = { host: '127.0.0.1:3005', 'content-type': 'application/json' }
    reqInit.socket = { remoteAddress: '127.0.0.1' }

    let statusCode = 0
    let resData = null
    const resInit = {
      setHeader: () => {},
      end: (data) => { resData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await streamHandler(reqInit, resInit)
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(resData.ok, true)
    assert.strictEqual(resData.session.candidates.length, 2)

    // 2. GET /dsh-moa/stream/test-route-session-1/status
    const reqStatus = Readable.from([])
    reqStatus.method = 'GET'
    reqStatus.url = '/dsh-moa/stream/test-route-session-1/status'
    reqStatus.headers = { host: '127.0.0.1:3005' }
    reqStatus.socket = { remoteAddress: '127.0.0.1' }

    let statusData = null
    const resStatus = {
      setHeader: () => {},
      end: (data) => { statusData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await streamHandler(reqStatus, resStatus)
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(statusData.session.sessionId, 'test-route-session-1')
  })

  it('Heatmap Routes: computes heatmap and resolves contested blocks', async () => {
    let heatmapHandler = null
    let applyHandler = null
    const mockCtx = {
      effect: (fn) => fn(),
      webServer: {
        register: ({ path, handler }) => {
          if (path === '/dsh-moa/ast-heatmap') heatmapHandler = handler
          if (path === '/dsh-moa/ast-heatmap/apply') applyHandler = handler
        },
      },
    }

    registerHeatmapRoutes(mockCtx)
    assert.ok(heatmapHandler, 'Must register /dsh-moa/ast-heatmap')
    assert.ok(applyHandler, 'Must register /dsh-moa/ast-heatmap/apply')

    // 1. POST /dsh-moa/ast-heatmap
    const heatmapPayload = JSON.stringify({
      file: 'test.js',
      candidates: [
        { label: 'Model A', text: 'const a = 1;\nconst b = 2;' },
        { label: 'Model B', text: 'const a = 1;\nconst b = 3;' },
      ],
    })
    const reqHeatmap = Readable.from([Buffer.from(heatmapPayload)])
    reqHeatmap.method = 'POST'
    reqHeatmap.headers = { host: '127.0.0.1:3005', 'content-type': 'application/json' }
    reqHeatmap.socket = { remoteAddress: '127.0.0.1' }

    let statusCode = 0
    let resData = null
    const resHeatmap = {
      setHeader: () => {},
      end: (data) => { resData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await heatmapHandler(reqHeatmap, resHeatmap)
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(resData.ok, true)
    assert.strictEqual(resData.heatmap.totalLines, 2)
    assert.strictEqual(resData.heatmap.lines[0].status, 'full_consensus')

    // 2. POST /dsh-moa/ast-heatmap/apply
    const applyPayload = JSON.stringify({
      baseCode: 'line 1\nline 2',
      contestedBlocks: [
        { id: 'b1', startLine: 2, endLine: 2, alternatives: [{ candidateIndex: 1, code: 'picked line 2' }] },
      ],
      selections: { b1: 1 },
    })
    const reqApply = Readable.from([Buffer.from(applyPayload)])
    reqApply.method = 'POST'
    reqApply.headers = { host: '127.0.0.1:3005', 'content-type': 'application/json' }
    reqApply.socket = { remoteAddress: '127.0.0.1' }

    let applyData = null
    const resApply = {
      setHeader: () => {},
      end: (data) => { applyData = JSON.parse(data) },
      writeHead: (code) => { statusCode = code },
    }

    await applyHandler(reqApply, resApply)
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(applyData.ok, true)
    assert.ok(applyData.code.includes('picked line 2'))
  })
})
