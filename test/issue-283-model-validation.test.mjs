import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getActiveLlmProviders,
  getActiveLlmModels,
  validateSlot,
  validatePreset,
  validateAllPresets,
} from '../lib/moa-model-validator.js'
import { MoaService } from '../lib/moa-service.js'

test('issue #283: getActiveLlmProviders discovers providers across ctx.llm APIs', async () => {
  // Case 1: ctx without llm
  const empty = await getActiveLlmProviders({})
  assert.equal(empty.size, 0)

  // Case 2: ctx.llm with listProviders and listConfigurableProviders
  const fakeCtx = {
    llm: {
      listProviders: async () => ['openai', 'anthropic'],
      listConfigurableProviders: () => [{ id: 'deepseek' }, { provider: 'ollama' }],
      providers: {
        custom: {},
      },
    },
  }
  const providers = await getActiveLlmProviders(fakeCtx)
  assert.ok(providers.has('openai'))
  assert.ok(providers.has('anthropic'))
  assert.ok(providers.has('deepseek'))
  assert.ok(providers.has('ollama'))
  assert.ok(providers.has('custom'))
})

test('issue #283: getActiveLlmModels queries models per provider with timeout safety', async () => {
  const fakeCtx = {
    llm: {
      listProviders: async () => ['openai', 'slow_provider'],
      listModels: async (provider) => {
        if (provider === 'openai') return ['gpt-4o', { id: 'gpt-4o-mini' }]
        if (provider === 'slow_provider') {
          await new Promise((r) => setTimeout(r, 3000))
          return ['never']
        }
        return []
      },
      listAvailableModels: async () => [{ provider: 'anthropic', id: 'claude-3-5-sonnet' }],
    },
  }

  const modelMap = await getActiveLlmModels(fakeCtx)
  assert.ok(modelMap.has('openai'))
  assert.ok(modelMap.get('openai').has('gpt-4o'))
  assert.ok(modelMap.get('openai').has('gpt-4o-mini'))
  assert.ok(modelMap.has('anthropic'))
  assert.ok(modelMap.get('anthropic').has('claude-3-5-sonnet'))
})

test('issue #283: validateSlot flags missing providers and unregistered models', () => {
  const activeProviders = new Set(['openai', 'deepseek'])
  const modelMap = new Map([
    ['openai', new Set(['gpt-4o', 'gpt-4o-mini'])],
    ['deepseek', new Set(['deepseek-chat', 'deepseek-reasoner'])],
  ])

  // Valid slot
  const s1 = validateSlot({ provider: 'openai', model: 'gpt-4o' }, 'reference', activeProviders, modelMap)
  assert.equal(s1.valid, true)

  // Missing provider in slot definition
  const s2 = validateSlot({ model: 'gpt-4o' }, 'reference', activeProviders, modelMap)
  assert.equal(s2.valid, false)
  assert.equal(s2.reason, 'missing_provider')

  // Unregistered provider
  const s3 = validateSlot({ provider: 'nonexistent', model: 'any' }, 'reference', activeProviders, modelMap)
  assert.equal(s3.valid, false)
  assert.equal(s3.reason, 'provider_not_found')

  // Known provider but unregistered model
  const s4 = validateSlot({ provider: 'openai', model: 'gpt-99-nonexistent' }, 'reference', activeProviders, modelMap)
  assert.equal(s4.valid, false)
  assert.equal(s4.reason, 'model_not_found')
})

test('issue #283: validatePreset identifies dead models in references, aggregator and fallbacks', () => {
  const activeProviders = new Set(['openai'])
  const modelMap = new Map([
    ['openai', new Set(['gpt-4o'])],
  ])

  const presetWithDeadSlots = {
    name: 'mixed-preset',
    aggregator_model: { provider: 'missing_agg_provider', model: 'm1' },
    references: [
      { provider: 'openai', model: 'gpt-4o' }, // OK
      {
        provider: 'dead_prov',
        model: 'm2',
        fallbacks: [
          { provider: 'dead_fb_prov', model: 'fb1' },
        ],
      },
    ],
  }

  const report = validatePreset(presetWithDeadSlots, { activeProviders, modelMap })
  assert.equal(report.valid, false)
  assert.equal(report.hasDeadModels, true)
  assert.equal(report.deadModels.length, 3, 'flags dead aggregator, dead reference, and dead fallback')
  assert.ok(report.warnings.some((w) => w.includes('Aggregator model')))
  assert.ok(report.warnings.some((w) => w.includes('Reference candidate')))
  assert.ok(report.warnings.some((w) => w.includes('Reserve fallback')))
})

test('issue #283: validateAllPresets aggregates diagnostics and logs warnings', async () => {
  const fakeCtx = {
    llm: {
      listProviders: async () => ['openai'],
      listModels: async () => ['gpt-4o'],
    },
  }

  const presets = [
    {
      name: 'healthy',
      aggregator_model: { provider: 'openai', model: 'gpt-4o' },
      references: [{ provider: 'openai', model: 'gpt-4o' }],
    },
    {
      name: 'has-dead',
      references: [{ provider: 'unsupported_prov', model: 'x' }],
    },
  ]

  const summary = await validateAllPresets(presets, fakeCtx)
  assert.equal(summary.valid, false)
  assert.equal(summary.totalDeadModels, 1)
  assert.equal(summary.presets[0].valid, true)
  assert.equal(summary.presets[1].valid, false)
  assert.deepEqual(summary.activeProviders, ['openai'])
})

test('issue #283: MoaService exposes validatePresets and getActiveProviders', async () => {
  const fakeCtx = {
    llm: {
      listProviders: async () => ['deepseek', 'ollama'],
    },
  }

  const svc = new MoaService(fakeCtx, {
    live: () => ({
      presets: [
        { name: 'p1', references: [{ provider: 'deepseek', model: 'chat' }] },
      ],
    }),
  })

  const providers = await svc.getActiveProviders()
  assert.ok(providers.includes('deepseek'))
  assert.ok(providers.includes('ollama'))

  const validation = await svc.validatePresets()
  assert.ok(validation.activeProviders.includes('deepseek'))
  assert.equal(validation.presets[0].name || validation.presets[0].presetName, 'p1')
})