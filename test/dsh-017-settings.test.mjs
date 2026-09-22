import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
register(pathToFileURL(path.join(__dirname, 'schemastery-stub-hooks.mjs')))

const { Config, NS, apply } = await import('../lib/index.js')

test('DSH 0.1.7 Config: all editable fields declare volatile metadata without enclosing volatile', () => {
  assert.equal(Config.meta?.volatile, undefined, 'Config root object must not be volatile to avoid enclosing volatile error')
  assert.equal(Config.fields?.enabled?.meta?.volatile, true, 'enabled field must be volatile')
  assert.equal(Config.fields?.default_preset?.meta?.volatile, true, 'default_preset field must be volatile')
  assert.equal(Config.fields?.prices?.meta?.volatile, true, 'prices field must be volatile')
  assert.equal(Config.fields?.presets?.meta?.volatile, true, 'presets field must be volatile')

  // Validation preserves volatile fields and sets defaults
  const parsed = Config({})
  assert.equal(parsed.enabled, true)
  assert.equal(parsed.default_preset, 'default')
  assert.ok(Array.isArray(parsed.presets))
  assert.equal(parsed.presets.length, 3)
})

test('DSH 0.1.7 settings policy: registers settings.configure({ auto: false }) and never calls legacy settings.register', () => {
  let configureCalledWith = null
  let registerCalled = false
  let warningLogged = false
  const origWarn = console.warn
  console.warn = (...args) => {
    if (args.join(' ').includes('Settings registration warning')) warningLogged = true
    origWarn(...args)
  }

  const dummyFiber = { uid: 123 }
  const effects = []
  let disposed = false

  const mockSettings = {
    configure: (policy, owner) => {
      configureCalledWith = { policy, owner }
      return () => {
        disposed = true
      }
    },
    // If legacy register were called, it should fail
    register: () => {
      registerCalled = true
      throw new TypeError('sctx.settings.register is not a function')
    },
  }

  const ctx = {
    fiber: dummyFiber,
    webServer: { port: 3000, register: () => () => {} },
    effect: (fn, label) => {
      effects.push(label)
      return fn()
    },
    on: () => () => {},
    inject: (deps, cb) => {
      if (deps.includes('settings')) {
        cb({ settings: mockSettings, effect: ctx.effect })
      }
    },
  }

  try {
    apply(ctx, { enabled: true, default_preset: 'default', presets: [] })

    assert.equal(registerCalled, false, 'Legacy settings.register must never be called')
    assert.equal(warningLogged, false, 'No settings registration warning should be emitted')
    assert.deepEqual(configureCalledWith, { policy: { auto: false }, owner: dummyFiber }, 'settings.configure must be called with auto: false and fiber')
    assert.ok(effects.includes('dsh-moa: settings policy'), 'policy disposer registered in ctx effects')
  } finally {
    console.warn = origWarn
  }
})

test('DSH 0.1.7 resilience: apply() works seamlessly when settings service is completely absent', () => {
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
    on: () => () => {},
    inject: (_deps, _cb) => {
      // settings service not present, callback never invoked
    },
  }

  assert.doesNotThrow(() => {
    apply(ctx, { enabled: true, default_preset: 'fast', presets: [{ name: 'fast', reference_models: [], aggregator: { provider: 'test', model: 'test' } }] })
  })

  assert.ok(routes['/dsh-moa/status'], 'status route registered')
  assert.ok(routes['/dsh-moa/presets'], 'presets route registered')
})

test('DSH 0.1.7 persistence: POST /dsh-moa/presets validates and calls settings.replace(NS, validated)', async () => {
  let replacedWith = null
  const mockSettings = {
    replace: async (ns, payload) => {
      replacedWith = { ns, payload }
    },
    configure: () => () => {},
  }

  const routes = {}
  const ctx = {
    get settings() {
      throw new Error('cannot get property "settings" without inject')
    },
    webServer: {
      port: 3000,
      register: (route) => {
        routes[route.path] = route
        return () => {}
      },
    },
    effect: (fn) => fn(),
    on: () => () => {},
    inject: (deps, cb) => {
      if (deps.includes('settings')) {
        cb({ settings: mockSettings, effect: ctx.effect })
      }
    },
  }

  const initialConfig = {
    enabled: true,
    default_preset: 'default',
    presets: [{ name: 'default', reference_models: [], aggregator: { provider: 'codex', model: 'gpt-5.6-sol' } }],
  }

  apply(ctx, initialConfig)

  const presetsRoute = routes['/dsh-moa/presets']
  assert.ok(presetsRoute, 'presets route exists')

  // Simulate POST request
  const updatedPayload = {
    enabled: true,
    default_preset: 'custom',
    presets: [
      {
        name: 'custom',
        enabled: true,
        reference_models: [{ provider: 'test', model: 'm1' }],
        aggregator: { provider: 'test', model: 'm2' },
      },
    ],
  }

  let responseStatus = 0
  let responseData = null

  const mockReq = {
    method: 'POST',
    headers: { host: 'localhost:3000' },
    on: (evt, handler) => {
      if (evt === 'data') handler(Buffer.from(JSON.stringify(updatedPayload)))
      if (evt === 'end') handler()
    },
  }

  const mockRes = {
    writeHead: (status) => {
      responseStatus = status
    },
    end: (body) => {
      responseData = JSON.parse(body)
    },
  }

  await presetsRoute.handler(mockReq, mockRes)

  assert.equal(responseStatus, 200)
  assert.equal(responseData?.ok, true)
  assert.equal(responseData?.defaultPreset, 'custom')
  assert.equal(responseData?.presets?.length, 1)

  assert.equal(replacedWith?.ns, NS)
  assert.equal(replacedWith?.payload?.default_preset, 'custom')
  assert.equal(replacedWith?.payload?.presets?.length, 1)
})
