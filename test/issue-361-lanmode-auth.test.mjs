import test from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import { registerMoaRoutes } from '../lib/routes.js'
import {
  getReadRejectionStatus,
  assertAuthorizedRequest,
  cookieNameForAuthority,
} from '../lib/access.js'
import { isSafeWriteRequest } from '../lib/updater.js'

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
  req.headers = { host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin', ...headers }
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
      port: 3080,
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
    models: () => ({ 'gpt-5.6': { label: 'GPT-5.6' } }),
    recordTurn: () => {},
    stats: () => ({ turns: 0 }),
    resolveAggregator: () => null,
  })

  return { routes, ctx }
}

test('Issue #361: Authenticated LANMode browser with loopback-named cookie is admitted', () => {
  const loopbackCookie = cookieNameForAuthority('127.0.0.1:3080') + '=v1.valid.hmac.signature'
  const req = {
    headers: {
      host: '127.0.0.1:3080',
      'x-forwarded-for': '192.168.1.123',
      cookie: loopbackCookie,
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  // Connection service authenticates the request via HMAC
  const ctxAuth = { connection: { requestRejection: () => undefined } }
  assert.equal(getReadRejectionStatus(req, ctxAuth), undefined)
})

test('Issue #361: Unauthenticated LANMode browser is rejected with 401', () => {
  const req = {
    headers: {
      host: '127.0.0.1:3080',
      'x-forwarded-for': '192.168.1.123',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  // Connection service rejects unauthenticated request
  const ctxReject = { connection: { requestRejection: () => 401 } }
  assert.equal(getReadRejectionStatus(req, ctxReject), 401)

  // Absence of connection service fails closed with 401
  assert.equal(getReadRejectionStatus(req, null), 401)
})

test('Issue #361: Cross-site CSRF requests are blocked with 403', () => {
  const reqCrossSite = {
    headers: {
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'cross-site',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqCrossSite), 403)

  const reqOriginMismatch = {
    headers: {
      host: '127.0.0.1:3080',
      origin: 'http://attacker.com',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqOriginMismatch), 403)
})

test('Issue #361: Direct loopback in-process/CLI request without cookies is admitted', () => {
  const reqLocal = {
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqLocal, null), undefined)
})

test('Issue #361: Direct loopback request with spoofed Host header is rejected with 403', () => {
  const reqSpoofed = {
    headers: { host: 'evil-rebinding.com' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqSpoofed, null), 403)
})

test('Issue #361: Direct remote LAN request without connection service fails closed with 401', () => {
  const reqRemote = {
    headers: { host: '192.168.1.111:3080' },
    socket: { remoteAddress: '192.168.1.55' },
  }
  assert.equal(getReadRejectionStatus(reqRemote, null), 401)
})

test('Issue #361: End-to-end read endpoints admit authenticated LANMode browser', async () => {
  const loopbackCookie = cookieNameForAuthority('127.0.0.1:3080') + '=v1.valid.signature'
  const connection = {
    requestRejection: (req) => {
      // Mock DSH connection HMAC check: accepts requests with valid loopback cookie
      if (req?.headers?.cookie?.includes(loopbackCookie)) return undefined
      return 401
    },
  }
  const { routes } = setupTestEnvironment({ connection })

  const readRoutePaths = [
    '/dsh-moa/status',
    '/dsh-moa/models',
    '/dsh-moa/presets',
  ]

  for (const path of readRoutePaths) {
    const handler = routes[path]?.handler
    assert.ok(handler, `Route handler for ${path} must exist`)

    const { req, res, send, getResult } = createMockReqRes({
      method: 'GET',
      url: path,
      headers: {
        host: '127.0.0.1:3080',
        'x-forwarded-for': '192.168.1.123',
        cookie: loopbackCookie,
      },
      remoteAddress: '127.0.0.1',
    })
    send()
    await handler(req, res)
    const result = await getResult()

    assert.equal(result.status, 200, `${path} should admit authenticated LANMode browser with 200`)
    assert.equal(result.json?.ok, true, `${path} should return ok: true`)
  }

  // Also test /dsh-moa/diff does not return 401 (auth succeeds)
  const diffHandler = routes['/dsh-moa/diff']?.handler
  assert.ok(diffHandler, 'Route handler for /dsh-moa/diff must exist')
  const { req: diffReq, res: diffRes, send: sendDiff, getResult: getDiffResult } = createMockReqRes({
    method: 'GET',
    url: '/dsh-moa/diff',
    headers: {
      host: '127.0.0.1:3080',
      'x-forwarded-for': '192.168.1.123',
      cookie: loopbackCookie,
    },
    remoteAddress: '127.0.0.1',
  })
  sendDiff()
  await diffHandler(diffReq, diffRes)
  const diffResult = await getDiffResult()
  assert.notEqual(diffResult.status, 401, '/dsh-moa/diff must not return 401 for authenticated session')
})

test('Issue #361: End-to-end read endpoints reject unauthenticated LANMode browser', async () => {
  const connection = {
    requestRejection: () => 401,
  }
  const { routes } = setupTestEnvironment({ connection })

  const readRoutePaths = [
    '/dsh-moa/status',
    '/dsh-moa/models',
    '/dsh-moa/presets',
    '/dsh-moa/diff',
  ]

  for (const path of readRoutePaths) {
    const handler = routes[path]?.handler
    assert.ok(handler, `Route handler for ${path} must exist`)

    const { req, res, send, getResult } = createMockReqRes({
      method: 'GET',
      url: path,
      headers: {
        host: '127.0.0.1:3080',
        'x-forwarded-for': '192.168.1.123',
      },
      remoteAddress: '127.0.0.1',
    })
    send()
    await handler(req, res)
    const result = await getResult()

    assert.equal(result.status, 401, `${path} must reject unauthenticated LANMode browser with 401`)
    assert.equal(result.json?.ok, false)
    assert.equal(result.json?.error, 'Authentication required')
  }
})

test('Issue #361: Write endpoints enforce loopback check and reject non-loopback write requests', () => {
  // 1. Non-loopback remote socket must be rejected by isSafeWriteRequest
  const nonLoopbackReq = {
    method: 'POST',
    url: '/dsh-moa/presets',
    headers: {
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3080',
    },
    socket: { remoteAddress: '192.168.1.55' },
  }
  assert.equal(isSafeWriteRequest(nonLoopbackReq), false)

  // 2. Cross-site write must be rejected
  const crossSiteReq = {
    method: 'POST',
    url: '/dsh-moa/presets',
    headers: {
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'cross-site',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isSafeWriteRequest(crossSiteReq), false)

  // 3. Legitimate loopback same-origin write is allowed
  const validReq = {
    method: 'POST',
    url: '/dsh-moa/presets',
    headers: {
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isSafeWriteRequest(validReq), true)
})
