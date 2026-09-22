import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  extractFileBlocks,
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  cleanMoaWorkspaces,
  collectProjectContext,
  formatProjectContext,
  isRefinementTask,
} from '../lib/file-workspace.js'

test('extractFileBlocks: parses markdown blocks with file= attribute', () => {
  const md = `
Here is the code:
\`\`\`html file="index.html"
<!DOCTYPE html>
<html><body><h1>Calc</h1></body></html>
\`\`\`

And the styling:
\`\`\`css filepath=style.css
body { background: #111; color: #fff; }
\`\`\`
`
  const files = extractFileBlocks(md)
  assert.equal(files.length, 2)
  assert.equal(files[0].relativePath, 'index.html')
  assert.ok(files[0].content.includes('<h1>Calc</h1>'))
  assert.equal(files[1].relativePath, 'style.css')
  assert.ok(files[1].content.includes('background: #111'))
})

test('extractFileBlocks: parses headers like ### File: app.js', () => {
  const md = `
### File: app.js
\`\`\`javascript
console.log('started');
\`\`\`
`
  const files = extractFileBlocks(md)
  assert.equal(files.length, 1)
  assert.equal(files[0].relativePath, 'app.js')
  assert.ok(files[0].content.includes("console.log('started')"))
})

test('extractFileBlocks: fallback to single standalone block', () => {
  const md = `
\`\`\`html
<!DOCTYPE html>
<html><body>Calculator</body></html>
\`\`\`
`
  const files = extractFileBlocks(md)
  assert.equal(files.length, 1)
  assert.equal(files[0].relativePath, 'index.html')
  assert.ok(files[0].content.includes('Calculator'))
})

test('collectProjectContext & isRefinementTask: context reading and refinement detection', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-ctx-test-'))

  try {
    await fs.writeFile(path.join(tmpDir, 'index.html'), '<html><body>Hello</body></html>')
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'src', 'main.js'), 'console.log("main");')

    // Dotfiles, including .env and .env.* variants, must never be collected
    await fs.writeFile(path.join(tmpDir, '.env'), 'SECRET=1')
    await fs.writeFile(path.join(tmpDir, '.env.json'), '{"apiKey":"x"}')
    await fs.writeFile(path.join(tmpDir, '.env.yaml'), 'apiKey: secret')

    const ctx = await collectProjectContext(tmpDir, 4000)
    assert.equal(ctx.files.length, 2)
    assert.ok(ctx.files.some((f) => f.relativePath === 'index.html'))
    assert.ok(ctx.files.some((f) => f.relativePath === 'src/main.js'))
    assert.ok(!ctx.files.some((f) => f.relativePath.startsWith('.env')), 'dotfiles like .env.json must not be shipped to model providers')

    // Refinement checks
    assert.equal(isRefinementTask('добавь темную тему', ctx.files), true)
    assert.equal(isRefinementTask('fix color', ctx.files), true)
    assert.equal(isRefinementTask('change button style', ctx.files), true)
    assert.equal(isRefinementTask('сделай игру крестики нолики с нуля на react с полным стейтом', ctx.files), false)
    assert.equal(isRefinementTask('добавь темную тему', []), false)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('writeCandidateWorkspace & promoteCandidateWorkspace: isolate and promote winner', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-test-'))

  try {
    const candidate1Files = [
      { relativePath: 'index.html', content: '<h1>Candidate 1</h1>' },
      { relativePath: 'src/app.js', content: 'const ver = 1;' },
    ]
    const candidate2Files = [
      { relativePath: 'index.html', content: '<h1>Candidate 2 Winner</h1>' },
      { relativePath: 'src/app.js', content: 'const ver = 2;' },
      { relativePath: 'README.md', content: '# Readme' },
    ]

    // 1. Write candidates
    await writeCandidateWorkspace(tmpDir, 1, candidate1Files)
    await writeCandidateWorkspace(tmpDir, 2, candidate2Files)

    // Check candidate 1 exists in .moa/candidate-1
    const c1Html = await fs.readFile(path.join(tmpDir, '.moa', 'candidate-1', 'index.html'), 'utf8')
    assert.equal(c1Html, '<h1>Candidate 1</h1>')

    // Check candidate 2 exists in .moa/candidate-2
    const c2Html = await fs.readFile(path.join(tmpDir, '.moa', 'candidate-2', 'index.html'), 'utf8')
    assert.equal(c2Html, '<h1>Candidate 2 Winner</h1>')

    // 2. Promote candidate 2
    const promoted = await promoteCandidateWorkspace(tmpDir, 2)
    assert.equal(promoted.length, 3)
    assert.ok(promoted.includes('index.html'))
    assert.ok(promoted.includes('src/app.js'))
    assert.ok(promoted.includes('README.md'))

    // 3. Verify files now exist at root
    const rootHtml = await fs.readFile(path.join(tmpDir, 'index.html'), 'utf8')
    assert.equal(rootHtml, '<h1>Candidate 2 Winner</h1>')

    const rootApp = await fs.readFile(path.join(tmpDir, 'src', 'app.js'), 'utf8')
    assert.equal(rootApp, 'const ver = 2;')

    // 4. Verify .moa directory is removed
    const moaExists = await fs.stat(path.join(tmpDir, '.moa')).then(() => true).catch(() => false)
    assert.equal(moaExists, false)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('collectProjectContext & formatProjectContext: tracks and reports skippedFiles / skippedList (#74)', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-skipped-test-'))

  try {
    // 1. Regular file
    await fs.writeFile(path.join(tmpDir, 'valid.js'), 'console.log("hello world");')

    // 2. Oversized file (>100KB)
    const bigContent = 'x'.repeat(105000)
    await fs.writeFile(path.join(tmpDir, 'large-bundle.js'), bigContent)

    // Collect context with small budget to trigger budget limit on additional file
    await fs.writeFile(path.join(tmpDir, 'extra.js'), 'const a = 1;')

    const ctx = await collectProjectContext(tmpDir, 50)
    assert.ok(ctx.skippedFiles > 0, `Expected skippedFiles > 0, got ${ctx.skippedFiles}`)
    assert.ok(Array.isArray(ctx.skippedList), 'skippedList must be an array')
    assert.ok(ctx.skippedList.some((s) => s.includes('large-bundle.js')), 'oversized file must be in skippedList')

    // Format context with skipped files and verify warning banner is rendered
    const formatted = formatProjectContext(ctx.files, {
      skippedFiles: ctx.skippedFiles,
      skippedList: ctx.skippedList,
    })
    assert.ok(formatted.includes('⚠️ **Workspace Scan Notice:**'), 'warning banner must be present in formatted context')
    assert.ok(formatted.includes('large-bundle.js'), 'skipped list detail must be in warning banner')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
