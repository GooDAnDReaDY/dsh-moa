import test from 'node:test'
import assert from 'node:assert/strict'
import { stagePeerCritique } from '../lib/pipeline/peer-critique.js'

function makeRefs() {
  const refs = [
    {
      ok: true, index: 1, label: 'Model A', provider: 'p1', model: 'm1',
      text: 'ORIGINAL_A_CODE', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }, costUsd: 0.01,
      files: [{ relativePath: 'a.js', content: 'orig-a' }], slot: { provider: 'p1', model: 'm1' },
    },
    {
      ok: true, index: 2, label: 'Model B', provider: 'p2', model: 'm2',
      text: 'ORIGINAL_B_CODE', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }, costUsd: 0.01,
      files: [{ relativePath: 'b.js', content: 'orig-b' }], slot: { provider: 'p2', model: 'm2' },
    },
  ]
  // successfulRefs elements are the SAME objects as referenceOutputs (runner contract)
  return { refs, successfulRefs: refs.filter((r) => r.ok) }
}

const BROKEN_CRITIQUE = 'REFINED_BROKEN_CODE'

function baseArgs(preset, callLlm, { refs, successfulRefs }) {
  return {
    isPeerCritiqueEnabled: true,
    successfulRefs,
    referenceOutputs: refs,
    preset,
    prices: {},
    maxTokens: 512,
    primaryJudge: { provider: 'j', model: 'jm' },
    userPrompt: 'task',
    isBlindEvaluation: false,
    refTemp: 0.5,
    refTimeoutSec: 5,
    candidateRetries: 0,
    signal: null,
    callLlm,
    onProgress: null,
    cwd: '/tmp/moa-387-test',
    runId: 'test-387',
    isRefinement: false,
    isFastMode: false,
    collectedCtx: null,
    startTime: Date.now(),
    options: { testGateEnabled: false, testCommand: '' },
  }
}

test('#387 compete: broken critique never destroys the original - judge gets both variants', async () => {
  const { refs, successfulRefs } = makeRefs()
  let critiqueCalls = 0
  const res = await stagePeerCritique(baseArgs({ critique_guard_mode: 'compete' }, () => {
    critiqueCalls++
    // The measured failure mode: a critic that BREAKS a correct solution
    return BROKEN_CRITIQUE
  }, { refs, successfulRefs }))

  assert.equal(res.ok, true)
  assert.equal(res.guardMode, 'compete')
  assert.equal(res.derivedCount, 2, 'one derived variant per candidate')
  assert.equal(critiqueCalls, 2)

  // Originals are untouched - the measured defect (replacement) is impossible
  assert.equal(refs.find((r) => r.index === 1).text, 'ORIGINAL_A_CODE')
  assert.equal(refs.find((r) => r.index === 2).text, 'ORIGINAL_B_CODE')
  assert.equal(refs.find((r) => r.index === 1).files[0].content, 'orig-a')

  // Derived variants compete with distinct indexes and labels
  const derived = refs.filter((r) => r.derivedFrom !== undefined)
  assert.equal(derived.length, 2)
  assert.deepEqual(derived.map((d) => d.index).sort(), [3, 4])
  for (const d of derived) {
    assert.equal(d.text, BROKEN_CRITIQUE)
    assert.match(d.label, /\(critiqued\)$/)
    assert.ok(d.derivedFrom === 1 || d.derivedFrom === 2)
  }

  // Judge/synthesis sees originals AND derived variants (4 references total)
  assert.equal(refs.length, 4)
  assert.equal(successfulRefs.length, 4)

  // Critique usage is accounted on the derived variant (no double counting)
  for (const d of derived) {
    assert.equal(d.usage.totalTokens, 0, 'no mock usage reported on the critique call')
  }
})

test('#387 strict: refinement passing checks replaces; broken refinement dropped', async () => {
  const { refs, successfulRefs } = makeRefs()
  const res = await stagePeerCritique(baseArgs({ critique_guard_mode: 'strict' }, () => {
    // Broken refinement with a syntax error in the fenced file
    return 'text\n```javascript file="a.js"\nconst x = {{{\n```'
  }, { refs, successfulRefs }))

  assert.equal(res.ok, true)
  assert.equal(res.guardMode, 'strict')
  // No derived refs in strict mode; the broken refinement was rejected outright
  assert.equal(res.derivedCount, 0)
  assert.equal(refs.length, 2)
  // The original stays intact (nothing replaced, no files overwritten)
  assert.equal(refs.find((r) => r.index === 1).text, 'ORIGINAL_A_CODE')
  assert.equal(refs.find((r) => r.index === 1).files[0].content, 'orig-a')
})

test('#387 strict: valid refinement replaces the original and accounts usage', async () => {
  const { refs, successfulRefs } = makeRefs()
  const res = await stagePeerCritique(baseArgs({ critique_guard_mode: 'strict' }, () => {
    return {
      content: 'refined\n```javascript file="a.js"\nmodule.exports.ok = true\n```',
      usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 },
    }
  }, { refs, successfulRefs }))

  assert.equal(res.ok, true)
  assert.match(refs.find((r) => r.index === 1).text, /module\.exports\.ok = true/)
  assert.equal(refs.find((r) => r.index === 1).files[0].content.trim(), 'module.exports.ok = true')
  assert.equal(refs.find((r) => r.index === 1).usage.totalTokens, 32, 'critique usage (12) added to the round-1 usage (20)')
})

test('#387: default guard mode is compete when the flag is absent', async () => {
  const { refs, successfulRefs } = makeRefs()
  const res = await stagePeerCritique(baseArgs({}, () => BROKEN_CRITIQUE, { refs, successfulRefs }))
  assert.equal(res.guardMode, 'compete')
  assert.equal(refs.length, 4)
})
