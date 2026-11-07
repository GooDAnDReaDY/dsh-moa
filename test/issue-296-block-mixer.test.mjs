import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCandidateBlocks,
  stitchCandidateBlocks,
  formatBlockMixerDirective
} from '../lib/pipeline/block-mixer.js'

test('Issue #296: parseCandidateBlocks decomposes text into discrete semantic blocks', () => {
  const sample = `# Title Section
Here is an introductory paragraph.

\`\`\`javascript
function add(a, b) {
  return a + b
}
\`\`\`

- Step 1: Initialize
- Step 2: Execute

Final concluding paragraph.`

  const blocks = parseCandidateBlocks(sample, 'ModelA')
  assert.equal(blocks.length >= 4, true)
  
  const heading = blocks.find((b) => b.type === 'heading')
  assert.ok(heading)
  assert.equal(heading.content, 'Title Section')
  assert.equal(heading.metadata.level, 1)

  const code = blocks.find((b) => b.type === 'code')
  assert.ok(code)
  assert.equal(code.metadata.lang, 'javascript')
  assert.ok(code.content.includes('function add'))

  const list = blocks.find((b) => b.type === 'list')
  assert.ok(list)
  assert.equal(list.metadata.itemCount, 2)
})

test('Issue #296: stitchCandidateBlocks assembles multi-candidate components', () => {
  const blocks = [
    { type: 'heading', content: 'Consensus Architecture', metadata: { level: 2 }, candidate: 'ModelA' },
    { type: 'code', content: 'export const config = { port: 8080 }', metadata: { lang: 'ts' }, candidate: 'ModelB' },
    { type: 'paragraph', content: 'Verified with security audit tests.', candidate: 'ModelC' }
  ]

  const result = stitchCandidateBlocks(blocks)
  assert.equal(result.ok, true)
  assert.equal(result.blockCount, 3)
  assert.deepEqual(result.sources.sort(), ['ModelA', 'ModelB', 'ModelC'])
  assert.ok(result.stitchedText.includes('## Consensus Architecture'))
  assert.ok(result.stitchedText.includes('```ts'))
  assert.ok(result.stitchedText.includes('export const config'))
})

test('Issue #296: formatBlockMixerDirective formats judge reconciliation prompt', () => {
  const stitched = {
    blockCount: 2,
    sources: ['ModelA', 'ModelB'],
    stitchedText: 'const x = 1\nconst y = 2'
  }

  const directive = formatBlockMixerDirective(stitched, 'Build unified payment handler')
  assert.ok(directive.includes('HUMAN OPERATOR COMPOSITE BLOCK MIXER'))
  assert.ok(directive.includes('ModelA, ModelB'))
  assert.ok(directive.includes('Build unified payment handler'))
})
