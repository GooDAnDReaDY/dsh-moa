import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  getMoaLeaderboard,
  recordMoaRunAsync,
  invalidateHistoryCache,
  getMoaHistory,
} from '../lib/history.js'
import {
  computeLineDiff,
  isSafeRelativePath,
  assertPathContained,
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  readCandidateFiles,
} from '../lib/file-workspace.js'
import { runReferencesParallel } from '../lib/moa-candidates.js'

test('audit fix #91: in-memory leaderboard cache and cache invalidation', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-hist-cache-'))
  const histFile = path.join(tmpDir, 'history.jsonl')

  try {
    invalidateHistoryCache()

    // 1. Initial run
    await recordMoaRunAsync(
      {
        prompt: 'test prompt 1',
        preset: 'default',
        winnerModel: 'prov:m1',
        candidates: [{ provider: 'prov', model: 'm1' }],
      },
      histFile
    )

    const lb1 = getMoaLeaderboard(histFile)
    assert.strictEqual(lb1.totalRuns, 1)
    assert.strictEqual(lb1.models[0].wins, 1)

    // 2. Second call should return cached result
    const lb2 = getMoaLeaderboard(histFile)
    assert.strictEqual(lb2.totalRuns, 1)

    // 3. New record invalidates cache
    await recordMoaRunAsync(
      {
        prompt: 'test prompt 2',
        preset: 'default',
        winnerModel: 'prov:m1',
        candidates: [{ provider: 'prov', model: 'm1' }],
      },
      histFile
    )

    const lb3 = getMoaLeaderboard(histFile)
    assert.strictEqual(lb3.totalRuns, 2)
    assert.strictEqual(lb3.models[0].wins, 2)

    // 4. Test getMoaHistory pagination
    const history = getMoaHistory(10, 0, histFile)
    assert.strictEqual(history.runs.length, 2)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('audit fix #92: computeLineDiff handles large files (>2000 lines) with single-line edit via prefix/suffix trimming', () => {
  // Create 2500 lines
  const originalLines = []
  for (let i = 1; i <= 2500; i++) {
    originalLines.push(`line ${i}: const val = ${i};`)
  }
  const modifiedLines = [...originalLines]
  // Change only line 1250
  modifiedLines[1249] = 'line 1250: const val = 999999; // MODIFIED'

  const oldText = originalLines.join('\n')
  const newText = modifiedLines.join('\n')

  const t0 = Date.now()
  const diff = computeLineDiff(oldText, newText)
  const elapsed = Date.now() - t0

  assert.ok(elapsed < 200, `Diff calculation took ${elapsed}ms (must be < 200ms)`)

  const adds = diff.filter((d) => d.type === 'added')
  const dels = diff.filter((d) => d.type === 'removed')

  // Under old logic with >2000 fallback, it would report 2500 adds and 2500 dels!
  // Under new prefix/suffix trimming, it must report EXACTLY 1 add and 1 del!
  assert.strictEqual(adds.length, 1, `Expected 1 addition, got ${adds.length}`)
  assert.strictEqual(dels.length, 1, `Expected 1 deletion, got ${dels.length}`)
  assert.strictEqual(adds[0].line, 'line 1250: const val = 999999; // MODIFIED')
  assert.strictEqual(dels[0].line, 'line 1250: const val = 1250;')
})

test('audit fix #93: path traversal validation in workspace operations', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-security-'))

  try {
    // 1. isSafeRelativePath checks
    assert.strictEqual(isSafeRelativePath('../outside.js'), false)
    assert.strictEqual(isSafeRelativePath('../../etc/passwd'), false)
    assert.strictEqual(isSafeRelativePath('/absolute/path.js'), false)
    assert.strictEqual(isSafeRelativePath('src/utils/math.js'), true)
    assert.strictEqual(isSafeRelativePath('index.html'), true)

    // 2. assertPathContained checks
    assert.throws(() => {
      assertPathContained(tmpDir, '../../escaped.txt')
    }, /Path traversal violation/)

    // 3. writeCandidateWorkspace drops traversing paths
    const files = [
      { relativePath: 'valid.js', content: 'console.log("ok")' },
      { relativePath: '../../escaped.js', content: 'console.log("bad")' },
      { relativePath: '/root/bad.js', content: 'console.log("bad")' },
    ]
    const written = await writeCandidateWorkspace(tmpDir, 1, files)
    assert.strictEqual(written.length, 1)
    assert.strictEqual(written[0].relativePath, 'valid.js')

    // 4. readCandidateFiles ignores traversing targets
    const read = await readCandidateFiles(tmpDir, '../../etc')
    assert.deepStrictEqual(read, [])

    // 5. promoteCandidateWorkspace is safe
    const promoted = await promoteCandidateWorkspace(tmpDir, 1)
    assert.deepStrictEqual(promoted, ['valid.js'])
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('audit fix #94: candidate model timeout in runReferencesParallel immediately aborts in-flight request', async () => {
  let signalAborted = false
  const mockCallLlm = async (args) => {
    // Listen for abort signal
    args.signal.addEventListener('abort', () => {
      signalAborted = true
    })
    // Simulate slow LLM call
    await new Promise((resolve) => setTimeout(resolve, 500))
    return 'response'
  }

  const references = [{ provider: 'test', model: 'slow-model' }]
  const messages = [{ role: 'user', content: 'hello' }]

  // Short timeout of 50ms
  const results = await runReferencesParallel(references, messages, { timeoutMs: 50 }, mockCallLlm)

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].ok, false)
  assert.ok(results[0].error.includes('Timeout'))
  assert.strictEqual(signalAborted, true, 'AbortSignal must have been triggered on timeout')
})

test('audit fix #95: client bundle contains reactive leaderboardPresetFilter effect', async () => {
  const clientPath = path.resolve('lib/client.js')
  const code = await fs.readFile(clientPath, 'utf8')

  assert.ok(
    code.includes('leaderboardPresetFilter'),
    'client.js must include leaderboardPresetFilter state'
  )
  assert.ok(
    code.includes('[leaderboardPresetFilter]'),
    'client.js must include reactive useEffect dependency on leaderboardPresetFilter'
  )
})
