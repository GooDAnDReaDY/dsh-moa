import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import {
  fetchCatalog,
  getCatalogStatus,
  refreshCatalogInBackground,
  resetMemoryCatalog,
} from '../lib/pricing.js'
import { setLogger } from '../lib/logger.js'
import { registerPresetRoutes } from '../lib/routes/presets.js'

test('pricing: fetchCatalog logs warnings and exposes stale + lastError in getCatalogStatus when upstream fails without wiping error', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pricing-stale-'))
  const cacheFile = path.join(tmpDir, 'catalog.json')
  const origFetch = globalThis.fetch
  const warnings = []
  setLogger({
    warn: (...args) => warnings.push(args.join(' ')),
    debug: () => {},
    info: () => {},
  })

  try {
    resetMemoryCatalog()
    globalThis.fetch = async () => ({ ok: false, status: 503 })

    await fetchCatalog({ url: 'https://example.invalid/models', cachePath: cacheFile })
    const status = getCatalogStatus(cacheFile)

    assert.equal(status.stale, true)
    assert.match(status.lastError || '', /HTTP 503/)
    assert.ok(status.lastErrorAt > 0)
    assert.ok(warnings.some((w) => w.includes('HTTP 503')))

    // Recovery clears stale error state
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } }],
      }),
    })
    await fetchCatalog({ url: 'https://example.invalid/models', cachePath: cacheFile })
    const recovered = getCatalogStatus(cacheFile)
    assert.equal(recovered.stale, false)
    assert.equal(recovered.lastError, null)
    assert.equal(recovered.modelCount, 1)

    // refreshCatalogInBackground catches async rejection safely via bestEffort
    resetMemoryCatalog()
    fs.unlinkSync(cacheFile)
    globalThis.fetch = async () => { throw new Error('network down') }
    refreshCatalogInBackground(cacheFile)
    await new Promise((r) => setTimeout(r, 20))
    const bgStatus = getCatalogStatus(cacheFile)
    assert.equal(bgStatus.stale, true)
    assert.match(bgStatus.lastError || '', /network down/)
  } finally {
    globalThis.fetch = origFetch
    setLogger(null)
    resetMemoryCatalog()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('routes: /dsh-moa/status and /dsh-moa/health expose pricing stale status and lastError', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-health-route-'))
  const cacheFile = path.join(tmpDir, 'catalog.json')
  const prevEnv = process.env.DSH_CATALOG_FILE
  const origFetch = globalThis.fetch
  process.env.DSH_CATALOG_FILE = cacheFile

  const routes = new Map()
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      register: (def) => {
        routes.set(def.path, def.handler)
        return () => {}
      },
    },
  }

  try {
    resetMemoryCatalog()
    setLogger({ warn: () => {}, debug: () => {}, info: () => {} })
    globalThis.fetch = async () => ({ ok: false, status: 502 })
    await fetchCatalog({ cachePath: cacheFile })

    registerPresetRoutes(mockCtx, {
      live: () => ({ enabled: true, default_preset: 'default', presets: [{ name: 'default' }] }),
    })

    const invokeGet = (routePath) => {
      const handler = routes.get(routePath)
      assert.ok(handler, `${routePath} registered`)
      const req = Object.assign(new EventEmitter(), {
        method: 'GET',
        url: routePath,
        headers: { host: '127.0.0.1:3000' },
        socket: { remoteAddress: '127.0.0.1' },
      })
      let statusCode = 0
      let rawBody = ''
      const res = {
        headersSent: false,
        setHeader: () => {},
        writeHead: (code) => { statusCode = code; res.headersSent = true },
        end: (chunk) => { rawBody += chunk || '' },
      }
      handler(req, res)
      return { statusCode, json: JSON.parse(rawBody) }
    }

    const statusRes = invokeGet('/dsh-moa/status')
    assert.equal(statusRes.statusCode, 200)
    assert.equal(statusRes.json.pricing.stale, true)
    assert.match(statusRes.json.pricing.lastError || '', /502/)

    const healthRes = invokeGet('/dsh-moa/health')
    assert.equal(healthRes.statusCode, 200)
    assert.equal(healthRes.json.status, 'degraded')
    assert.equal(healthRes.json.pricingStale, true)
    assert.match(healthRes.json.pricing.lastError || '', /502/)
  } finally {
    if (prevEnv === undefined) delete process.env.DSH_CATALOG_FILE
    else process.env.DSH_CATALOG_FILE = prevEnv
    globalThis.fetch = origFetch
    setLogger(null)
    resetMemoryCatalog()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
