import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractCodeBlocks,
  validateCodeBlockSyntax,
  validateCandidateSyntax,
  applySyntaxFilter,
  formatSyntaxDirective,
} from '../lib/pipeline/syntax-filter.js'

test('syntax-filter: extractCodeBlocks parses markdown fenced code blocks with and without language tags', () => {
  const markdown = 'Here is some code:\n```javascript\nconst x = 1;\nfunction test() { return x * 2; }\n```\nAnd some json:\n```json\n{ "valid": true }\n```\nAnd untagged:\n```\nraw text\n```\n'
  const blocks = extractCodeBlocks(markdown)
  assert.equal(blocks.length, 3)
  assert.equal(blocks[0].language, 'javascript')
  assert.ok(blocks[0].code.includes('const x = 1;'))
  assert.equal(blocks[1].language, 'json')
  assert.equal(blocks[2].language, '')
})

test('syntax-filter: validateCodeBlockSyntax verifies valid JS and catches invalid syntax', () => {
  const validJs = 'export default function add(a, b) { return a + b; }'
  const validRes = validateCodeBlockSyntax(validJs, 'js')
  assert.equal(validRes.valid, true)
  assert.equal(validRes.error, null)

  const invalidJs = 'function broken(a, b { return a +;'
  const invalidRes = validateCodeBlockSyntax(invalidJs, 'javascript')
  assert.equal(invalidRes.valid, false)
  assert.ok(invalidRes.error)
})

test('syntax-filter: validateCodeBlockSyntax verifies valid and invalid JSON', () => {
  const validJson = '{"name": "dsh-moa", "version": 1}'
  assert.equal(validateCodeBlockSyntax(validJson, 'json').valid, true)

  const invalidJson = '{"name": "dsh-moa", broken}'
  const res = validateCodeBlockSyntax(invalidJson, 'json')
  assert.equal(res.valid, false)
  assert.ok(res.error)
})

test('syntax-filter: validateCodeBlockSyntax verifies Python code syntax', () => {
  const validPy = 'def calculate(x, y):\n    if x > 0:\n        return x + y\n    return y\n'
  assert.equal(validateCodeBlockSyntax(validPy, 'python').valid, true)

  const invalidPy = 'def broken(x:'
  const res = validateCodeBlockSyntax(invalidPy, 'python')
  assert.equal(res.valid, false)
  assert.ok(res.error)
})

test('syntax-filter: validateCandidateSyntax checks both files and text blocks', () => {
  const candidateOk = {
    index: 1,
    label: 'model-ok',
    text: 'Code: \n```js\nconsole.log(123);\n```',
    files: [{ relativePath: 'src/index.js', content: 'const a = 10;' }],
  }
  const resOk = validateCandidateSyntax(candidateOk)
  assert.equal(resOk.valid, true)
  assert.equal(resOk.errors.length, 0)
  assert.equal(resOk.blocksCount, 2)

  const candidateFail = {
    index: 2,
    label: 'model-fail',
    text: 'Code: \n```js\nconst a = ;\n```',
    files: [{ relativePath: 'src/index.js', content: 'const b = {' }],
  }
  const resFail = validateCandidateSyntax(candidateFail)
  assert.equal(resFail.valid, false)
  assert.ok(resFail.errors.length >= 1)
})

test('syntax-filter: applySyntaxFilter disqualifies broken candidate when valid candidate exists', () => {
  const candidates = [
    { index: 1, label: 'cand-1', text: '```js\nconst ok = true;\n```', files: [] },
    { index: 2, label: 'cand-2', text: '```js\nconst broken = ;\n```', files: [] },
  ]
  const result = applySyntaxFilter(candidates, { enabled: true })
  assert.equal(result.filterApplied, true)
  assert.equal(result.validCandidates.length, 1)
  assert.equal(result.invalidCandidates.length, 1)
  assert.equal(result.validCandidates[0].label, 'cand-1')
  assert.equal(result.invalidCandidates[0].disqualified, true)
})

test('syntax-filter: formatSyntaxDirective creates informative report for judge', () => {
  const candidates = [
    { index: 1, label: 'model-a', syntaxValidation: { valid: true, blocksCount: 2, validCount: 2, errors: [] } },
    { index: 2, label: 'model-b', syntaxValidation: { valid: false, blocksCount: 1, validCount: 0, errors: ['Unexpected token ;'] } },
  ]
  const directive = formatSyntaxDirective(candidates)
  assert.ok(directive.includes('**model-a**: PASSED'))
  assert.ok(directive.includes('**model-b**: FAILED'))
  assert.ok(directive.includes('Unexpected token ;'))
})

