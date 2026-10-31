import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { renderClientBundle, OUT } from '../scripts/build-client.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

test('issue #276: renderClientBundle compiles client modules cleanly', () => {
  const result = renderClientBundle(root)
  assert.ok(result.code, 'bundle code must not be empty')
  assert.ok(result.fragmentCount >= 10, 'must include fragments from src/client')
  assert.ok(result.code.includes('@goodandready/dsh-moa'), 'must include package id')
  assert.ok(result.code.includes('SearchableModelPicker'), 'must include UI components')
})

test('issue #276: build-client enforces official DSH Store limit (256 KiB)', () => {
  const clientPath = path.join(root, OUT)
  assert.ok(fs.existsSync(clientPath), 'lib/client.js must exist')
  const stats = fs.statSync(clientPath)
  const MAX_LIMIT = 262144 // 256 KB
  assert.ok(
    stats.size <= MAX_LIMIT,
    `lib/client.js size (${stats.size} bytes) must not exceed 256 KiB limit (${MAX_LIMIT} bytes)`
  )
})

test('issue #276: scripts/build-client.mjs supports atomic write with --out flag', () => {
  const scriptPath = path.join(root, 'scripts', 'build-client.mjs')
  const tmpOut = path.join(os.tmpdir(), `dsh-moa-client-atomic-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)

  try {
    execFileSync(process.execPath, [scriptPath, '--out', tmpOut], { cwd: root, stdio: 'pipe' })
    assert.ok(fs.existsSync(tmpOut), 'custom output file created')
    const content = fs.readFileSync(tmpOut, 'utf8')
    assert.ok(content.length > 50000, 'assembled bundle has non-trivial size')
    assert.ok(!fs.existsSync(`${tmpOut}.tmp`), 'temporary file was cleaned up by atomic rename')
  } finally {
    try { fs.unlinkSync(tmpOut) } catch {}
  }
})

test('issue #276: scripts/build-client.mjs --check detects drift correctly', () => {
  const scriptPath = path.join(root, 'scripts', 'build-client.mjs')
  // Should succeed on current up-to-date repo
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, [scriptPath, '--check'], { cwd: root, stdio: 'pipe' })
  })

  // When pointed at a drifted file, must fail with exit code 1
  const tmpOut = path.join(os.tmpdir(), `dsh-moa-drift-${Date.now()}.js`)
  fs.writeFileSync(tmpOut, '// drifted content\n', 'utf8')
  try {
    assert.throws(() => {
      execFileSync(process.execPath, [scriptPath, '--check', '--out', tmpOut], { cwd: root, stdio: 'pipe' })
    })
  } finally {
    try { fs.unlinkSync(tmpOut) } catch {}
  }
})