import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  resolveCandidateDir,
  runCandidateTestGate,
  executeTestGateForCandidates,
} from '../lib/moa-test-gate.js'
import {
  buildSynthesisPrompt,
  buildCuratorSynthesisPrompt,
  TEST_GATE_DIRECTIVE,
} from '../lib/moa-prompts.js'
import { candidatesForHistory } from '../lib/history.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

test('moa-test-gate: resolveCandidateDir computes safe path within .moa', () => {
  const tmp = os.tmpdir()
  assert.equal(resolveCandidateDir(null, 1), null)
  assert.equal(resolveCandidateDir(tmp, null), null)

  const dir1 = resolveCandidateDir(tmp, 1)
  assert.equal(dir1, path.join(tmp, '.moa', 'candidate-1'))

  const dir2 = resolveCandidateDir(tmp, 'candidate-2')
  assert.equal(dir2, path.join(tmp, '.moa', 'candidate-2'))

  // Path traversal attempts are blocked or sanitized
  const sanitized = resolveCandidateDir(tmp, '../../etc/passwd')
  assert.ok(sanitized.startsWith(path.join(tmp, '.moa')))
})

test('moa-test-gate: runCandidateTestGate handles empty params and missing dirs gracefully', async () => {
  const tmp = os.tmpdir()
  assert.equal(await runCandidateTestGate({ cwd: null, candidateIndex: 1, testCommand: 'npm test' }), null)
  assert.equal(await runCandidateTestGate({ cwd: tmp, candidateIndex: 1, testCommand: '' }), null)
  assert.equal(await runCandidateTestGate({ cwd: tmp, candidateIndex: 1, testCommand: '   ' }), null)

  // candidateDir does not exist
  const nonExistent = path.join(tmp, 'moa-test-nonexistent-' + Date.now())
  assert.equal(await runCandidateTestGate({ cwd: nonExistent, candidateIndex: 1, testCommand: 'npm test' }), null)
})

test('moa-test-gate: runCandidateTestGate executes command via execFn and real process', async () => {
  const testBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-test-gate-'))
  const candDir = path.join(testBase, '.moa', 'candidate-1')
  await fs.mkdir(candDir, { recursive: true })
  await fs.writeFile(path.join(candDir, 'solution.js'), 'export const answer = 42;', 'utf8')

  try {
    // 1. execFn mock pass
    const passRes = await runCandidateTestGate({
      cwd: testBase,
      candidateIndex: 1,
      testCommand: 'npm test',
      execFn: async ({ command }) => ({ exitCode: 0, stdout: 'All 10 tests passed', stderr: '' }),
    })
    assert.equal(passRes.passed, true)
    assert.equal(passRes.exitCode, 0)
    assert.ok(passRes.summary.includes('PASS'))
    assert.ok(passRes.output.includes('All 10 tests passed'))

    // 2. execFn mock fail
    const failRes = await runCandidateTestGate({
      cwd: testBase,
      candidateIndex: 1,
      testCommand: 'npm test',
      execFn: async () => ({ exitCode: 1, stdout: '', stderr: 'AssertionError: expected 42 to equal 43' }),
    })
    assert.equal(failRes.passed, false)
    assert.equal(failRes.exitCode, 1)
    assert.ok(failRes.summary.includes('FAIL'))
    assert.ok(failRes.output.includes('AssertionError'))

    // 3. Real Node process pass
    const realPass = await runCandidateTestGate({
      cwd: testBase,
      candidateIndex: 1,
      testCommand: 'node -e "console.log(\'SUCCESS\'); process.exit(0)"',
    })
    assert.equal(realPass.passed, true)
    assert.equal(realPass.exitCode, 0)
    assert.ok(realPass.output.includes('SUCCESS'))

    // 4. Real Node process fail
    const realFail = await runCandidateTestGate({
      cwd: testBase,
      candidateIndex: 1,
      testCommand: 'node -e "console.error(\'FAIL_BOOM\'); process.exit(2)"',
    })
    assert.equal(realFail.passed, false)
    assert.equal(realFail.exitCode, 2)
    assert.ok(realFail.output.includes('FAIL_BOOM'))
  } finally {
    await fs.rm(testBase, { recursive: true, force: true })
  }
})

