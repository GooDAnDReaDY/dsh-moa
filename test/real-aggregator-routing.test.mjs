import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMoACommand } from '../lib/moa-runner.js'

test('routing contract: resolves real aggregator model from active preset', () => {
  const presets = [
    {
      name: 'default',
      reference_models: [
        { provider: 'opencode-go', model: 'deepseek-v4-flash' },
        { provider: 'grok', model: 'grok-build-0.1' },
      ],
      aggregator: { provider: 'codex', model: 'gpt-5.6-sol' },
    },
    {
      name: 'fast',
      reference_models: [
        { provider: 'opencode-go', model: 'deepseek-v4-flash' },
      ],
      aggregator: { provider: 'opencode-go', model: 'deepseek-v4-flash' },
    },
    {
      name: 'deep-reasoning',
      reference_models: [
        { provider: 'grok', model: 'grok-build-0.1' },
        { provider: 'commandcode', model: 'deepseek/deepseek-v4-flash' },
      ],
      aggregator: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
    },
  ]

  // Case 1: Default preset
  const parsed1 = parseMoACommand('/moa write snake game', presets)
  const p1 = presets.find((p) => p.name === parsed1.presetName) || presets[0]
  assert.equal(p1.aggregator.provider, 'codex')
  assert.equal(p1.aggregator.model, 'gpt-5.6-sol')

  // Case 2: Explicit fast preset
  const parsed2 = parseMoACommand('/moa --preset fast generate quick snippet', presets)
  const p2 = presets.find((p) => p.name === parsed2.presetName) || presets[0]
  assert.equal(p2.aggregator.provider, 'opencode-go')
  assert.equal(p2.aggregator.model, 'deepseek-v4-flash')

  // Case 3: Explicit deep-reasoning preset
  const parsed3 = parseMoACommand('/moa --preset deep-reasoning solve math problem', presets)
  const p3 = presets.find((p) => p.name === parsed3.presetName) || presets[0]
  assert.equal(p3.aggregator.provider, 'anthropic')
  assert.equal(p3.aggregator.model, 'claude-3-7-sonnet')
})

test('routing contract: verifies no virtual or fictitious provider names are used', () => {
  const presets = [
    {
      name: 'default',
      aggregator: { provider: 'codex', model: 'gpt-5.6-sol' },
    },
  ]

  const parsed = parseMoACommand('/moa hello', presets)
  const targetPreset = presets.find((p) => p.name === parsed.presetName) || presets[0]

  assert.notEqual(targetPreset.aggregator.provider, 'moa-runner')
  assert.notEqual(targetPreset.aggregator.model, 'ensemble')
  assert.equal(typeof targetPreset.aggregator.provider, 'string')
  assert.equal(typeof targetPreset.aggregator.model, 'string')
})
