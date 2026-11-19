import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { isHostAbsolutePath, scanPathTokensForLeak, generateFenceCode } from '../lib/moa-sandbox.js'

test('Issue #364: isHostAbsolutePath classifies filesystem paths independently of host platform', () => {
  // Windows drive paths are always host filesystem paths
  assert.equal(isHostAbsolutePath('C:\\Users\\testuser\\secrets.txt'), true)
  assert.equal(isHostAbsolutePath('C:/temp/build.log'), true)
  assert.equal(isHostAbsolutePath('d:\\x'), true)

  // POSIX paths rooted at known system directories are host filesystem paths
  assert.equal(isHostAbsolutePath('/etc/passwd'), true)
  assert.equal(isHostAbsolutePath('/home/user/.ssh/id_rsa'), true)
  assert.equal(isHostAbsolutePath('/root/.npmrc'), true)
  assert.equal(isHostAbsolutePath('/var/log/app.log'), true)
  assert.equal(isHostAbsolutePath('/Users/testuser/notes.txt'), true)

  // A bare leading slash is NOT enough: route literals are not filesystem paths
  assert.equal(isHostAbsolutePath('/health'), false)
  assert.equal(isHostAbsolutePath('/users/me'), false)
  assert.equal(isHostAbsolutePath('/api/v1/runs'), false)
  assert.equal(isHostAbsolutePath('/run/user'), false)

  // Relative workspace paths and traversal markers are not absolute paths
  assert.equal(isHostAbsolutePath('src/auth.ts'), false)
  assert.equal(isHostAbsolutePath('../outside'), false)
  assert.equal(isHostAbsolutePath(''), false)
  assert.equal(isHostAbsolutePath(null), false)
})

test('Issue #364: scanPathTokensForLeak does not flag safe HTTP route literals on any platform', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-issue-364-'))
  try {
    const script = `
      const res1 = await fetch('http://127.0.0.1:3080/health')
      router.get('/users/me', handler)
      app.post('/api/v1/runs', createRun)
      const base = '/run/job'
      const decoded = Buffer.from(payload, 'base64').toString('utf8')
    `
    assert.equal(scanPathTokensForLeak(script, [tmpDir], tmpDir), null)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('Issue #364: scanPathTokensForLeak still blocks host filesystem escapes on any platform', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-issue-364-'))
  try {
    // POSIX system roots outside the sandbox
    assert.equal(scanPathTokensForLeak("readFile('/home/user/.ssh/id_rsa')", [tmpDir], tmpDir), '/home/user/.ssh/id_rsa')
    assert.equal(scanPathTokensForLeak("fs.readFileSync('/root/.npmrc')", [tmpDir], tmpDir), '/root/.npmrc')
    // Account and credential system files never pass the safe-dirs whitelist (#364)
    assert.equal(scanPathTokensForLeak("fs.readFile('/etc/passwd')", [tmpDir], tmpDir), '/etc/passwd')
    assert.equal(scanPathTokensForLeak("fs.readFile('/etc/shadow')", [tmpDir], tmpDir), '/etc/shadow')
    // Windows drive paths are host paths via isHostAbsolutePath; the scanner
    // blocks them where the OS resolves them as drive paths (win32). On POSIX
    // the same token is just a sandbox-relative filename and stays allowed.
    const winPathText = "fs.readFileSync('C:\\Users\\testuser\\secrets.txt')"
    assert.equal(isHostAbsolutePath('C:\\Users\\testuser\\secrets.txt'), true)
    if (process.platform === 'win32') {
      assert.notEqual(scanPathTokensForLeak(winPathText, [tmpDir], tmpDir), null)
    } else {
      assert.equal(scanPathTokensForLeak(winPathText, [tmpDir], tmpDir), null)
    }
    // Traversal outside the allowed root is still blocked
    assert.equal(scanPathTokensForLeak("fs.readFileSync('../../outside/secret')", [tmpDir], tmpDir), '../../outside/secret')
    // Non-sensitive safe system dirs remain allowed (no false positives)
    assert.equal(scanPathTokensForLeak("spawn('/usr/bin/node', ['app.js'])", [tmpDir], tmpDir), null)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('Issue #364: generated fence code uses isHostAbsolutePath instead of platform checks', () => {
  const code = generateFenceCode({ allowedReads: ['/tmp/x'], hasOsSandbox: false })
  assert.match(code, /function isHostAbsolutePath/)
  assert.doesNotMatch(code, /process\.platform/)
})
