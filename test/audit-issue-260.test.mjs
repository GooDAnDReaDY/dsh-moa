import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import cp from 'node:child_process'
import {
  isSandboxEvasion,
  isOsSandboxAvailable,
  resolveTestCommand,
  buildPermOpts,
  generateFenceCode,
} from '../lib/moa-sandbox.js'
import { runCandidateTestGate } from '../lib/moa-test-gate.js'

test('#260: buildPermOpts omits --allow-child-process when hasOsSandbox is false', () => {
  const optsNoSandbox = buildPermOpts({
    allowedReads: ['/usr', '/tmp'],
    executionDir: '/tmp/exec',
    effectiveHome: '/tmp/home',
    fenceFile: '/tmp/exec/fence.cjs',
    hasOsSandbox: false,
  })
  assert.ok(!optsNoSandbox.includes('--allow-child-process'), 'Must strictly omit --allow-child-process without OS sandbox')
  assert.ok(optsNoSandbox.includes('--permission'), 'Must include --permission')
  assert.ok(optsNoSandbox.includes('--require /tmp/exec/fence.cjs'), 'Must include fence require')

  const optsWithSandbox = buildPermOpts({
    allowedReads: ['/usr', '/tmp'],
    executionDir: '/tmp/exec',
    effectiveHome: '/tmp/home',
    fenceFile: '/tmp/exec/fence.cjs',
    hasOsSandbox: true,
  })
  assert.ok(optsWithSandbox.includes('--allow-child-process'), 'May include --allow-child-process only when OS sandbox is active')
})

