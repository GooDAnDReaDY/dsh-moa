import test from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import { registerMoaRoutes } from '../lib/routes.js'
import {
  getConnection,
  isLoopbackIp,
  getReadRejectionStatus,
  assertAuthorizedRequest,
} from '../lib/access.js'

function createMockReqRes({
  method = 'GET',
  url = '/',
  headers = {},
  remoteAddress = '127.0.0.1',
  body = '',
} = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin', ...headers }
  if (remoteAddress !== null) {
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
    getResult: () =>
      new Promise((resolve) => {
        if (resBody) {
          let json = null
          try {
            json = JSON.parse(resBody)
          } catch {}
          resolve({ status: statusCode, headers: resHeaders, body: resBody, json })
          return
        }
        res.once('finish', () => {
          let json = null
          try {
            json = JSON.parse(resBody)
          } catch {}
          resolve({ status: statusCode, headers: resHeaders, body: resBody, json })
        })
      }),
  }
}

function setupTestEnvironment({ connection = null, initialConfig = {} } = {}) {
  let currentConfig = {
    enabled: true,
    default_preset: 'default',
    presets: [{ name: 'default', reference_models: [], aggregator: { provider: 'codex', model: 'gpt-5.6' } }],
    ...initialConfig,
  }

  const routes = {}
  const ctx = {
    webServer: {
      port: 3000,
      register: (route) => {
        routes[route.path] = route
        return () => {}
      },
    },
    effect: (fn) => fn(),
    logger: { warn: () => {}, debug: () => {} },
    connection,
  }

  registerMoaRoutes(ctx, {
    live: () => currentConfig,
    callLlm: async () => 'test-llm-response',
    liveCanvas: null,
    saveConfig: async (cfg) => {
      currentConfig = cfg
      return { persisted: true }
    },
    Config: (c) => c,
    plainConfig: (c) => c,
  })

  return {
    ctx,
    routes,
    setConfig: (cfg) => {
      currentConfig = { ...currentConfig, ...cfg }
    },
  }
}

test('Issue #257: getConnection extracts connection from ctx variants or root', () => {
  const dummyConn = { requestRejection: () => undefined }

  assert.equal(getConnection(null), undefined)
  assert.equal(getConnection({}), undefined)
  assert.equal(getConnection({ connection: dummyConn }), dummyConn)

  const reflectCtx = {
    reflect: {
      get: (key) => (key === 'connection' ? dummyConn : undefined),
    },
  }
  assert.equal(getConnection(reflectCtx), dummyConn)

  const rootCtx = {
    root: {
      connection: dummyConn,
    },
  }
  assert.equal(getConnection(rootCtx), dummyConn)
})

test('Issue #257: isLoopbackIp handles IPv4, IPv6, localhost and rejects remote IPs', () => {
  assert.equal(isLoopbackIp('127.0.0.1'), true)
  assert.equal(isLoopbackIp('::1'), true)
  assert.equal(isLoopbackIp('::ffff:127.0.0.1'), true)
  assert.equal(isLoopbackIp('localhost'), true)
  assert.equal(isLoopbackIp('192.168.1.111'), false)
  assert.equal(isLoopbackIp('10.0.0.5'), false)
  assert.equal(isLoopbackIp('8.8.8.8'), false)
  assert.equal(isLoopbackIp(''), false)
  assert.equal(isLoopbackIp(null), false)
})

