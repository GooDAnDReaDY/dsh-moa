import test from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import { registerMoaRoutes } from '../lib/routes.js'

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

function setupTestEnvironment(initialConfig = {}) {
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
  }

  registerMoaRoutes(ctx, {
    live: () => currentConfig,
    callLlm: async () => 'test-llm-response',
    liveCanvas: null,
    saveConfig: async (cfg) => { currentConfig = cfg },
    Config: (c) => c,
    plainConfig: (c) => c,
  })

  return { routes, setConfig: (cfg) => { currentConfig = { ...currentConfig, ...cfg } } }
}

test('Issue #115: POST /dsh-moa/route-preset respects disabled setting', async () => {
  const { routes, setConfig } = setupTestEnvironment({ enabled: false })
  const handler = routes['/dsh-moa/route-preset']?.handler
  assert.ok(handler, 'route-preset handler must be registered')

  // When disabled: should return 400 with error
  const { req, res, send, getResult } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/route-preset',
    body: JSON.stringify({ prompt: 'test query' }),
  })
  send()
  await handler(req, res)
  const result = await getResult()

  assert.equal(result.status, 400)
  assert.equal(result.json?.ok, false)
  assert.match(result.json?.error, /disabled/i)

  // When enabled: should succeed
  setConfig({ enabled: true })
  const { req: req2, res: res2, send: send2, getResult: getResult2 } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/route-preset',
    body: JSON.stringify({ prompt: 'test query' }),
  })
  send2()
  await handler(req2, res2)
  const result2 = await getResult2()

  assert.equal(result2.status, 200)
  assert.equal(result2.json?.ok, true)
})