test('#260: resolveTestCommand maps npm test to scripts.test directly without child npm process', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-res-cmd-'))
  try {
    const pkg = {
      name: 'candidate-pkg',
      scripts: {
        test: 'node --test ./test/index.test.js',
      },
    }
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(pkg), 'utf8')

    assert.equal(
      resolveTestCommand({ testCommand: 'npm test', executionDir: tmpDir }),
      'node --test ./test/index.test.js'
    )
    assert.equal(
      resolveTestCommand({ testCommand: 'npm run test', executionDir: tmpDir }),
      'node --test ./test/index.test.js'
    )
    assert.equal(
      resolveTestCommand({ testCommand: 'pnpm test', executionDir: tmpDir }),
      'node --test ./test/index.test.js'
    )
    assert.equal(
      resolveTestCommand({ testCommand: 'npm test -- --grep issue', executionDir: tmpDir }),
      'node --test ./test/index.test.js --grep issue'
    )
    assert.equal(
      resolveTestCommand({ testCommand: 'node runner.js', executionDir: tmpDir }),
      'node runner.js'
    )
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('#260: isSandboxEvasion detects NODE_OPTIONS stripping and evasion vectors', () => {
  assert.ok(isSandboxEvasion('env -u NODE_OPTIONS node exploit.js'))
  assert.ok(isSandboxEvasion('env -i -u NODE_OPTIONS node exploit.js'))
  assert.ok(isSandboxEvasion('unset NODE_OPTIONS && node exploit.js'))
  assert.ok(isSandboxEvasion('export NODE_OPTIONS= && node exploit.js'))
  assert.ok(isSandboxEvasion('NODE_OPTIONS="" node exploit.js'))
  assert.ok(isSandboxEvasion('echo "aGVsbG8=" | base64 -d | sh'))
  assert.ok(isSandboxEvasion('sudo cat /etc/shadow'))
  assert.ok(isSandboxEvasion('chroot /tmp node exploit.js'))

  assert.equal(isSandboxEvasion('node --test test/*.test.js'), null)
  assert.equal(isSandboxEvasion('npm test'), null)
  assert.equal(isSandboxEvasion('vitest run'), null)
})

test('#260: candidate package.json with NODE_OPTIONS evasion is rejected before execution', async () => {
  const testBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-pkg-evasion-'))
  try {
    const candDir = path.join(testBase, '.moa', 'candidate-1')
    await fs.mkdir(candDir, { recursive: true })
    const evilPkg = {
      name: 'evil-candidate',
      scripts: {
        test: 'env -u NODE_OPTIONS node evil.js',
      },
    }
    await fs.writeFile(path.join(testBase, 'package.json'), JSON.stringify(evilPkg), 'utf8')
    await fs.writeFile(path.join(candDir, 'package.json'), JSON.stringify(evilPkg), 'utf8')

    const res = await runCandidateTestGate({
      cwd: testBase,
      candidateIndex: 1,
      testCommand: 'npm test',
    })

    assert.equal(res.passed, false)
    assert.equal(res.exitCode, 1)
    assert.ok(res.output.includes('contains attempts to bypass sandbox or strip security environment (NODE_OPTIONS)'))
  } finally {
    await fs.rm(testBase, { recursive: true, force: true })
  }
})

test('#260: PoC exploit — candidate spawning child_process with stripped NODE_OPTIONS is blocked', async () => {
  const testBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-exploit-260-'))
  const secretDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-secret-external-'))
  const secretFile = path.join(secretDir, 'secret-token.env')
  await fs.writeFile(secretFile, 'SUPER_SECRET_LEAK_TOKEN=moa_secret_12345', 'utf8')

  try {
    const candDir = path.join(testBase, '.moa', 'candidate-1')
    await fs.mkdir(candDir, { recursive: true })

    // PoC code matching Issue #260 description
    const exploitCode = `
      const cp = require('node:child_process');
      const fs = require('node:fs');
      try {
        const out = cp.spawnSync('env', ['-u', 'NODE_OPTIONS', 'node', '-e', 'console.log(process.env.NODE_OPTIONS)'], { encoding: 'utf8' });
        console.log('SPAWN_RESULT:', out.stdout, out.stderr);
      } catch (e) {
        console.error('SPAWN_ERROR:', e.message);
        process.exit(1);
      }
    `
    await fs.writeFile(path.join(candDir, 'exploit.cjs'), exploitCode, 'utf8')

    const res = await runCandidateTestGate({
      cwd: testBase,
      candidateIndex: 1,
      testCommand: 'node exploit.cjs',
    })

    // Must be blocked because without OS sandbox, child_process execution is forbidden
    assert.equal(res.passed, false, 'Exploit must not pass')
    assert.ok(
      res.output.includes('ERR_ACCESS_DENIED') || res.output.includes('Access denied'),
      'Output must indicate access denied: ' + res.output
    )
  } finally {
    await fs.rm(testBase, { recursive: true, force: true })
    await fs.rm(secretDir, { recursive: true, force: true })
  }
})

test('#260: direct fs access outside sandbox via readFileSync is blocked by fence or permission model', async () => {
  const testBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-fs-test-'))
  const secretDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-secret-fs-'))
  const secretFile = path.join(secretDir, 'secret-credentials.yaml')
  await fs.writeFile(secretFile, 'password: forbidden_vault_secret', 'utf8')

  try {
    const candDir = path.join(testBase, '.moa', 'candidate-1')
    await fs.mkdir(candDir, { recursive: true })

    const candScript = `
      const fs = require('node:fs');
      try {
        const content = fs.readFileSync(${JSON.stringify(secretFile)}, 'utf8');
        console.log('STOLEN_CONTENT:', content);
      } catch (err) {
        console.error('READ_FAILED:', err.message);
        process.exit(1);
      }
    `
    await fs.writeFile(path.join(candDir, 'leak.cjs'), candScript, 'utf8')

    const res = await runCandidateTestGate({
      cwd: testBase,
      candidateIndex: 1,
      testCommand: 'node leak.cjs',
    })

    assert.equal(res.passed, false, 'Leaking test must fail')
    assert.ok(!res.output.includes('forbidden_vault_secret'), 'Secret must not be in output')
    assert.ok(
      res.output.toLowerCase().includes('access denied') || res.output.includes('ERR_ACCESS_DENIED') || res.output.includes('READ_FAILED'),
      'Output must show access denied or read failed: ' + res.output
    )
  } finally {
    await fs.rm(testBase, { recursive: true, force: true })
    await fs.rm(secretDir, { recursive: true, force: true })
  }
})