test('Issue #257: getReadRejectionStatus blocks cross-site requests with 403', () => {
  const req = {
    headers: {
      host: '127.0.0.1:3000',
      'sec-fetch-site': 'cross-site',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(req), 403)
})

test('Issue #257: getReadRejectionStatus delegates to connection.requestRejection', () => {
  const req = {
    headers: { host: '192.168.1.111:3080' },
    socket: { remoteAddress: '192.168.1.55' },
  }

  // 1. Connection rejects unauthenticated remote client with 401
  const ctx401 = { connection: { requestRejection: () => 401 } }
  assert.equal(getReadRejectionStatus(req, ctx401), 401)

  // 2. Connection rejects forbidden client with 403
  const ctx403 = { connection: { requestRejection: () => 403 } }
  assert.equal(getReadRejectionStatus(req, ctx403), 403)

  // 3. Connection admits authenticated remote client with undefined
  const ctxAdmit = { connection: { requestRejection: () => undefined } }
  assert.equal(getReadRejectionStatus(req, ctxAdmit), undefined)

  // 4. Connection throws error -> fail closed 403
  const ctxThrow = {
    connection: {
      requestRejection: () => {
        throw new Error('Connection service fault')
      },
    },
  }
  assert.equal(getReadRejectionStatus(req, ctxThrow), 403)
})

test('Issue #257: getReadRejectionStatus fails closed with 401 for remote LAN callers without connection service', () => {
  // Remote socket caller
  const reqRemote = {
    headers: { host: '192.168.1.111:3080' },
    socket: { remoteAddress: '192.168.1.55' },
  }
  assert.equal(getReadRejectionStatus(reqRemote, null), 401)

  // Forwarded proxy header from remote client
  const reqXff = {
    headers: { host: '127.0.0.1:3000', 'x-forwarded-for': '192.168.1.55' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqXff, null), 401)

  // Non-socket synthetic request targeting remote host
  const reqSyntheticRemote = {
    headers: { host: '192.168.1.111:3080' },
  }
  assert.equal(getReadRejectionStatus(reqSyntheticRemote, null), 401)

  // Loopback caller without connection service admitted for test/local CLI
  const reqLocal = {
    headers: { host: '127.0.0.1:3000' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqLocal, null), undefined)
})

test('Issue #257: Read-routes block unauthenticated remote LAN requests with 401', async () => {
  // Test environment where connection service rejects unauthenticated caller
  const connection = {
    requestRejection: (req) => {
      // Mock DSH connection service: remote requests without session token are rejected
      const remote = req?.socket?.remoteAddress
      if (remote && remote !== '127.0.0.1') return 401
      return undefined
    },
  }
  const { routes } = setupTestEnvironment({ connection })

  const readRoutePaths = [
    '/dsh-moa/status',
    '/dsh-moa/models',
    '/dsh-moa/presets',
    '/dsh-moa/history',
    '/dsh-moa/leaderboard',
    '/dsh-moa/diff',
    '/dsh-moa/history/export',
    '/dsh-moa/runs/',
  ]

  for (const path of readRoutePaths) {
    const handler = routes[path]?.handler
    assert.ok(handler, `Route handler for ${path} must exist`)

    const { req, res, send, getResult } = createMockReqRes({
      method: 'GET',
      url: path === '/dsh-moa/runs/' ? '/dsh-moa/runs/mock-run-id' : path,
      headers: { host: '192.168.1.111:3080' },
      remoteAddress: '192.168.1.55',
    })
    send()
    await handler(req, res)
    const result = await getResult()

    assert.equal(result.status, 401, `${path} must reject unauthenticated remote call with 401`)
    assert.equal(result.json?.ok, false)
    assert.equal(result.json?.error, 'Authentication required')
  }
})

test('Issue #257: Read-routes block cross-site requests with 403', async () => {
  const { routes } = setupTestEnvironment()

  const readRoutePaths = [
    '/dsh-moa/status',
    '/dsh-moa/models',
    '/dsh-moa/presets',
    '/dsh-moa/history',
    '/dsh-moa/leaderboard',
  ]

  for (const path of readRoutePaths) {
    const handler = routes[path]?.handler
    assert.ok(handler, `Route handler for ${path} must exist`)

    const { req, res, send, getResult } = createMockReqRes({
      method: 'GET',
      url: path,
      headers: { 'sec-fetch-site': 'cross-site' },
      remoteAddress: '127.0.0.1',
    })
    send()
    await handler(req, res)
    const result = await getResult()

    assert.equal(result.status, 403, `${path} must reject cross-site with 403`)
    assert.equal(result.json?.ok, false)
    assert.equal(result.json?.error, 'Forbidden')
  }
})

test('Issue #257: Authenticated remote requests pass through read-routes normally', async () => {
  // Connection service admits authenticated remote session
  const connection = {
    requestRejection: () => undefined,
  }
  const { routes } = setupTestEnvironment({ connection })

  // 1. GET /dsh-moa/status
  {
    const handler = routes['/dsh-moa/status']?.handler
    const { req, res, send, getResult } = createMockReqRes({
      method: 'GET',
      url: '/dsh-moa/status',
      headers: { host: '192.168.1.111:3080' },
      remoteAddress: '192.168.1.55',
    })
    send()
    await handler(req, res)
    const result = await getResult()

    assert.equal(result.status, 200)
    assert.equal(result.json?.ok, true)
    assert.equal(result.json?.enabled, true)
  }

  // 2. GET /dsh-moa/presets
  {
    const handler = routes['/dsh-moa/presets']?.handler
    const { req, res, send, getResult } = createMockReqRes({
      method: 'GET',
      url: '/dsh-moa/presets',
      headers: { host: '192.168.1.111:3080' },
      remoteAddress: '192.168.1.55',
    })
    send()
    await handler(req, res)
    const result = await getResult()

    assert.equal(result.status, 200)
    assert.equal(result.json?.ok, true)
    assert.equal(Array.isArray(result.json?.presets), true)
  }

  // 3. GET /dsh-moa/history
  {
    const handler = routes['/dsh-moa/history']?.handler
    const { req, res, send, getResult } = createMockReqRes({
      method: 'GET',
      url: '/dsh-moa/history?limit=5',
      headers: { host: '192.168.1.111:3080' },
      remoteAddress: '192.168.1.55',
    })
    send()
    await handler(req, res)
    const result = await getResult()

    assert.equal(result.status, 200)
    assert.equal(result.json?.ok, true)
    assert.equal(Array.isArray(result.json?.runs), true)
  }
})