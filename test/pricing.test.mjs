import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, unlinkSync } from 'node:fs'
import {
  fetchCatalog,
  loadCachedCatalog,
  resolveModelRates,
  estimateTokenCost,
  DIRECT_VENDOR_RATES,
  FALLBACK_RATES,
} from '../lib/pricing.js'

test('pricing: direct vendor rates match official DeepSeek pricing', () => {
  const dsRate = resolveModelRates({ model: 'deepseek-chat' })
  assert.equal(dsRate.input, 0.14)
  assert.equal(dsRate.output, 0.28)

  const r1Rate = resolveModelRates({ model: 'deepseek-reasoner' })
  assert.equal(r1Rate.input, 0.55)
  assert.equal(r1Rate.output, 2.19)
})

test('pricing: custom user prices take highest priority', () => {
  const custom = {
    'custom-provider/my-model': { input: 0.5, output: 1.5 },
    'deepseek-chat': { input: 0.05, output: 0.10 },
  }

  const customRate = resolveModelRates({ provider: 'custom-provider', model: 'my-model' }, custom)
  assert.equal(customRate.input, 0.5)
  assert.equal(customRate.output, 1.5)

  const overriddenDs = resolveModelRates({ model: 'deepseek-chat' }, custom)
  assert.equal(overriddenDs.input, 0.05)
  assert.equal(overriddenDs.output, 0.10)
})

test('pricing: catalog cache loading and model matching', () => {
  const testCachePath = join(tmpdir(), `dsh-moa-test-cache-${Date.now()}.json`)
  const mockCatalog = {
    updatedAt: Date.now(),
    models: {
      'anthropic/claude-3.7-sonnet': { input: 3.0, output: 15.0, cacheHit: 0.3 },
      'google/gemini-2.5-pro': { input: 1.25, output: 5.0, cacheHit: 0.31 },
    }
  }
  writeFileSync(testCachePath, JSON.stringify(mockCatalog))

  try {
    const rate1 = resolveModelRates({ model: 'claude-3.7-sonnet' }, {}, testCachePath)
    assert.equal(rate1.input, 3.0)
    assert.equal(rate1.output, 15.0)

    const rate2 = resolveModelRates({ provider: 'google', model: 'gemini-2.5-pro' }, {}, testCachePath)
    assert.equal(rate2.input, 1.25)
    assert.equal(rate2.output, 5.0)

    const unknownRate = resolveModelRates({ model: 'completely-unknown-x' }, {}, testCachePath)
    assert.equal(unknownRate.input, FALLBACK_RATES.input)
    assert.equal(unknownRate.output, FALLBACK_RATES.output)
  } finally {
    try { unlinkSync(testCachePath) } catch {}
  }
})

test('pricing: estimateTokenCost computes exact input, output and cached costs', () => {
  const slot = { model: 'deepseek-chat' }
  const usage = {
    prompt_tokens: 1_000_000,
    completion_tokens: 500_000,
    prompt_tokens_details: { cached_tokens: 200_000 }
  }

  const result = estimateTokenCost(slot, usage)
  assert.equal(result.totalTokens, 1_500_000)
  assert.ok(Math.abs(result.costUsd - 0.2548) < 1e-4)
})
