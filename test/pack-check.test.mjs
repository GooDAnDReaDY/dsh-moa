import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BLOCK_LIMIT,
  WARN_LIMIT,
  checkRootTarballs,
  evaluatePackedFiles,
  runPackCheck,
} from '../scripts/pack-check.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

test('pack-check: checkRootTarballs detects stray *.tgz files in checkout root', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pack-check-'))
  try {
    assert.deepEqual(checkRootTarballs(tmpDir), [])
    fs.writeFileSync(path.join(tmpDir, 'goodandready-dsh-moa-0.2.88.tgz'), 'tarball')
    assert.deepEqual(checkRootTarballs(tmpDir), ['goodandready-dsh-moa-0.2.88.tgz'])
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('pack-check: evaluatePackedFiles enforces WARN (>= 256000) and FAIL (> 262144) thresholds', () => {
  const okRes = evaluatePackedFiles([{ path: 'lib/client.js', size: WARN_LIMIT - 1 }])
  assert.deepEqual(okRes.warnings, [])
  assert.deepEqual(okRes.errors, [])

  const warnRes = evaluatePackedFiles([{ path: 'lib/client.js', size: WARN_LIMIT }])
  assert.equal(warnRes.warnings.length, 1)
  assert.deepEqual(warnRes.errors, [])

  const failRes = evaluatePackedFiles([{ path: 'lib/client.js', size: BLOCK_LIMIT + 1 }])
  assert.equal(failRes.errors.length, 1)
})

test('pack-check: current repository has no root tarballs and all packed files stay below WARN threshold', () => {
  const res = runPackCheck({ cwd: root })
  assert.ok(res.fileCount > 0)
  assert.deepEqual(res.warnings, [], `Expected zero >= ${WARN_LIMIT} B warnings, got: ${res.warnings.join('; ')}`)
})
