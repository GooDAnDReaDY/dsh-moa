import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  isSafeRelativePath,
  assertPathContained,
  extractFileBlocks,
  writeCandidateWorkspace,
  readCandidateFiles,
  promoteCandidateWorkspace,
} from '../lib/file-workspace.js'

test('security: isSafeRelativePath strictly validates path safety', () => {
  // Safe paths
  assert.equal(isSafeRelativePath('index.js'), true)
  assert.equal(isSafeRelativePath('src/utils/math.js'), true)
  assert.equal(isSafeRelativePath('deep/nested/dir/file.txt'), true)

  // Traversal and unsafe paths
  assert.equal(isSafeRelativePath('../outside.js'), false)
  assert.equal(isSafeRelativePath('../../etc/passwd'), false)
  assert.equal(isSafeRelativePath('src/../../escape.js'), false)
  assert.equal(isSafeRelativePath('/etc/passwd'), false)
  assert.equal(isSafeRelativePath('/absolute/path'), false)
  assert.equal(isSafeRelativePath('\\windows\\path'), false)
  assert.equal(isSafeRelativePath('..'), false)
  assert.equal(isSafeRelativePath('.'), false)
  assert.equal(isSafeRelativePath(''), false)
  assert.equal(isSafeRelativePath(null), false)
  assert.equal(isSafeRelativePath(undefined), false)
  assert.equal(isSafeRelativePath({}), false)
})

test('security: assertPathContained blocks directory escape attempts', () => {
  const base = path.resolve(os.tmpdir(), 'moa-base-test')
  
  // Safe containment
  const safeChild = assertPathContained(base, 'sub/file.txt')
  assert.ok(safeChild.startsWith(base))

  // Escapes must throw
  assert.throws(
    () => assertPathContained(base, '../escaped.txt'),
    /Path traversal violation/
  )
  assert.throws(
    () => assertPathContained(base, '../../etc/shadow'),
    /Path traversal violation/
  )
})

test('security: extractFileBlocks filters out traversal paths from markdown blocks', () => {
  const markdown = `
Here is a file:
\`\`\`javascript file="../../malicious.js"
console.log("hacked");
\`\`\`

And a safe file:
\`\`\`javascript file="src/safe.js"
console.log("safe");
\`\`\`

And a header file traversal:
### File: ../../dangerous.py
\`\`\`python
print("bad")
\`\`\`
`
  const files = extractFileBlocks(markdown)
  assert.equal(files.length, 1)
  assert.equal(files[0].relativePath, 'src/safe.js')
  assert.match(files[0].content, /safe/)
})

test('security: writeCandidateWorkspace confines candidate writes to .moa directory', async () => {
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-sec-write-'))
  try {
    const candidateFiles = [
      { relativePath: 'src/app.js', content: 'console.log("app");' },
      { relativePath: '../../outside.txt', content: 'outside' },
      { relativePath: '../sibling.txt', content: 'sibling' },
    ]

    const written = await writeCandidateWorkspace(tmpBase, 1, candidateFiles)

    // Only src/app.js should be written
    assert.equal(written.length, 1)
    assert.equal(written[0].relativePath, 'src/app.js')

    // Confirm candidate file exists inside .moa/candidate-1
    const appStat = await fs.stat(path.join(tmpBase, '.moa', 'candidate-1', 'src', 'app.js'))
    assert.ok(appStat.isFile())

    // Confirm no files were written outside .moa
    const outsideExists = await fs.access(path.join(tmpBase, 'outside.txt')).then(() => true).catch(() => false)
    assert.equal(outsideExists, false)

    const siblingExists = await fs.access(path.join(tmpBase, '..', 'sibling.txt')).then(() => true).catch(() => false)
    assert.equal(siblingExists, false)
  } finally {
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => {})
  }
})

test('security: readCandidateFiles does not traverse outside candidate directory', async () => {
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-sec-read-'))
  try {
    const candDir = path.join(tmpBase, '.moa', 'candidate-1')
    await fs.mkdir(candDir, { recursive: true })
    await fs.writeFile(path.join(candDir, 'normal.txt'), 'content', 'utf8')

    // Normal read works
    const files = await readCandidateFiles(tmpBase, 1)
    assert.equal(files.length, 1)
    assert.equal(files[0].relativePath, 'normal.txt')

    // Traversal targets are sanitized and stay confined
    const traversalFiles = await readCandidateFiles(tmpBase, '../../etc')
    // Sanitized target strips slashes and dots -> 'etc' -> .moa/etc which doesn't exist
    assert.deepEqual(traversalFiles, [])
  } finally {
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => {})
  }
})
