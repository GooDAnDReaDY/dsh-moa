import test from 'node:test'
import assert from 'node:assert/strict'
import { MoaService } from '../lib/moa-service.js'
import { apply, name } from '../lib/index.js'

test('MoaService: getPresets and getPreset return configured presets', () => {
  const fakeConfig = {
    presets: [
      { id: 'p1', name: 'speed', references: [{ provider: 'pr1', model: 'm1' }] },
      { id: 'p2', name: 'quality', references: [{ provider: 'pr2', model: 'm2' }] },
    ],
  }
  const svc = new MoaService(null, { live: () => fakeConfig })

  assert.equal(svc.getPresets().length, 2)
  assert.equal(svc.getPreset('p1')?.name, 'speed')
  assert.equal(svc.getPreset('quality')?.id, 'p2')
  // Fallback to first if not found
  assert.equal(svc.getPreset('non-existent')?.id, 'p1')
  // Default first when no arg
  assert.equal(svc.getPreset()?.id, 'p1')
})

test('MoaService: getHistory returns empty or queried history', () => {
  const svc = new MoaService(null, {
    getMoaHistory: (limit, offset) => ({ runs: [{ id: 'run-1' }], total: 1, limit, offset }),
  })
  const hist = svc.getHistory(5, 1)
  assert.equal(hist.total, 1)
  assert.equal(hist.limit, 5)
  assert.equal(hist.offset, 1)
})

test('MoaService: resolvePresetForPrompt routes prompt via resolver', async () => {
  const svc = new MoaService(null, {
    live: () => ({ presets: [{ id: 'p1', name: 'code' }] }),
    resolvePresetForPrompt: async ({ prompt }) => ({
      preset: { id: 'routed-preset', promptSeen: prompt },
    }),
  })
  const res = await svc.resolvePresetForPrompt('write python script')
  assert.equal(res.preset.id, 'routed-preset')
  assert.equal(res.preset.promptSeen, 'write python script')
})

test('MoaService: run rejects empty prompt and no messages', async () => {
  const svc = new MoaService(null, {
    runMoAPipeline: async () => ({ ok: true }),
  })
  await assert.rejects(
    async () => svc.run({ prompt: '' }),
    /prompt or userPrompt is required/
  )
})

test('MoaService: run executes pipeline in-process and passes ctx and options', async () => {
  let executedArgs = null
  const mockCtx = { id: 'mock-cordis-context' }
  const fakePreset = { id: 'p1', name: 'test-preset', references: [] }

  const svc = new MoaService(mockCtx, {
    live: () => ({ presets: [fakePreset] }),
    runMoAPipeline: async (args) => {
      executedArgs = args
      return { kind: 'synthesis', content: 'MoA synthesized result', ok: true }
    },
    callLlm: async () => 'ok',
  })

  const result = await svc.run({
    prompt: 'Implement feature X',
    presetId: 'p1',
    cwd: '/custom/workspace',
  })

  assert.equal(result.kind, 'synthesis')
  assert.equal(result.content, 'MoA synthesized result')
  assert.equal(executedArgs.userPrompt, 'Implement feature X')
  assert.equal(executedArgs.cwd, '/custom/workspace')
  assert.equal(executedArgs.ctx, mockCtx)
  assert.equal(executedArgs.preset.id, 'p1')
})

test('MoaService: Cordis Context integration: provide and inject', async () => {
  let consumerReceived = null

  // Mock Cordis Context with provide, inject, effect
  const rootContext = {
    services: new Map(),
    provide(serviceName, serviceInstance) {
      this.services.set(serviceName, serviceInstance)
      if (this.consumers) {
        for (const cb of this.consumers) cb({ moa: serviceInstance })
      }
    },
    consumers: [],
    inject(deps, callback) {
      if (deps.includes('moa') && this.services.has('moa')) {
        callback({ moa: this.services.get('moa') })
      } else {
        this.consumers.push(callback)
      }
    },
    effect(fn) { return fn() },
    on() {},
    emit() {},
  }

  // Apply plugin to rootContext
  apply(rootContext, { enabled: true })

  // Verify ctx.moa was registered
  assert.ok(rootContext.moa instanceof MoaService)

  // Verify a consumer injecting 'moa' gets the instance
  rootContext.inject(['moa'], (scopedCtx) => {
    consumerReceived = scopedCtx.moa
  })
  assert.ok(consumerReceived instanceof MoaService)
  assert.equal(consumerReceived, rootContext.moa)
})
