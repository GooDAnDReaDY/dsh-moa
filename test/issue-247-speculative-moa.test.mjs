import test from 'node:test'
import assert from 'node:assert/strict'
import { applyAuditorPatchHunks, runSpeculativeMoa } from '../lib/moa-speculative.js'
import { PresetSchema } from '../lib/moa-schema.js'

test('issue #247: PresetSchema accepts speculative_moa_enabled and speculative_draft_model', () => {
  const parsed = PresetSchema({
    name: 'spec-p',
    speculative_moa_enabled: true,
    speculative_draft_model: { provider: 'ollama', model: 'qwen2.5-coder:7b' },
  })
  assert.equal(parsed.speculative_moa_enabled, true)
  assert.equal(parsed.speculative_draft_model.provider, 'ollama')
  assert.equal(parsed.speculative_draft_model.model, 'qwen2.5-coder:7b')
})

test('issue #247: applyAuditorPatchHunks applies SEARCH/REPLACE and diff blocks to draft', () => {
  const draft = 'export function add(a, b) {\n  return a - b;\n}\n'
  const patch = `Found a bug in addition:\n<<<<<<< SEARCH\n  return a - b;\n=======\n  return a + b;\n>>>>>>> REPLACE`

  const { patchedText, appliedCount } = applyAuditorPatchHunks(draft, patch)
  assert.equal(appliedCount, 1)
  assert.ok(patchedText.includes('return a + b;'))
})

test('issue #247: runSpeculativeMoa executes fast draft followed by parallel auditor diffs, and falls back when draft fails', async () => {
  const references = [
    { provider: 'p1', model: 'auditor-1' },
    { provider: 'p2', model: 'auditor-2' },
  ]

  const mockCallLlm = async (args) => {
    if (args.model === 'fast-draft') {
      return '```js path=src/calc.js\nexport const calc = (x) => x * 1;\n```'
    }
    return `Audit by ${args.model}:\n<<<<<<< SEARCH\nexport const calc = (x) => x * 1;\n=======\nexport const calc = (x) => x * 2;\n>>>>>>> REPLACE`
  }

  const res = await runSpeculativeMoa(
    references,
    [{ role: 'user', content: 'Write calc function' }],
    { draftModel: { provider: 'local', model: 'fast-draft' } },
    mockCallLlm
  )

  assert.equal(res.fallbackToStandard, false)
  assert.equal(res.referenceOutputs.length, 2)
  assert.equal(res.referenceOutputs[0].speculativeAppliedHunks, 1)
  assert.ok(res.referenceOutputs[0].text.includes('x * 2'))

  // Verify fallback when draft model throws
  const failingDraftRes = await runSpeculativeMoa(
    references,
    [{ role: 'user', content: 'Write calc function' }],
    { draftModel: { provider: 'local', model: 'broken-draft' } },
    async (args) => {
      if (args.model === 'broken-draft') throw new Error('Connection refused')
      return 'ok'
    }
  )
  assert.equal(failingDraftRes.fallbackToStandard, true)
})
