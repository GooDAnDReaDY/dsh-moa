import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runSelfHealingLoop, rollbackToTimeMachineSnapshot } from '../lib/moa-self-healing.js'
import { PresetSchema } from '../lib/moa-schema.js'

test('issue #252: PresetSchema accepts self_healing_enabled, self_healing_max_retries, and self_healing_command', () => {
  const parsed = PresetSchema({
    name: 'heal-preset',
    self_healing_enabled: true,
    self_healing_max_retries: 3,
    self_healing_command: 'pnpm check',
  })
  assert.equal(parsed.self_healing_enabled, true)
  assert.equal(parsed.self_healing_max_retries, 3)
  assert.equal(parsed.self_healing_command, 'pnpm check')
})

test('issue #252: runSelfHealingLoop heals broken file via aggregator hotfix on first retry', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-heal-pass-'))
  try {
    await fs.writeFile(path.join(tmpDir, 'math.js'), 'export const sum = (a, b) => a - b;\n', 'utf8')

    let checkCount = 0
    const mockExecFn = async (cwd) => {
      checkCount++
      const content = await fs.readFile(path.join(cwd, 'math.js'), 'utf8')
      if (content.includes('a + b')) {
        return { passed: true, exitCode: 0, output: 'All tests passed' }
      }
      return { passed: false, exitCode: 1, output: 'AssertionError: expected 5, got -1 in math.js' }
    }

    const mockCallLlm = async () => {
      return 'Here is the hotfix:\n```js path=math.js\nexport const sum = (a, b) => a + b;\n```'
    }

    const res = await runSelfHealingLoop({
      cwd: tmpDir,
      command: 'npm test',
      maxRetries: 2,
      aggregatorSlot: { provider: 'p1', model: 'judge' },
      callLlm: mockCallLlm,
      userPrompt: 'Create sum function',
      promotedFiles: ['math.js'],
      execFn: mockExecFn,
    })

    assert.equal(res.passed, true)
    assert.equal(res.attempts, 1)
    assert.equal(res.rolledBack, false)
    assert.ok(res.hotfixFiles.includes('math.js'))
    assert.equal(checkCount, 2)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('issue #252: runSelfHealingLoop triggers automatic Time Machine rollback when retries are exhausted', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-heal-rb-'))
  try {
    let rolledBackTo = null
    const mockExecFn = async () => ({
      passed: false,
      exitCode: 1,
      output: 'SyntaxError: Unexpected token',
    })

    const mockCallLlm = async () => 'Still broken response without valid fix'

    const res = await runSelfHealingLoop({
      cwd: tmpDir,
      command: 'npm test',
      maxRetries: 2,
      aggregatorSlot: { provider: 'p1', model: 'judge' },
      callLlm: mockCallLlm,
      userPrompt: 'Broken feature',
      promotedFiles: ['broken.js'],
      checkpoint: { id: 'snap-999' },
      execFn: mockExecFn,
      rollbackFn: async (dir, snapId) => {
        rolledBackTo = snapId
        return true
      },
    })

    assert.equal(res.passed, false)
    assert.equal(res.attempts, 2)
    assert.equal(res.rolledBack, true)
    assert.equal(res.snapshotId, 'snap-999')
    assert.equal(rolledBackTo, 'snap-999')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
