import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  readCandidateFiles,
  cleanMoaWorkspaces,
  assertPathContained,
  resolveCandidateFolder,
} from '../lib/file-workspace.js'
import {
  runCandidateTestGate,
  getScrubbedEnv,
  executeTestGateForCandidates,
} from '../lib/moa-test-gate.js'

test('security (#159): assertPathContained blocks symlink escapes for files and directories', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-symlink-test-'))
  try {
    const workspace = path.join(tmpDir, 'workspace')
    const outside = path.join(tmpDir, 'outside')
    await fs.mkdir(workspace, { recursive: true })
    await fs.mkdir(outside, { recursive: true })
    await fs.writeFile(path.join(outside, 'secret.txt'), 'SUPER_SECRET', 'utf8')

    // 1. Regular file within workspace
    await fs.writeFile(path.join(workspace, 'safe.txt'), 'SAFE', 'utf8')
    assert.doesNotThrow(() => assertPathContained(workspace, 'safe.txt'))

    // 2. Symlink to outside file
    await fs.symlink(path.join(outside, 'secret.txt'), path.join(workspace, 'escape-file.txt'))
    assert.throws(
      () => assertPathContained(workspace, 'escape-file.txt'),
      /Path traversal violation: symlink "escape-file.txt" resolves outside/
    )

    // 3. Symlink to outside directory
    await fs.symlink(outside, path.join(workspace, 'escape-dir'))
    assert.throws(
      () => assertPathContained(workspace, 'escape-dir/secret.txt'),
      /Path traversal violation/
    )
    assert.throws(
      () => assertPathContained(workspace, 'escape-dir/new-file.txt'),
      /Path traversal violation/
    )
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('security (#159): writeCandidateWorkspace blocks writes through symlinks escaping workspace', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-symlink-write-'))
  try {
    const outside = path.join(tmpDir, 'outside')
    await fs.mkdir(outside, { recursive: true })

    // Plant a symlink inside .moa pointing outside
    const moaRoot = path.join(tmpDir, '.moa')
    await fs.mkdir(moaRoot, { recursive: true })
    await fs.symlink(outside, path.join(moaRoot, 'candidate-1'))

    let threw = false
    try {
      await writeCandidateWorkspace(tmpDir, 1, [
        { relativePath: 'exploit.txt', content: 'MALICIOUS_OVERWRITE' },
      ])
    } catch (err) {
      threw = true
      assert.ok(err.message.includes('Path traversal violation'))
    }
    assert.ok(threw, 'Should refuse to write into candidate dir that symlinks outside')
    assert.equal(fsSync.existsSync(path.join(outside, 'exploit.txt')), false)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('security (#159): readCandidateFiles and promoteCandidateWorkspace ignore / reject symlinks escaping boundaries', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-symlink-promote-'))
  try {
    const outside = path.join(tmpDir, 'outside')
    await fs.mkdir(outside, { recursive: true })
    await fs.writeFile(path.join(outside, 'target.txt'), 'INITIAL_OUTSIDE', 'utf8')

    // Write safe candidate
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'app.js', content: 'console.log("safe")' },
    ])

    // Plant a symlink inside candidate-1 pointing to outside
    const candDir = path.join(tmpDir, '.moa', 'candidate-1')
    await fs.symlink(path.join(outside, 'target.txt'), path.join(candDir, 'leaked.txt'))

    // readCandidateFiles must NOT return leaked.txt
    const files = await readCandidateFiles(tmpDir, 1)
    assert.equal(files.some((f) => f.relativePath === 'leaked.txt'), false)

    // Plant a symlink in base project pointing to outside
    await fs.symlink(path.join(outside, 'target.txt'), path.join(tmpDir, 'app.js'))

    // Promotion must refuse to write through external symlink or unlink it safely
    const promoted = await promoteCandidateWorkspace(tmpDir, 1, { force: true })
    assert.ok(promoted.includes('app.js'))
    // Outside file must remain untouched
    const outsideContent = await fs.readFile(path.join(outside, 'target.txt'), 'utf8')
    assert.equal(outsideContent, 'INITIAL_OUTSIDE')
    // Workspace app.js must now be the promoted regular file, NOT the symlink
    const stat = await fs.lstat(path.join(tmpDir, 'app.js'))
    assert.equal(stat.isSymbolicLink(), false)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('concurrency (#160): parallel runs with distinct runId do not collide or delete each other', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-concurrency-'))
  try {
    const runA = 'run-aaa-111'
    const runB = 'run-bbb-222'

    // Concurrent writes for candidate-1
    await Promise.all([
      writeCandidateWorkspace(tmpDir, 1, [{ relativePath: 'file.js', content: 'const winner = "A"' }], { runId: runA }),
      writeCandidateWorkspace(tmpDir, 1, [{ relativePath: 'file.js', content: 'const winner = "B"' }], { runId: runB }),
    ])

    // Verify disk isolation
    const filesA = await readCandidateFiles(tmpDir, 1, { runId: runA })
    const filesB = await readCandidateFiles(tmpDir, 1, { runId: runB })
    assert.equal(filesA[0].content, 'const winner = "A"')
    assert.equal(filesB[0].content, 'const winner = "B"')

    // Clean Run A should leave Run B intact
    await cleanMoaWorkspaces(tmpDir, { runId: runA })
    assert.equal(fsSync.existsSync(path.join(tmpDir, '.moa', runA)), false)
    assert.equal(fsSync.existsSync(path.join(tmpDir, '.moa', runB, 'candidate-1', 'file.js')), true)

    // Promote Run B into workspace
    await promoteCandidateWorkspace(tmpDir, 1, { runId: runB, force: true })
    const promotedContent = await fs.readFile(path.join(tmpDir, 'file.js'), 'utf8')
    assert.equal(promotedContent, 'const winner = "B"')
    assert.equal(fsSync.existsSync(path.join(tmpDir, '.moa', runB)), false)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('security (#161): getScrubbedEnv filters out sensitive tokens, secrets, and auth headers', () => {
  const oldEnv = { ...process.env }
  try {
    process.env.OPENAI_API_KEY = 'sk-proj-secret123'
    process.env.DEEPSEEK_API_KEY = 'sk-ds-secret456'
    process.env.GITEA_TOKEN = 'tok_secret789'
    process.env.HERMES_CONTROL_PANEL_TOKEN = 'hmt_secret000'
    process.env.DATABASE_PASSWORD = 'super_secret_pw'
    process.env.AWS_SECRET_ACCESS_KEY = 'aws_secret'
    process.env.SSH_AUTH_SOCK = '/tmp/ssh.sock'
    process.env.SAFE_CUSTOM_VAR = 'should_not_leak'
    process.env.NODE_ENV = 'production'
    process.env.LANG = 'en_US.UTF-8'

    const scrubbed = getScrubbedEnv({
      MOA_CANDIDATE_INDEX: '1',
      MOA_CANDIDATE_DIR: '/tmp/cand-1',
      MOA_BASE_DIR: '/tmp/base',
      MOA_RUN_ID: 'test-run-id',
    })

    assert.equal(scrubbed.OPENAI_API_KEY, undefined)
    assert.equal(scrubbed.DEEPSEEK_API_KEY, undefined)
    assert.equal(scrubbed.GITEA_TOKEN, undefined)
    assert.equal(scrubbed.HERMES_CONTROL_PANEL_TOKEN, undefined)
    assert.equal(scrubbed.DATABASE_PASSWORD, undefined)
    assert.equal(scrubbed.AWS_SECRET_ACCESS_KEY, undefined)
    assert.equal(scrubbed.SSH_AUTH_SOCK, undefined)
    assert.equal(scrubbed.SAFE_CUSTOM_VAR, undefined) // only allowlisted standard vars allowed

    assert.equal(scrubbed.NODE_ENV, 'production')
    assert.equal(scrubbed.LANG, 'en_US.UTF-8')
    assert.equal(scrubbed.MOA_CANDIDATE_INDEX, '1')
    assert.equal(scrubbed.MOA_CANDIDATE_DIR, '/tmp/cand-1')
    assert.equal(scrubbed.MOA_BASE_DIR, '/tmp/base')
    assert.equal(scrubbed.MOA_RUN_ID, 'test-run-id')
  } finally {
    process.env = oldEnv
  }
})

test('dependencies (#162): test gate staging preserves project ESM dependencies via node_modules symlink', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-esm-stage-'))
  try {
    // 1. Setup base project with an ESM dependency in node_modules
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'esm-project', type: 'module' }), 'utf8')
    const depDir = path.join(tmpDir, 'node_modules', 'audit-esm-dep')
    await fs.mkdir(depDir, { recursive: true })
    await fs.writeFile(
      path.join(depDir, 'package.json'),
      JSON.stringify({ name: 'audit-esm-dep', version: '1.0.0', type: 'module', main: 'index.js' }),
      'utf8'
    )
    await fs.writeFile(path.join(depDir, 'index.js'), 'export const status = "ESM_DEP_OK";\n', 'utf8')

    // 2. Write candidate solution importing bare ESM specifier
    await writeCandidateWorkspace(tmpDir, 1, [
      {
        relativePath: 'check.mjs',
        content: `import { status } from 'audit-esm-dep';\nconsole.log(status);\n`,
      },
    ])

    // 3. Run candidate test gate with node command
    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'node check.mjs',
      timeoutMs: 5000,
    })

    assert.ok(res, 'Test gate result should exist')
    assert.equal(res.passed, true, `Test gate should pass without ERR_MODULE_NOT_FOUND. Output: ${res.output}`)
    assert.ok(res.output.includes('ESM_DEP_OK'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('atomic snapshots (#188): candidate rewrite purges deleted files between versions and handles failure cleanly', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-atomic-rewrite-'))
  try {
    const runId = 'atomic-run'

    // Version 1: old.js + main.js
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'old.js', content: 'console.log("old")' },
      { relativePath: 'main.js', content: 'console.log("main v1")' },
    ], { runId })

    let filesV1 = await readCandidateFiles(tmpDir, 1, { runId })
    assert.deepStrictEqual(filesV1.map((f) => f.relativePath).sort(), ['main.js', 'old.js'])

    // Version 2: old.js deleted, new.js added
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'new.js', content: 'console.log("new")' },
      { relativePath: 'main.js', content: 'console.log("main v2")' },
    ], { runId })

    let filesV2 = await readCandidateFiles(tmpDir, 1, { runId })
    assert.deepStrictEqual(filesV2.map((f) => f.relativePath).sort(), ['main.js', 'new.js'])
    assert.equal(filesV2.some((f) => f.relativePath === 'old.js'), false, 'old.js must NOT remain after update')

    // Version 3: write attempt with invalid path fails cleanly and preserves Version 2
    let threw = false
    try {
      await writeCandidateWorkspace(tmpDir, 1, [
        { relativePath: '../escaped.js', content: 'evil' },
      ], { runId })
    } catch {
      threw = true
    }
    assert.ok(threw, 'Should throw on traversal path')

    // Candidate 1 must remain intact with Version 2
    let filesAfterError = await readCandidateFiles(tmpDir, 1, { runId })
    assert.deepStrictEqual(filesAfterError.map((f) => f.relativePath).sort(), ['main.js', 'new.js'])
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
