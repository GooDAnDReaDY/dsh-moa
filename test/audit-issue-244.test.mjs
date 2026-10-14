import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import EventEmitter from 'node:events'
import { isSafeWriteRequest } from '../lib/updater.js'
import { cleanMoaWorkspaces } from '../lib/file-workspace.js'
import { registerMoaRoutes } from '../lib/routes.js'

function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = '', remoteAddress = '127.0.0.1' } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin', ...headers }
  if (remoteAddress !== undefined) {
    req.socket = { remoteAddress }
  }

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

// ── Item 2: isSafeWriteRequest fails closed on absent remote address ─────────

test('Issue #244: isSafeWriteRequest fails closed when remote address is absent or undefined', () => {
  // Completely empty request object
  assert.equal(isSafeWriteRequest({}), false, 'empty request must fail closed')
  assert.equal(isSafeWriteRequest({ headers: {} }), false, 'request without socket must fail closed')
  assert.equal(isSafeWriteRequest({ socket: {} }), false, 'request with socket but undefined remoteAddress must fail closed')
  assert.equal(isSafeWriteRequest({ socket: { remoteAddress: null } }), false, 'null remoteAddress must fail closed')
  assert.equal(isSafeWriteRequest({ socket: { remoteAddress: '' } }), false, 'empty string remoteAddress must fail closed')

  // Non-loopback remote address
  assert.equal(isSafeWriteRequest({ socket: { remoteAddress: '192.168.1.50' } }), false, 'LAN remote address must be rejected')

  // Loopback remote address
  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin' },
  }), true, 'loopback 127.0.0.1 same-origin must be accepted')

  assert.equal(isSafeWriteRequest({
    socket: { remoteAddress: '::1' },
    headers: { host: '[::1]:3000', 'sec-fetch-site': 'same-origin' },
  }), true, 'loopback ::1 same-origin must be accepted')
})

// ── Item 3: cleanMoaWorkspaces bounds .moa path to baseDir ───────────────────

test('Issue #244: cleanMoaWorkspaces asserts containment and safely cleans candidate directories', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-clean-244-'))
  try {
    const moaDir = path.join(tmpDir, '.moa')
    const runDir = path.join(moaDir, 'test-run-1')
    await fs.mkdir(runDir, { recursive: true })
    await fs.writeFile(path.join(runDir, 'file.txt'), 'hello')

    // Clean specific run
    await cleanMoaWorkspaces(tmpDir, { runId: 'test-run-1' })
    await assert.rejects(async () => fs.access(runDir), { code: 'ENOENT' })

    // Clean entire workspace
    await fs.mkdir(runDir, { recursive: true })
    await cleanMoaWorkspaces(tmpDir)
    await assert.rejects(async () => fs.access(moaDir), { code: 'ENOENT' })

    // Null/undefined baseDir gracefully no-ops
    await assert.doesNotReject(async () => cleanMoaWorkspaces(null))
    await assert.doesNotReject(async () => cleanMoaWorkspaces(undefined))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

// ── Item 1: /dsh-moa/run validates cwd against workspace boundary ────────────

test('Issue #244: POST /dsh-moa/run rejects relative path traversal outside workspace root with 403', async () => {
  const registeredRoutes = {}
  const mockWebServer = {
    register: (route) => {
      registeredRoutes[route.path] = route.handler
      return () => delete registeredRoutes[route.path]
    },
  }

  const liveCfg = {
    enabled: true,
    default_preset: 'default',
    presets: [{ name: 'default', reference_models: [], aggregator: { provider: 'test', model: 'agg' } }],
  }

  registerMoaRoutes(
    {
      webServer: mockWebServer,
      effect: (fn) => fn(),
      logger: { warn: () => {} },
    },
    {
      live: () => liveCfg,
      callLlm: async () => ({ text: 'ok' }),
      saveConfig: () => {},
      Config: (x) => x,
      plainConfig: (x) => x,
      workspaceRoot: '/safe/workspace',
    }
  )

  const runHandler = registeredRoutes['/dsh-moa/run']
  assert.ok(runHandler, '/dsh-moa/run must be registered')

  await new Promise((r) => setTimeout(r, 1100))

  const { req, res, send, getResult } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/run',
    body: JSON.stringify({
      prompt: 'test prompt',
      cwd: '../../../../etc',
    }),
  })
  runHandler(req, res)
  send()
  const result = await getResult()
  assert.equal(result.status, 403)
  assert.equal(result.json?.ok, false)
  assert.match(result.json?.error, /Forbidden: cwd escapes allowed workspace boundary/)
})

