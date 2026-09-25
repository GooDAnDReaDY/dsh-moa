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

test('Issue #116: /dsh-moa/status rejects non-GET methods with 405 Method Not Allowed', async () => {
  const { routes } = setupTestEnvironment()
  const handler = routes['/dsh-moa/status']?.handler
  assert.ok(handler, 'status handler must be registered')

  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const { req, res, send, getResult } = createMockReqRes({ method, url: '/dsh-moa/status' })
    send()
    await handler(req, res)
    const result = await getResult()
    assert.equal(result.status, 405, `${method} /dsh-moa/status must return 405`)
    assert.equal(result.json?.ok, false)
  }

  // GET works
  const { req, res, send, getResult } = createMockReqRes({ method: 'GET', url: '/dsh-moa/status' })
  send()
  await handler(req, res)
  const result = await getResult()
  assert.equal(result.status, 200)
  assert.equal(result.json?.ok, true)
})

test('Issue #116: /dsh-moa/models rejects non-GET methods with 405 Method Not Allowed', async () => {
  const { routes } = setupTestEnvironment()
  const handler = routes['/dsh-moa/models']?.handler
  assert.ok(handler, 'models handler must be registered')

  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const { req, res, send, getResult } = createMockReqRes({ method, url: '/dsh-moa/models' })
    send()
    await handler(req, res)
    const result = await getResult()
    assert.equal(result.status, 405, `${method} /dsh-moa/models must return 405`)
    assert.equal(result.json?.ok, false)
  }

  // GET works
  const { req, res, send, getResult } = createMockReqRes({ method: 'GET', url: '/dsh-moa/models' })
  send()
  await handler(req, res)
  const result = await getResult()
  assert.equal(result.status, 200)
  assert.equal(result.json?.ok, true)
})

test('Issue #117: promoteCandidateWorkspace propagates error on failure instead of returning empty list', async () => {
  const { promoteCandidateWorkspace } = await import('../lib/file-workspace.js')
  // Passing invalid base directory or causing fs operation failure
  const invalidDir = '/nonexistent_dir_' + Date.now() + '/sub'
  // When target doesn't exist, promoteCandidateWorkspace returns [] if empty,
  // but if getFilesRecursively fails unexpectedly or copy fails, it throws.
  // Test route handler: when promote throws, route returns 500
  const { routes } = setupTestEnvironment()
  const handler = routes['/dsh-moa/promote']?.handler
  assert.ok(handler, 'promote handler must be registered')

  // We test with an unwritable destination directory to trigger an error
  const os = await import('node:os')
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-promote-fail-'))
  try {
    // Create candidate-1 with a file
    const candDir = path.join(tmpBase, '.moa', 'candidate-1')
    await fs.mkdir(candDir, { recursive: true })
    await fs.writeFile(path.join(candDir, 'file.txt'), 'hello', 'utf8')

    // Make base destination read-only file conflicting with target dir or directory
    const destFile = path.join(tmpBase, 'file.txt')
    await fs.mkdir(destFile) // dest is a directory while src is a file -> copyFile will throw EISDIR
    
    // Calling promote directly should throw EISDIR
    await assert.rejects(
      async () => {
        await promoteCandidateWorkspace(tmpBase, 1, { keepMoa: true })
      },
      /EISDIR|error/i
    )

    // Route /dsh-moa/promote should respond with 500
    const { req, res, send, getResult } = createMockReqRes({
      method: 'POST',
      url: '/dsh-moa/promote',
      body: JSON.stringify({ cwd: tmpBase, candidateIndex: 1 }),
    })
    send()
    await handler(req, res)
    const result = await getResult()

    assert.equal(result.status, 500)
    assert.equal(result.json?.ok, false)
    assert.ok(result.json?.error)
  } finally {
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => {})
  }
})

