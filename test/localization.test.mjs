import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { formatMoAResponse } from '../lib/moa-parser.js'
import { isRefinementTask } from '../lib/file-workspace.js'
import { isBroadPromptRequiringQuestions } from '../lib/moa-prompts.js'

test('localization: lib/client.js defines full zh dictionary with complete key parity to en', () => {
  const clientPath = path.resolve('lib/client.js')
  const clientContent = fs.readFileSync(clientPath, 'utf-8')

  // Extract en dict
  const enMatch = /const en = \{([\s\S]*?)\n    \}/.exec(clientContent)
  assert.ok(enMatch, 'Must find en dictionary in lib/client.js')
  const enKeys = [...enMatch[1].matchAll(/['"]([a-zA-Z0-9_.-]+)['"]\s*:/g)].map((m) => m[1])
  assert.ok(enKeys.length >= 40, `en dictionary must have >= 40 keys (found ${enKeys.length})`)

  // Extract zh dict
  const zhMatch = /const zh = \{([\s\S]*?)\n    \}/.exec(clientContent)
  assert.ok(zhMatch, 'Must find zh dictionary in lib/client.js')
  const zhKeys = [...zhMatch[1].matchAll(/['"]([a-zA-Z0-9_.-]+)['"]\s*:/g)].map((m) => m[1])

  // Verify all en keys exist in zh
  const missingInZh = enKeys.filter((k) => !zhKeys.includes(k))
  assert.deepEqual(missingInZh, [], 'All keys in en must exist in zh dictionary')

  // Verify registration in exports.apply
  assert.ok(clientContent.includes("addLocale('en', en)"))
  assert.ok(clientContent.includes("addLocale('zh', zh)"))
})

test('formatMoAResponse: renders canonical English output', () => {
  const moaResult = {
    kind: 'synthesis',
    content: 'All done',
    aggregator: 'codex:gpt-5.6-sol',
    winningIndex: 1,
    liveCanvas: { previewUrl: 'http://127.0.0.1:3080/sandbox', title: 'Dashboard' },
    references: [
      { label: 'prov1:model-a', ok: true, text: 'Code here', files: [{ relativePath: 'index.html' }, { relativePath: 'style.css' }] },
    ],
  }

  const output = formatMoAResponse({ moaResult, presetName: 'default' })
  assert.ok(output.includes('[🚀 Open Dashboard in Live Canvas]'))
  assert.ok(output.includes('[↗ Open in new tab]'))
  assert.ok(output.includes('(2 files)'))
  assert.ok(!output.includes('файл(ов)'))
  assert.ok(!output.includes('Открыть'))
})

test('isRefinementTask & isBroadPromptRequiringQuestions: support English and Chinese triggers', () => {
  // Chinese refinement
  assert.equal(isRefinementTask('添加暗黑模式样式', [{ relativePath: 'app.js' }]), true)
  assert.equal(isRefinementTask('从头开始创建项目', [{ relativePath: 'app.js' }]), false)

  // English refinement
  assert.equal(isRefinementTask('add dark mode to header', [{ relativePath: 'app.js' }]), true)
  assert.equal(isRefinementTask('from scratch build a new game', [{ relativePath: 'app.js' }]), false)

  // Chinese broad prompt
  assert.equal(isBroadPromptRequiringQuestions('创建一个在线商店应用', []), true)
  assert.equal(isBroadPromptRequiringQuestions('好', []), false)

  // English broad prompt
  assert.equal(isBroadPromptRequiringQuestions('build a web application', []), true)
  assert.equal(isBroadPromptRequiringQuestions('yes', []), false)
})