test('moa-test-gate: ephemeral staging overlay copies baseDir and overlays candidateDir', async () => {
  const testBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-stage-test-'))
  await fs.writeFile(path.join(testBase, 'package.json'), JSON.stringify({ name: 'test-app' }), 'utf8')
  await fs.writeFile(path.join(testBase, 'existing.js'), 'console.log("base")', 'utf8')

  const candDir = path.join(testBase, '.moa', 'candidate-1')
  await fs.mkdir(candDir, { recursive: true })
  await fs.writeFile(path.join(candDir, 'modified.js'), 'console.log("cand")', 'utf8')

  try {
    let capturedStageDir = null
    let capturedFiles = []

    await runCandidateTestGate({
      cwd: testBase,
      candidateIndex: 1,
      testCommand: 'npm test',
      execFn: async ({ cwd }) => {
        capturedStageDir = cwd
        capturedFiles = await fs.readdir(cwd)
        return { exitCode: 0, stdout: 'ok', stderr: '' }
      },
    })

    assert.ok(capturedStageDir.includes('moa-test-stage-1'))
    assert.ok(capturedFiles.includes('package.json'))
    assert.ok(capturedFiles.includes('existing.js'))
    assert.ok(capturedFiles.includes('modified.js'))

    // Ephemeral staging directory is cleaned up after execution
    assert.equal(fsSync.existsSync(capturedStageDir), false)
    // Candidate workspace remains pristine with only modified.js
    const candFiles = await fs.readdir(candDir)
    assert.deepEqual(candFiles, ['modified.js'])
  } finally {
    await fs.rm(testBase, { recursive: true, force: true })
  }
})

test('moa-test-gate: executeTestGateForCandidates runs test gate on all candidates with files', async () => {
  const testBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-multi-gate-'))
  const cand1 = path.join(testBase, '.moa', 'candidate-1')
  const cand2 = path.join(testBase, '.moa', 'candidate-2')
  await fs.mkdir(cand1, { recursive: true })
  await fs.mkdir(cand2, { recursive: true })
  await fs.writeFile(path.join(cand1, 'a.js'), 'a', 'utf8')
  await fs.writeFile(path.join(cand2, 'b.js'), 'b', 'utf8')

  const referenceOutputs = [
    { ok: true, index: 1, label: 'Model A', files: [{ relativePath: 'a.js' }] },
    { ok: true, index: 2, label: 'Model B', files: [{ relativePath: 'b.js' }] },
    { ok: false, index: 3, label: 'Model C', files: [] }, // failed ref, skipped
  ]

  const progressEvents = []
  const onProgress = (msg) => progressEvents.push(msg)

  try {
    const results = await executeTestGateForCandidates({
      cwd: testBase,
      referenceOutputs,
      preset: { test_gate_enabled: true, test_command: 'npm test' },
      options: {
        execFn: async ({ candidateDir }) => {
          if (candidateDir.includes('candidate-1')) {
            return { exitCode: 0, stdout: '10/10 PASS', stderr: '' }
          }
          return { exitCode: 1, stdout: '', stderr: '2 tests failed' }
        },
      },
      onProgress,
    })

    assert.equal(results.length, 2)
    assert.equal(referenceOutputs[0].testResult.passed, true)
    assert.equal(referenceOutputs[1].testResult.passed, false)

    // Progress reported for both candidates
    assert.ok(progressEvents.some((p) => p.includes('Candidate 1: ✅')))
    assert.ok(progressEvents.some((p) => p.includes('Candidate 2: ❌')))
  } finally {
    await fs.rm(testBase, { recursive: true, force: true })
  }
})