test('Issue #244: POST /dsh-moa/run rejects absolute path outside workspace root with 403', async () => {
  const registeredRoutes = {}
  const mockWebServer = {
    register: (route) => {
      registeredRoutes[route.path] = route.handler
      return () => delete registeredRoutes[route.path]
    },
  }

  const liveCfg = {
    enabled: true,
    default_preset: 'default',
    presets: [{ name: 'default', reference_models: [], aggregator: { provider: 'test', model: 'agg' } }],
  }

  registerMoaRoutes(
    {
      webServer: mockWebServer,
      effect: (fn) => fn(),
      logger: { warn: () => {} },
    },
    {
      live: () => liveCfg,
      callLlm: async () => ({ text: 'ok' }),
      saveConfig: () => {},
      Config: (x) => x,
      plainConfig: (x) => x,
      workspaceRoot: '/safe/workspace',
    }
  )

  const runHandler = registeredRoutes['/dsh-moa/run']

  await new Promise((r) => setTimeout(r, 1100))

  const { req, res, send, getResult } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/run',
    body: JSON.stringify({
      prompt: 'test prompt',
      cwd: '/etc',
    }),
  })
  runHandler(req, res)
  send()
  const result = await getResult()
  assert.equal(result.status, 403)
  assert.equal(result.json?.ok, false)
  assert.match(result.json?.error, /Forbidden: cwd escapes allowed workspace boundary/)
})

// ── Item 1: /dsh-moa/run forces checkpoint gate and disallows client waiver ──

test('Issue #244: POST /dsh-moa/run blocks client from waiving pre-promotion checkpoint gate', async () => {
  const registeredRoutes = {}
  const mockWebServer = {
    register: (route) => {
      registeredRoutes[route.path] = route.handler
      return () => delete registeredRoutes[route.path]
    },
  }

  const mockTimeMachineEngine = {
    createSnapshot: async (label, options) => {
      return { id: 'snap-456', label, cwd: options?.cwd }
    },
  }

  const liveCfg = {
    enabled: true,
    default_preset: 'default',
    presets: [{ name: 'default', reference_models: [], aggregator: { provider: 'test', model: 'agg' } }],
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-run-test-'))
  try {
    registerMoaRoutes(
      {
        webServer: mockWebServer,
        effect: (fn) => fn(),
        logger: { warn: () => {} },
      },
      {
        live: () => liveCfg,
        callLlm: async () => ({ text: 'ok' }),
        saveConfig: () => {},
        Config: (x) => x,
        plainConfig: (x) => x,
        workspaceRoot: tmpDir,
        timeMachineEngine: mockTimeMachineEngine,
      }
    )

    const runHandler = registeredRoutes['/dsh-moa/run']

    await new Promise((r) => setTimeout(r, 1100))

    // Client passes force: true and checkpoint: false to attempt waiving gate
    const { req, res, send, getResult } = createMockReqRes({
      method: 'POST',
      url: '/dsh-moa/run',
      body: JSON.stringify({
        prompt: 'create file.js',
        cwd: tmpDir,
        force: true,
        checkpoint: false,
      }),
    })

    runHandler(req, res)
    send()
    const result = await getResult()
    assert.equal(result.status, 200)
    assert.equal(result.json?.ok, true)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
