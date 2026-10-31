import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { generateAdversarialTestSuite, runAdversarialTddLoop } from '../lib/moa-adversarial-tdd.js'
import { writeCandidateWorkspace } from '../lib/workspace/fs.js'
import { PresetSchema } from '../lib/moa-schema.js'

test('issue #246: PresetSchema accepts adversarial_tdd_enabled', () => {
  const parsed = PresetSchema({ name: 'tdd-p', adversarial_tdd_enabled: true })
  assert.equal(parsed.adversarial_tdd_enabled, true)
})

test('issue #246: runAdversarialTddLoop generates unit tests from prompt, executes against candidate sandboxes, and formats Judge report', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-adv-tdd-'))
  const runId = 'tdd-run-1'
  try {
    const candidateFiles1 = [{ relativePath: 'div.mjs', content: 'export function safeDiv(a, b) { return b === 0 ? 0 : a / b; }\n' }]
    const candidateFiles2 = [{ relativePath: 'div.mjs', content: 'export function safeDiv(a, b) { return a / b; }\n' }]

    await writeCandidateWorkspace(tmpDir, 1, candidateFiles1, { runId })
    await writeCandidateWorkspace(tmpDir, 2, candidateFiles2, { runId })

    const referenceOutputs = [
      { index: 1, label: 'p1:good', ok: true, files: candidateFiles1 },
      { index: 2, label: 'p2:buggy', ok: true, files: candidateFiles2 },
    ]

    const mockCallLlm = async () => {
      return [
        'Here is the adversarial test suite:',
        '```js path=__moa_adversarial.test.mjs',
        'import test from "node:test";',
        'import assert from "node:assert/strict";',
        'import { safeDiv } from "./div.mjs";',
        'test("handles division by zero safely", () => {',
        '  assert.equal(safeDiv(10, 0), 0);',
        '});',
        '```',
      ].join('\n')
    }

    const mockExecFn = async ({ candidateDir }) => {
      const passed = String(candidateDir).includes("candidate-1")
      return {
        passed,
        exitCode: passed ? 0 : 1,
        output: passed ? '1 passing' : 'AssertionError: Infinity !== 0',
        summary: passed ? '1/1 passed' : '0/1 passed (division by zero failed)',
        durationMs: 12,
      }
    }

    const res = await runAdversarialTddLoop({
      cwd: tmpDir,
      runId,
      userPrompt: 'Implement safeDiv(a, b) that returns 0 when b is 0',
      referenceOutputs,
      preset: { aggregator: { provider: 'redteam', model: 'test-gen' } },
      callLlm: mockCallLlm,
      execFn: mockExecFn,
    })

    assert.equal(res.executed, true)
    assert.equal(res.results.length, 2)
    assert.equal(res.results[0].passed, true)
    assert.equal(res.results[1].passed, false)
    assert.ok(res.directive.includes('Adversarial TDD Verification Report'))
    assert.ok(res.directive.includes('PASSED ✅'))
    assert.ok(res.directive.includes('FAILED ❌'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
