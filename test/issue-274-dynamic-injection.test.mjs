import test from 'node:test'
import assert from 'node:assert/strict'
import { service, getWebServerPort } from '../lib/services.js'
import { inject, name, apply } from '../lib/index.js'

test('dynamic injection: static inject declares minimal llm dependency', () => {
  assert.equal(name, '@goodandready/dsh-moa')
  assert.deepEqual(inject, ['llm'])
})

test('services: service() safely handles strict proxy throwing on missing properties', () => {
  // Simulate Cordis strict proxy guard
  const strictCtx = new Proxy({
    llm: { dummy: true },
  }, {
    get(target, prop) {
      if (prop in target) return target[prop]
      throw new Error(`cannot get property "${String(prop)}" without inject`)
    }
  })

  // Must not throw, should return undefined
  assert.equal(service(strictCtx, 'webServer'), undefined)
  assert.equal(service(strictCtx, 'sessions'), undefined)
  assert.equal(service(strictCtx, 'tools'), undefined)
  assert.equal(service(strictCtx, 'commands'), undefined)

  // Present property should return value
  assert.deepEqual(service(strictCtx, 'llm'), { dummy: true })
})

test('services: service() resolves via ctx.get() and ctx.reflect.get()', () => {
  const ctxWithGet = {
    get: (prop) => (prop === 'custom' ? { value: 42 } : undefined)
  }
  assert.deepEqual(service(ctxWithGet, 'custom'), { value: 42 })

  const ctxWithReflect = {
    reflect: {
      get: (prop) => (prop === 'reflected' ? 'ok' : undefined)
    }
  }
  assert.equal(service(ctxWithReflect, 'reflected'), 'ok')
})

test('services: getWebServerPort() extracts port safely or returns null', () => {
  assert.equal(getWebServerPort({}), null)
  assert.equal(getWebServerPort(null), null)
  assert.equal(getWebServerPort(undefined), null)
  assert.equal(getWebServerPort({ webServer: { port: 3080 } }), 3080)
  assert.equal(getWebServerPort({ webServer: { port: 'invalid' } }), null)
})

test('dynamic injection: apply() gracefully handles headless environment without webServer', () => {
  let streamInterceptorRegistered = false
  const headlessCtx = {
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    effect: (fn) => fn(),
    on: (event, handler) => {
      if (event === 'llm/stream') streamInterceptorRegistered = true
      return () => {}
    },
    inject: (deps, cb) => {
      // In headless mode, webServer is never mounted
    },
  }

  // Must not throw when webServer is absent
  assert.doesNotThrow(() => {
    apply(headlessCtx, { enabled: true, default_preset: 'default', presets: [] })
  })

  assert.equal(streamInterceptorRegistered, true)
})

test('dynamic injection: apply() registers routes when webServer is dynamically injected', () => {
  const registeredRoutes = []
  let injectCalledWith = null

  const targetCtx = {
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    effect: (fn) => fn(),
    on: () => () => {},
    inject: (deps, cb) => {
      injectCalledWith = deps
      if (deps.includes('webServer')) {
        cb({
          webServer: {
            port: 3088,
            register: (route) => {
              registeredRoutes.push(route)
              return () => {}
            }
          },
          effect: (fn) => fn(),
        })
      }
    },
  }

  apply(targetCtx, { enabled: true, default_preset: 'default', presets: [] })

  assert.deepEqual(injectCalledWith, ['webServer'])
  assert.ok(registeredRoutes.length > 0, 'Routes must be registered via dynamic webServer injection')
})