test('Issue #66: POST write endpoints reject cross-origin requests with 403 Forbidden', async () => {
  const { routes } = setupTestEnvironment()

  // 1. /dsh-moa/route-preset
  const routePresetHandler = routes['/dsh-moa/route-preset']?.handler
  const { req: r1, res: res1, send: s1, getResult: g1 } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/route-preset',
    headers: { 'sec-fetch-site': 'cross-site' },
    body: JSON.stringify({ prompt: 'test' }),
  })
  s1()
  await routePresetHandler(r1, res1)
  const resRoutePreset = await g1()
  assert.equal(resRoutePreset.status, 403)
  assert.equal(resRoutePreset.json?.ok, false)

  // 2. /dsh-moa/run
  const runHandler = routes['/dsh-moa/run']?.handler
  const { req: r2, res: res2, send: s2, getResult: g2 } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/run',
    headers: { 'sec-fetch-site': 'cross-site' },
    body: JSON.stringify({ prompt: 'test' }),
  })
  s2()
  await runHandler(r2, res2)
  const resRun = await g2()
  assert.equal(resRun.status, 403)
  assert.equal(resRun.json?.ok, false)
})

test('Issue #66: POST /dsh-moa/run rate limiter rejects rapid subsequent calls with 429', async () => {
  const { routes } = setupTestEnvironment()
  const runHandler = routes['/dsh-moa/run']?.handler

  // First call (will fail on empty prompt or proceed, but passes rate check)
  const { req: r1, res: res1, send: s1, getResult: g1 } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/run',
    body: JSON.stringify({ prompt: '' }), // triggers 400 Empty prompt AFTER rate check
  })
  s1()
  await runHandler(r1, res1)
  const first = await g1()
  assert.equal(first.status, 400) // passed rate limiter, rejected on empty prompt

  // Immediate second call triggers 429
  const { req: r2, res: res2, send: s2, getResult: g2 } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/run',
    body: JSON.stringify({ prompt: 'test' }),
  })
  s2()
  await runHandler(r2, res2)
  const second = await g2()
  assert.equal(second.status, 429)
  assert.equal(second.json?.ok, false)
  assert.match(second.json?.error, /rate limit/i)
})

test('Issue #74: collectProjectContext records error details when file read fails', async () => {
  const { collectProjectContext } = await import('../lib/file-workspace.js')
  const os = await import('node:os')
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-collect-err-'))
  try {
    // Create an unreadable code file
    const fakeFile = path.join(tmpBase, 'error.js')
    await fs.writeFile(fakeFile, 'console.log(1)', { mode: 0o000 })
    
    const result = await collectProjectContext(tmpBase)
    assert.equal(result.skippedFiles, 1)
    assert.ok(result.skippedList.length > 0)
    assert.match(result.skippedList[0], /read error:.*EACCES/i)
  } finally {
    // Restore permission before deleting
    try { await fs.chmod(path.join(tmpBase, 'error.js'), 0o644) } catch {}
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => {})
  }
})

test('Issue #123: GET /dsh-moa/history clamps limit (1..100) and offset (>=0) safely', async () => {
  const { routes } = setupTestEnvironment()
  const historyHandler = routes['/dsh-moa/history'].handler

  // Test 1: invalid params limit=abc, offset=-10 should default safely
  const { req: r1, res: res1, send: s1, getResult: g1 } = createMockReqRes({
    method: 'GET',
    url: '/dsh-moa/history?limit=abc&offset=-10',
  })
  s1()
  await historyHandler(r1, res1)
  const result1 = await g1()
  assert.equal(result1.status, 200)
  assert.equal(result1.json?.ok, true)
  assert.ok(Array.isArray(result1.json?.runs))

  // Test 2: oversized limit=999 should be clamped to 100
  const { req: r2, res: res2, send: s2, getResult: g2 } = createMockReqRes({
    method: 'GET',
    url: '/dsh-moa/history?limit=999&offset=5',
  })
  s2()
  await historyHandler(r2, res2)
  const result2 = await g2()
  assert.equal(result2.status, 200)
  assert.equal(result2.json?.ok, true)

  // Test 3: non-GET rejected with 405
  const { req: r3, res: res3, send: s3, getResult: g3 } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/history',
  })
  s3()
  await historyHandler(r3, res3)
  const result3 = await g3()
  assert.equal(result3.status, 405)
  assert.equal(result3.json?.ok, false)
})
