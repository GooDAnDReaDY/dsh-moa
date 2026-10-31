import test from 'node:test'
import assert from 'node:assert/strict'
import { registerMoaCommands } from '../lib/commands.js'
import { apply } from '../lib/index.js'

test('issue #275: registerMoaCommands registers with existing commands service', async () => {
  let registeredSpec = null
  let unregistered = false

  const fakeCommands = {
    register: (spec) => {
      registeredSpec = spec
      return () => { unregistered = true }
    },
  }

  const fakeCtx = {
    commands: fakeCommands,
    effect: (fn) => {
      const cleanup = fn()
      return cleanup
    },
  }

  const fakeConfig = {
    enabled: true,
    default_preset: 'speed',
    presets: [
      { id: 'p1', name: 'speed', references: [{ provider: 'p1', model: 'm1' }] },
    ],
  }

  registerMoaCommands(fakeCtx, {
    live: () => fakeConfig,
    moaService: {
      getHistory: () => ({ runs: [{ id: 'run-12345678', preset: 'speed', prompt: 'test prompt', winnerModel: 'm1', totalCostUsd: 0.001 }] }),
    },
  })

  assert.ok(registeredSpec, 'command was registered')
  assert.equal(registeredSpec.name, 'moa')
  assert.equal(registeredSpec.definitionId, '@goodandready/dsh-moa')
  assert.equal(registeredSpec.input?.hint, '[presets|history|status|<prompt>]')

  // Test /moa help
  const helpRes = await registeredSpec.handler('help')
  assert.match(helpRes.text, /MoA Command Guide/)

  // Test /moa presets
  const presetsRes = await registeredSpec.handler('presets')
  assert.match(presetsRes.text, /Configured MoA Presets/)
  assert.match(presetsRes.text, /speed/)

  // Test /moa status
  const statusRes = await registeredSpec.handler('status')
  assert.match(statusRes.text, /Plugin Status.*Enabled.*speed/)

  // Test /moa history
  const historyRes = await registeredSpec.handler('history')
  assert.match(historyRes.text, /Recent MoA Runs/)
  assert.match(historyRes.text, /run-1234/)

  // Test /moa with arbitrary prompt
  const promptRes = await registeredSpec.handler('write a python script')
  assert.match(promptRes.text, /MoA turn dispatched: "write a python script"/)

  // Test execute method
  const execRes = await registeredSpec.execute('status')
  assert.match(execRes, /Plugin Status.*Enabled/)
})

test('issue #275: registerMoaCommands registers dynamically via ctx.inject', async () => {
  let registeredSpec = null
  let injectCalled = false

  const fakeCtx = {
    inject: (deps, cb) => {
      if (deps.includes('commands')) {
        injectCalled = true
        cb({
          commands: {
            register: (spec) => {
              registeredSpec = spec
              return () => {}
            },
          },
          effect: (fn) => fn(),
        })
      }
    },
  }

  registerMoaCommands(fakeCtx, {
    live: () => ({ enabled: true }),
    moaService: {},
  })

  assert.ok(injectCalled, 'ctx.inject was called for commands')
  assert.ok(registeredSpec, 'command was registered through injection')
  assert.equal(registeredSpec.name, 'moa')
})

test('issue #275: apply wires /moa command registration', () => {
  let registeredSpec = null

  const fakeCtx = {
    commands: {
      register: (spec) => {
        registeredSpec = spec
        return () => {}
      },
    },
    inject: () => {},
    effect: (fn) => fn(),
    on: () => () => {},
    provide: () => {},
  }

  apply(fakeCtx, { enabled: true })

  assert.ok(registeredSpec, 'apply registered /moa command')
  assert.equal(registeredSpec.name, 'moa')
})