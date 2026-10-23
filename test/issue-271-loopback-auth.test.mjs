import test from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import { registerMoaRoutes } from '../lib/routes.js'
import {
  getReadRejectionStatus,
  assertAuthorizedRequest,
} from '../lib/access.js'
import { runMoAPipeline } from '../lib/index.js'

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
          return resolve({ status: statusCode, headers: resHeaders, body: resBody, json })
        }
        res.on('finish', () => {
          let json = null
          try {
            json = JSON.parse(resBody)
          } catch {}
          resolve({ status: statusCode, headers: resHeaders, body: resBody, json })
        })
      }),
  }
}

function setupTestEnvironment({ connection = null } = {}) {
  const routes = {}
  const mockWebServer = {
    register: (def) => {
      routes[def.path] = def
      return () => { delete routes[def.path] }
    },
    port: 3080,
  }

  const mockCtx = {
    webServer: mockWebServer,
    connection,
    reflect: {
      get: (key) => (key === 'connection' ? connection : undefined),
    },
    effect: (fn) => {
      const cleanup = fn()
      return typeof cleanup === 'function' ? cleanup : () => {}
    },
    on: () => () => {},
  }

  const mockConfig = {
    enabled: true,
    default_preset: 'default',
    presets: [
      {
        name: 'default',
        candidates: [{ provider: 'test', model: 'c1' }],
        aggregator: { provider: 'test', model: 'agg' },
      },
    ],
  }

  registerMoaRoutes(mockCtx, {
    live: () => mockConfig,
    callLlm: async () => ({ text: 'ok' }),
    webServerPort: 3080,
    workspaceRoot: '/tmp',
  })

  return { routes, mockCtx }
}

test('Issue #271 (GitHub Inbound #2): getReadRejectionStatus admits loopback callers without session cookies even when connection service rejects unauthenticated sessions', () => {
  // Connection service that requires browser cookies and rejects other callers with 401
  const ctxWithDshConn = {
    connection: {
      requestRejection: () => 401,
    },
  }

  // 1. IPv4 loopback socket (127.0.0.1) without cookies -> ADMITTED (undefined)
  const reqIpv4 = {
    headers: { host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqIpv4, ctxWithDshConn), undefined, '127.0.0.1 socket must be admitted')

  // 2. IPv6 loopback socket (::1) without cookies -> ADMITTED (undefined)
  const reqIpv6 = {
    headers: { host: '[::1]:3080', 'sec-fetch-site': 'same-origin' },
    socket: { remoteAddress: '::1' },
  }
  assert.equal(getReadRejectionStatus(reqIpv6, ctxWithDshConn), undefined, '::1 socket must be admitted')

  // 3. IPv4-mapped IPv6 loopback socket (::ffff:127.0.0.1) -> ADMITTED (undefined)
  const reqMapped = {
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '::ffff:127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqMapped, ctxWithDshConn), undefined, '::ffff:127.0.0.1 socket must be admitted')

  // 4. Remote network caller (192.168.1.55) -> REJECTED with 401
  const reqRemote = {
    headers: { host: '192.168.1.111:3080' },
    socket: { remoteAddress: '192.168.1.55' },
  }
  assert.equal(getReadRejectionStatus(reqRemote, ctxWithDshConn), 401, 'Remote network caller must be rejected with 401')

  // 5. Forwarded remote client over loopback proxy -> REJECTED with 401
  const reqForwarded = {
    headers: { host: '127.0.0.1:3080', 'x-forwarded-for': '203.0.113.195' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqForwarded, ctxWithDshConn), 401, 'Forwarded remote IP must be rejected')

  // 6. Cross-site request on loopback -> REJECTED with 403
  const reqCrossSite = {
    headers: { host: '127.0.0.1:3080', 'sec-fetch-site': 'cross-site' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqCrossSite, ctxWithDshConn), 403, 'Cross-site request must be rejected with 403')

  // 7. External origin header targeting loopback -> REJECTED with 403
  const reqExternalOrigin = {
    headers: { host: '127.0.0.1:3080', origin: 'https://malicious-site.example' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(getReadRejectionStatus(reqExternalOrigin, ctxWithDshConn), 403, 'External origin must be rejected with 403')
})

test('Issue #271: POST /dsh-moa/run admits loopback callers without session cookies and rejects remote LAN callers', async () => {
  // Connection service that mimics DSH 0.2.x browser session requirement (rejects requests lacking session cookies)
  const connection = {
    requestRejection: (req) => {
      // DSH browser connection service reject if no auth cookie is present
      const cookie = req?.headers?.cookie || ''
      if (!cookie.includes('dsh_token=') && !cookie.includes('dsh-auth-')) {
        return 401
      }
      return undefined
    },
  }

  const { routes } = setupTestEnvironment({ connection })
  const runHandler = routes['/dsh-moa/run']?.handler
  assert.ok(runHandler, 'POST /dsh-moa/run handler must be registered')

  // 1. Loopback caller without cookies calls POST /dsh-moa/run
  {
    const { req, res, send, getResult } = createMockReqRes({
      method: 'POST',
      url: '/dsh-moa/run',
      headers: { host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin' },
      remoteAddress: '127.0.0.1',
      body: JSON.stringify({ prompt: 'test ping' }),
    })
    send()
    await runHandler(req, res)
    const result = await getResult()

    // Must NOT be 401 (admitted through access guard)
    assert.notEqual(result.status, 401, 'Loopback caller without cookies must not be rejected with 401')
    assert.equal(result.json?.ok, true, 'Run request from loopback must succeed')
  }

  // 2. Remote LAN caller without cookies calls POST /dsh-moa/run
  {
    const { req, res, send, getResult } = createMockReqRes({
      method: 'POST',
      url: '/dsh-moa/run',
      headers: { host: '192.168.1.111:3080' },
      remoteAddress: '192.168.1.55',
      body: JSON.stringify({ prompt: 'test ping' }),
    })
    send()
    await runHandler(req, res)
    const result = await getResult()

    assert.equal(result.status, 401, 'Remote LAN caller without cookies must be rejected with 401')
    assert.equal(result.json?.ok, false)
    assert.equal(result.json?.error, 'Authentication required')
  }
})

test('Issue #271: lib/index.js exports runMoAPipeline for programmatic in-process usage', () => {
  assert.equal(typeof runMoAPipeline, 'function', 'runMoAPipeline must be exported for in-process callers')
})