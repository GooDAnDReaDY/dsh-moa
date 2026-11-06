import test from 'node:test'
import assert from 'node:assert/strict'
import EventEmitter from 'node:events'
import { registerPreferencesRoutes } from '../lib/routes/preferences.js'

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
        return resolve({ statusCode, headers: resHeaders, body: resBody, json })
      }
      res.once('finish', () => {
        let json = null
        try { json = JSON.parse(resBody) } catch {}
        resolve({ statusCode, headers: resHeaders, body: resBody, json })
      })
    }),
  }
}

test('routes/preferences: GET /dsh-moa/preferences returns active preferences', async () => {
  const registered = []
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      register: (reg) => {
        registered.push(reg)
      },
    },
  }

  registerPreferencesRoutes(mockCtx)
  const getRoute = registered.find((r) => r.kind === 'exact' && r.path === '/dsh-moa/preferences')
  assert.ok(getRoute)

  const { req, res, send, getResult } = createMockReqRes({ method: 'GET', url: '/dsh-moa/preferences' })
  send()
  await getRoute.handler(req, res)
  const result = await getResult()

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.ok, true)
  assert.ok(Array.isArray(result.json.preferences))
  assert.ok(result.json.preferences.length >= 3)
})

test('routes/preferences: POST /dsh-moa/preferences adds, updates, and deletes preference', async () => {
  const registered = []
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      register: (reg) => {
        registered.push(reg)
      },
    },
  }

  registerPreferencesRoutes(mockCtx)
  const exactRoute = registered.find((r) => r.kind === 'exact' && r.path === '/dsh-moa/preferences')
  const prefixRoute = registered.find((r) => r.kind === 'prefix' && r.path === '/dsh-moa/preferences/')

  // 1. Add
  const addPayload = JSON.stringify({
    title: 'Always Vitest',
    rule: 'Use Vitest for all unit tests',
    category: 'testing',
  })
  const { req: r1, res: s1, send: snd1, getResult: gr1 } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/preferences',
    body: addPayload,
  })
  snd1()
  await exactRoute.handler(r1, s1)
  const res1 = await gr1()

  assert.equal(res1.statusCode, 201)
  assert.equal(res1.json.ok, true)
  const createdId = res1.json.preference.id
  assert.ok(createdId)

  // 2. Update via prefix route
  const updatePayload = JSON.stringify({ enabled: false })
  const { req: r2, res: s2, send: snd2, getResult: gr2 } = createMockReqRes({
    method: 'PATCH',
    url: `/dsh-moa/preferences/${createdId}`,
    body: updatePayload,
  })
  snd2()
  await prefixRoute.handler(r2, s2)
  const res2 = await gr2()

  assert.equal(res2.statusCode, 200)
  assert.equal(res2.json.preference.enabled, false)

  // 3. Delete via prefix route
  const { req: r3, res: s3, send: snd3, getResult: gr3 } = createMockReqRes({
    method: 'DELETE',
    url: `/dsh-moa/preferences/${createdId}`,
  })
  snd3()
  await prefixRoute.handler(r3, s3)
  const res3 = await gr3()

  assert.equal(res3.statusCode, 200)
  assert.equal(res3.json.deleted, true)
})
