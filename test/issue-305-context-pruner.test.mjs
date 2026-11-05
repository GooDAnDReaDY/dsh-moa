import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateUnifiedDiff,
  shouldPruneFile,
  pruneCandidateOutput,
  pruneCandidateEnsemble,
  formatPruningDirective,
} from '../lib/pipeline/context-pruner.js'

test('generateUnifiedDiff: produces unified diff hunks with context', () => {
  const baseLines = []
  for (let i = 1; i <= 50; i++) baseLines.push(`line ${i}`)
  const oldText = baseLines.join('\n')

  const candLines = [...baseLines]
  candLines[24] = 'modified line 25'
  const newText = candLines.join('\n')

  const diff = generateUnifiedDiff(oldText, newText, { contextLines: 3, filePath: 'src/app.js' })
  assert.ok(diff.includes('--- a/src/app.js'))
  assert.ok(diff.includes('+++ b/src/app.js'))
  assert.ok(diff.includes('@@ -22,7 +22,7 @@'))
  assert.ok(diff.includes('-line 25'))
  assert.ok(diff.includes('+modified line 25'))
  assert.ok(diff.includes(' line 24'))
  assert.ok(diff.includes(' line 26'))
})

test('generateUnifiedDiff: returns empty string when texts are identical', () => {
  const diff = generateUnifiedDiff('hello world\nline 2', 'hello world\nline 2')
  assert.equal(diff, '')
})

test('shouldPruneFile: checks line threshold and change ratio', () => {
  const shortText = 'line 1\nline 2\nline 3'
  assert.equal(shouldPruneFile(shortText, 'line 1\nmodified 2\nline 3', { minLines: 20 }), false)

  const longLines = []
  for (let i = 1; i <= 60; i++) longLines.push(`line ${i}`)
  const longText = longLines.join('\n')

  const modified = [...longLines]
  modified[10] = 'new line 11'
  assert.equal(shouldPruneFile(longText, modified.join('\n'), { minLines: 20 }), true)

  // Total rewrite (> 65% changed) should not be pruned to unified diff
  const rewritten = longLines.map((l) => `rewritten ${l}`)
  assert.equal(shouldPruneFile(longText, rewritten.join('\n'), { minLines: 20, maxChangeRatio: 0.65 }), false)
})

test('pruneCandidateOutput: replaces full code fence with unified diff patch', () => {
  const baseLines = []
  for (let i = 1; i <= 60; i++) baseLines.push(`const val${i} = ${i};`)
  const baseFile = baseLines.join('\n')

  const candLines = [...baseLines]
  candLines[30] = 'const val31 = 99999; // updated'
  const candFile = candLines.join('\n')

  const candidateText = `Here is my updated file:
\`\`\`javascript path="src/config.js"
${candFile}
\`\`\`
Hope this helps!`

  const baseFiles = { 'src/config.js': baseFile }
  const result = pruneCandidateOutput(candidateText, baseFiles, { contextLines: 3, minLines: 20 })

  assert.equal(result.prunedFiles.length, 1)
  assert.equal(result.prunedFiles[0], 'src/config.js')
  assert.ok(result.savedChars > 500)
  assert.ok(result.text.includes('```diff'))
  assert.ok(result.text.includes('// Unified diff patch for src/config.js'))
  assert.ok(result.text.includes('+const val31 = 99999; // updated'))
  assert.ok(!result.text.includes('const val60 = 60;'))
})

test('pruneCandidateEnsemble: calculates token savings across ensemble', () => {
  const baseLines = []
  for (let i = 1; i <= 50; i++) baseLines.push(`item ${i};`)
  const baseFile = baseLines.join('\n')

  const candidates = [
    {
      label: 'Candidate 1',
      text: `\`\`\`js path="app.js"\n${baseFile.replace('item 20;', 'item 20_v1;')}\n\`\`\``,
    },
    {
      label: 'Candidate 2',
      text: `\`\`\`js path="app.js"\n${baseFile.replace('item 20;', 'item 20_v2;')}\n\`\`\``,
    },
  ]

  const projectFiles = [{ path: 'app.js', content: baseFile }]
  const res = pruneCandidateEnsemble(candidates, projectFiles, { enabled: true, minLines: 20 })

  assert.equal(res.isPruned, true)
  assert.equal(res.prunedFiles.length, 1)
  assert.ok(res.totalSavedTokens > 50)
  assert.ok(res.candidates[0].text.includes('```diff'))
  assert.ok(res.candidates[1].text.includes('```diff'))
})

test('formatPruningDirective: creates notice for Judge synthesis prompt', () => {
  const notice = formatPruningDirective(['src/server.js', 'src/db.js'], 1200)
  assert.ok(notice.includes('Context Pruning Notice'))
  assert.ok(notice.includes('`src/server.js`'))
  assert.ok(notice.includes('`src/db.js`'))
})

