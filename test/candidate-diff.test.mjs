import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { computeLineDiff, readCandidateFiles, writeCandidateWorkspace } from '../lib/file-workspace.js'

test('computeLineDiff: accurately detects additions, removals, and identical lines', () => {
  const oldText = 'line1\nline2\nline3'
  const newText = 'line1\nline2_modified\nline3\nline4'

  const diff = computeLineDiff(oldText, newText)
  assert.ok(Array.isArray(diff), 'diff is an array')
  assert.equal(diff[0].type, 'same')
  assert.equal(diff[0].line, 'line1')

  const removed = diff.filter((d) => d.type === 'removed')
  const added = diff.filter((d) => d.type === 'added')

  assert.equal(removed.length, 1)
  assert.equal(removed[0].line, 'line2')

  assert.equal(added.length, 2)
  assert.equal(added[0].line, 'line2_modified')
  assert.equal(added[1].line, 'line4')
})

test('readCandidateFiles: correctly reads files from isolated candidate workspace with numeric and string targets', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-diff-test-'))
  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'index.html', content: '<h1>Candidate 1</h1>' },
      { relativePath: 'src/main.js', content: 'console.log(1)' },
    ])

    // Numeric target 1
    const filesNum = await readCandidateFiles(tmpDir, 1)
    assert.equal(filesNum.length, 2)
    assert.equal(filesNum[0].relativePath, 'index.html')
    assert.equal(filesNum[0].content, '<h1>Candidate 1</h1>')
    assert.equal(filesNum[1].relativePath, 'src/main.js')

    // String target '1' (as parsed from URL searchParams)
    const filesStr = await readCandidateFiles(tmpDir, '1')
    assert.equal(filesStr.length, 2)
    assert.equal(filesStr[0].relativePath, 'index.html')

    // Synthesis workspace target
    const synthDir = path.join(tmpDir, '.moa', 'curator-synthesis')
    await fs.mkdir(synthDir, { recursive: true })
    await fs.writeFile(path.join(synthDir, 'index.html'), '<h1>Synthesis</h1>', 'utf8')

    const filesSynth = await readCandidateFiles(tmpDir, 'curator-synthesis')
    assert.equal(filesSynth.length, 1)
    assert.equal(filesSynth[0].content, '<h1>Synthesis</h1>')

    const diff = computeLineDiff(filesNum[0].content, filesSynth[0].content)
    assert.ok(diff.some((d) => d.type === 'removed' && d.line === '<h1>Candidate 1</h1>'))
    assert.ok(diff.some((d) => d.type === 'added' && d.line === '<h1>Synthesis</h1>'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('client bundle includes CandidateDiffSection and diff controls', () => {
  const clientPath = path.resolve('lib/client.js')
  const content = fsSync.readFileSync(clientPath, 'utf8')
  assert.ok(content.includes('CandidateDiffSection'), 'client.js contains CandidateDiffSection')
  assert.ok(content.includes('moa-diff-controls'), 'client.js contains moa-diff-controls')
  assert.ok(content.includes('/dsh-moa/diff'), 'client.js fetches from /dsh-moa/diff')
})
