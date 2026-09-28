import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSafeWriteRequest,
  isTrustedUpdateRequest,
  isLoopback,
  isNewerVersion,
  readLockPid,
  isPidAlive,
  checkAndCleanLock,
  installExact,
  registerPluginUpdater,
} from '../lib/updater.js'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('updater: isLoopback recognizes local addresses', () => {
  assert.equal(isLoopback('127.0.0.1'), true)
  assert.equal(isLoopback('localhost'), true)
  assert.equal(isLoopback('::1'), true)
  assert.equal(isLoopback('192.168.1.111'), false)
  assert.equal(isLoopback('example.com'), false)
})

test('updater: isNewerVersion correctly compares semver', () => {
  assert.equal(isNewerVersion('0.2.15', '0.2.16'), true)
  assert.equal(isNewerVersion('0.2.15', '0.2.15'), false)
  assert.equal(isNewerVersion('0.2.16', '0.2.15'), false)
  assert.equal(isNewerVersion('0.2.15', '0.3.0'), true)
  assert.equal(isNewerVersion('0.2.15', '1.0.0'), true)
})

test('updater: isTrustedUpdateRequest validates local update invocation', () => {
  const validReq = {
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1:3000',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(validReq), true)

  const untrustedReq = {
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'cross-site',
      origin: 'http://evil.com',
      host: '127.0.0.1:3000',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(untrustedReq), false)

  const missingHeaderReq = {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(missingHeaderReq), false)
})

test('updater: isSafeWriteRequest blocks cross-site write requests', () => {
  assert.equal(isSafeWriteRequest({
    headers: { 'sec-fetch-site': 'cross-site' },
  }), false)

  assert.equal(isSafeWriteRequest({
    headers: {
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1:3000',
    },
  }), true)

  assert.equal(isSafeWriteRequest({
    headers: {
      'sec-fetch-site': 'same-origin',
      origin: 'http://evil.com',
      host: '127.0.0.1:3000',
    },
  }), false)

  // Standard same-origin or tool invocation without origin headers
  assert.equal(isSafeWriteRequest({
    headers: {},
  }), true)
})

test('updater: does NOT include --config.minimumReleaseAge=0 per ecosystem quarantine policy', async () => {
  const fs = await import('node:fs/promises')
  const updaterSrc = await fs.readFile(new URL('../lib/updater.js', import.meta.url), 'utf8')
  assert.equal(updaterSrc.includes('--config.minimumReleaseAge=0'), false, 'Forbidden flag --config.minimumReleaseAge=0 found in updater.js')
})

test('updater: client.js includes one-click card integration (updateAvailable, latestVersion, api/dsh-moa/update)', async () => {
  const fs = await import('node:fs/promises')
  const clientSrc = await fs.readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.equal(clientSrc.includes('updateAvailable'), true, 'updateAvailable missing from client.js')
  assert.equal(clientSrc.includes('latestVersion'), true, 'latestVersion missing from client.js')
  assert.equal(clientSrc.includes('/api/dsh-moa/update'), true, '/api/dsh-moa/update endpoint missing from client.js')
  assert.equal(clientSrc.includes("'updater.title'"), true, 'updater.title missing from client.js')
  assert.equal(clientSrc.includes("'updater.btnUpdate'"), true, 'updater.btnUpdate missing from client.js')
})

test('updater: readLockPid extracts PID from json, numeric string, or regex', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'lock-test-'))
  try {
    const lockPath = join(tmp, 'package.json.lock')
    assert.equal(readLockPid(lockPath), undefined)

    writeFileSync(lockPath, JSON.stringify({ pid: 12345 }), 'utf8')
    assert.equal(readLockPid(lockPath), 12345)

    writeFileSync(lockPath, '54321\n', 'utf8')
    assert.equal(readLockPid(lockPath), 54321)

    writeFileSync(lockPath, 'invalid', 'utf8')
    assert.equal(readLockPid(lockPath), undefined)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('updater: isPidAlive returns true for current process and false for dead pid', () => {
  assert.equal(isPidAlive(process.pid), true)
  assert.equal(isPidAlive(9999999), false)
  assert.equal(isPidAlive(-1), false)
  assert.equal(isPidAlive(undefined), false)
})

test('updater: checkAndCleanLock cleans dead PID lock and retains live PID lock', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'lock-test-'))
  try {
    const lockPath = join(tmp, 'package.json.lock')

    // No lock
    assert.deepEqual(checkAndCleanLock(tmp), { locked: false })

    // Dead PID lock -> cleaned automatically
    writeFileSync(lockPath, JSON.stringify({ pid: 9999999 }), 'utf8')
    assert.equal(existsSync(lockPath), true)
    const deadCheck = checkAndCleanLock(tmp)
    assert.equal(deadCheck.locked, false)
    assert.equal(deadCheck.cleaned, true)
    assert.equal(existsSync(lockPath), false)

    // Live PID lock -> locked: true
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid }), 'utf8')
    assert.equal(existsSync(lockPath), true)
    const liveCheck = checkAndCleanLock(tmp)
    assert.equal(liveCheck.locked, true)
    assert.equal(liveCheck.pid, process.pid)
    assert.equal(existsSync(lockPath), true)

    // Matching childPid cleans lock even if alive
    const childCheck = checkAndCleanLock(tmp, process.pid)
    assert.equal(childCheck.locked, false)
    assert.equal(childCheck.cleaned, true)
    assert.equal(existsSync(lockPath), false)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('updater: installExact throws 409 ELOCKED if profile is locked by live PID', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'lock-test-'))
  try {
    const lockPath = join(tmp, 'package.json.lock')
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid }), 'utf8')

    await assert.rejects(
      installExact(
        { cliEntry: '/fake/dsh', profileName: 'test', profileDir: tmp },
        '@goodandready/dsh-moa@0.2.30'
      ),
      (err) => {
        assert.equal(err.status, 409)
        assert.equal(err.code, 'ELOCKED')
        return true
      }
    )
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('updater: installExact timeout cleans up lockfile and kills child', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'lock-test-'))
  const scriptPath = join(tmp, 'mock-cli.mjs')
  writeFileSync(scriptPath, `
    import { writeFileSync } from 'node:fs';
    writeFileSync('package.json.lock', JSON.stringify({ pid: process.pid }));
    setTimeout(() => {}, 60000);
  `, 'utf8')

  try {
    await assert.rejects(
      installExact(
        { cliEntry: scriptPath, profileName: 'test', profileDir: tmp },
        '@goodandready/dsh-moa@0.2.30',
        { timeoutMs: 150 }
      ),
      (err) => err.message.includes('timed out')
    )

    // Wait a brief tick for cleanup
    await new Promise((r) => setTimeout(r, 600))
    assert.equal(existsSync(join(tmp, 'package.json.lock')), false, 'package.json.lock must be removed after timeout')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('updater: registerPluginUpdater returns 409 when profile has live lock', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'lock-test-'))
  try {
    writeFileSync(join(tmp, 'package.json.lock'), JSON.stringify({ pid: process.pid }))
    let registeredHandler
    const mockCtx = {
      webServer: {
        register: ({ handler }) => { registeredHandler = handler },
      },
    }

    registerPluginUpdater(mockCtx, {
      endpoint: '/api/dsh-moa/update',
      packageName: '@goodandready/dsh-moa',
      manifestUrl: new URL('../package.json', import.meta.url),
    })

    const req = {
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        'x-dsh-plugin-update': '1',
        origin: 'http://127.0.0.1:3000',
        host: '127.0.0.1:3000',
        'sec-fetch-site': 'same-origin',
      },
    }
    let responseStatus
    let responseBody = ''
    const res = {
      writeHead: (status) => { responseStatus = status },
      end: (chunk) => { if (chunk) responseBody += chunk },
    }

    const origEnv = process.env.DSH_PROFILE_DIR
    process.env.DSH_PROFILE_DIR = tmp
    try {
      await registeredHandler(req, res)
      assert.equal(responseStatus, 409)
      assert.match(responseBody, /Another plugin installation is currently in progress/)
    } finally {
      process.env.DSH_PROFILE_DIR = origEnv
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
