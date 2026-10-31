import test from 'node:test'
import assert from 'node:assert/strict'
import { checkSlotQuotaStatus, balanceCandidateQuotas } from '../lib/moa-quota-balancer.js'
import { PresetSchema } from '../lib/moa-schema.js'
import { COMPANION_PLUGINS } from '../lib/moa-workbench.js'

test('issue #253: PresetSchema accepts quota_aware_balancing_enabled and COMPANION_PLUGINS includes key-limits and subscriptions', () => {
  const parsed = PresetSchema({ name: 'q-preset', quota_aware_balancing_enabled: true })
  assert.equal(parsed.quota_aware_balancing_enabled, true)

  const ids = COMPANION_PLUGINS.map((p) => p.id)
  assert.ok(ids.includes('dsh-key-limits'))
  assert.ok(ids.includes('dsh-subscriptions'))
})

test('issue #253: checkSlotQuotaStatus detects exhausted or low quota from dsh-key-limits and dsh-subscriptions', async () => {
  const mockKeyLimits = {
    async getQuotaStatus(provider, model) {
      if (provider === 'anthropic' && model === 'claude-3-7-sonnet') {
        return { remaining: 2, limit: 100 }
      }
      return { remaining: 90, limit: 100 }
    },
  }

  const lowStatus = await checkSlotQuotaStatus(null, { provider: 'anthropic', model: 'claude-3-7-sonnet' }, {
    keyLimitsService: mockKeyLimits,
  })
  assert.equal(lowStatus.exhausted, true)
  assert.ok(lowStatus.reason.includes('dsh-key-limits'))

  const healthyStatus = await checkSlotQuotaStatus(null, { provider: 'openai', model: 'gpt-4o' }, {
    keyLimitsService: mockKeyLimits,
  })
  assert.equal(healthyStatus.exhausted, false)
})

test('issue #253: balanceCandidateQuotas substitutes low-quota slots with healthy fallback models', async () => {
  const mockKeyLimits = {
    async getQuotaStatus(provider) {
      if (provider === 'anthropic') {
        return { exhausted: true, reason: '429 Rate Limit' }
      }
      return { exhausted: false, remainingRatio: 0.9 }
    },
  }

  const references = [
    { provider: 'anthropic', model: 'claude-3-7-sonnet' },
    { provider: 'openai', model: 'gpt-4o' },
  ]

  const { balancedReferences, substitutions } = await balanceCandidateQuotas(references, {
    keyLimitsService: mockKeyLimits,
    aggregator: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
  })

  assert.equal(substitutions.length, 1)
  assert.equal(substitutions[0].index, 1)
  assert.equal(balancedReferences[0].provider, 'deepseek')
  assert.equal(balancedReferences[1].provider, 'openai')
})
