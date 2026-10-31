import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveContextLensService,
  parseModuleDeclarations,
  isValidJsAstSyntax,
  mergeCandidateAstFiles,
  buildAstCompositeMergeDirective,
} from '../lib/moa-ast-merge.js'
import { PresetSchema } from '../lib/moa-schema.js'
import { COMPANION_PLUGINS } from '../lib/moa-workbench.js'

test('issue #248: PresetSchema accepts ast_composite_merge_enabled and COMPANION_PLUGINS includes dsh-context-lens', () => {
  const parsed = PresetSchema({ name: 'ast-p', ast_composite_merge_enabled: true })
  assert.equal(parsed.ast_composite_merge_enabled, true)

  const ids = COMPANION_PLUGINS.map((p) => p.id)
  assert.ok(ids.includes('dsh-context-lens'))
})

test('issue #248: mergeCandidateAstFiles deduplicates imports and merges JSDoc and declarations without syntax collisions', async () => {
  const cand1 = {
    index: 1,
    label: 'p1:m1',
    ok: true,
    files: [
      {
        relativePath: 'src/math.js',
        content: `import { clamp } from './utils.js';\nexport function compute(x) {\n  return clamp(x * 2);\n}\n`,
      },
    ],
  }

  const cand2 = {
    index: 2,
    label: 'p2:m2',
    ok: true,
    files: [
      {
        relativePath: 'src/math.js',
        content: `import { clamp } from './utils.js';\nimport { log } from './logger.js';\n/**\n * Computes clamped value with logging.\n * @param {number} x\n */\nexport function compute(x) {\n  return clamp(x * 2);\n}\nexport function extraHelper(y) {\n  log(y);\n  return y + 1;\n}\n`,
      },
    ],
  }

  const merged = await mergeCandidateAstFiles([cand1, cand2])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].relativePath, 'src/math.js')

  const code = merged[0].content
  // Verify import ./utils.js appears only once (deduplicated)
  const importMatches = code.match(/from '\.\/utils\.js'/g) || []
  assert.equal(importMatches.length, 1)
  // Verify JSDoc from cand2 and extraHelper are preserved
  assert.ok(code.includes('@param {number} x'))
  assert.ok(code.includes('export function extraHelper'))
  assert.equal(isValidJsAstSyntax(code, 'src/math.js'), true)
})

test('issue #248: buildAstCompositeMergeDirective uses dsh-context-lens via ctx.reflect when available and degrades cleanly when absent', async () => {
  const mockContext = {
    reflect: {
      get(name) {
        if (name === 'contextLens') {
          return {
            async mergeAst({ versions }) {
              return versions.join('\n// merged by contextLens\n')
            },
          }
        }
        return null
      },
    },
  }

  const cands = [
    { index: 1, label: 'c1', ok: true, files: [{ relativePath: 'a.js', content: 'export const a = 1;\n' }] },
    { index: 2, label: 'c2', ok: true, files: [{ relativePath: 'a.js', content: 'export const b = 2;\n' }] },
  ]

  const resWithLens = await buildAstCompositeMergeDirective(cands, { ctx: mockContext })
  assert.equal(resWithLens.usedContextLens, true)
  assert.ok(resWithLens.directive.includes('merged by contextLens'))

  const resFallback = await buildAstCompositeMergeDirective(cands, { ctx: null })
  assert.equal(resFallback.usedContextLens, false)
  assert.ok(resFallback.directive.includes('AST-Level Semantic Composite Merge'))
})