test('moa-test-gate: prompts and history integrate test gate results', () => {
  const refs = [
    {
      ok: true,
      index: 1,
      label: 'Model A',
      text: 'Candidate 1 code',
      files: [{ relativePath: 'a.js' }],
      testResult: { passed: true, exitCode: 0, durationMs: 120, summary: 'PASS (120ms)', output: 'All tests pass' },
    },
    {
      ok: true,
      index: 2,
      label: 'Model B',
      text: 'Candidate 2 code',
      files: [{ relativePath: 'b.js' }],
      testResult: { passed: false, exitCode: 1, durationMs: 95, summary: 'FAIL (code 1, 95ms)', output: 'Error in test' },
    },
  ]

  // Standard judge prompt
  const judgePrompt = buildSynthesisPrompt('Fix the bug', refs, '')
  assert.ok(judgePrompt.includes(TEST_GATE_DIRECTIVE))
  assert.ok(judgePrompt.includes('[🧪 Test Gate: PASS (120ms)]'))
  assert.ok(judgePrompt.includes('[🧪 Test Gate: FAIL (code 1, 95ms)]'))
  assert.ok(judgePrompt.includes('PASSED ✅'))
  assert.ok(judgePrompt.includes('FAILED ❌'))

  // Curator synthesis prompt
  const curatorPrompt = buildCuratorSynthesisPrompt('Fix the bug', refs, '')
  assert.ok(curatorPrompt.includes(TEST_GATE_DIRECTIVE))
  assert.ok(curatorPrompt.includes('[🧪 Test Gate: PASS (120ms)]'))

  // History serialization
  const historyCandidates = candidatesForHistory(refs)
  assert.equal(historyCandidates.length, 2)
  assert.deepEqual(historyCandidates[0].testResult, {
    passed: true,
    exitCode: 0,
    durationMs: 120,
    summary: 'PASS (120ms)',
  })
  assert.equal(historyCandidates[1].testResult.passed, false)
})

test('moa-test-gate: runMoAPipeline runs test execution gate and passes results to judge', async () => {
  const testBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-pipeline-gate-'))
  let judgePromptSeen = ''

  const mockCallLlm = async (opts) => {
    // Proposer 1
    if (opts.model === 'm1') {
      return 'Here is solution 1:\n```js file=app.js\nconsole.log(1)\n```'
    }
    // Proposer 2
    if (opts.model === 'm2') {
      return 'Here is solution 2:\n```js file=app.js\nconsole.log(2)\n```'
    }
    // Judge
    if (opts.model === 'judge-m') {
      judgePromptSeen = opts.messages[0].content
      return '### 1. ⚖️ Judge verdict\nWinner: Candidate 1\nWINNER_CANDIDATE_INDEX: 1\nReason: Passed tests.\n\n### 2. 📁 Project files created\n- app.js\n\n### 3. 🚀 How to run\nnode app.js'
    }
    return ''
  }

  const preset = {
    name: 'test-preset',
    test_gate_enabled: true,
    test_command: 'npm test',
    ask_clarifying_questions: false,
    reference_models: [
      { provider: 'p1', model: 'm1' },
      { provider: 'p2', model: 'm2' },
    ],
    aggregator: { provider: 'judge-p', model: 'judge-m' },
  }

  try {
    const res = await runMoAPipeline({
      userPrompt: 'Implement app',
      preset,
      callLlm: mockCallLlm,
      cwd: testBase,
      execFn: async ({ candidateDir }) => {
        if (candidateDir.includes('candidate-1')) {
          return { exitCode: 0, stdout: 'Tests: 5 passed', stderr: '' }
        }
        return { exitCode: 1, stdout: '', stderr: 'Tests: 1 failed' }
      },
    })

    assert.equal(res.kind, 'synthesis')
    assert.equal(res.winningIndex, 1)
    assert.ok(judgePromptSeen.includes(TEST_GATE_DIRECTIVE))
    assert.ok(judgePromptSeen.includes('Tests: 5 passed'))
    assert.ok(judgePromptSeen.includes('Tests: 1 failed'))
    assert.equal(res.references[0].testResult.passed, true)
    assert.equal(res.references[1].testResult.passed, false)
  } finally {
    await fs.rm(testBase, { recursive: true, force: true })
  }
})