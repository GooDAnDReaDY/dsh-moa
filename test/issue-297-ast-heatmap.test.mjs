import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeLineStructure,
  scoreToStatus,
  computeConsensusHeatmap,
  resolveContestedBlocks,
} from '../lib/pipeline/ast-heatmap.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #297 - AST Consensus Heatmap in Code Diff Viewer', () => {
  it('normalizeLineStructure normalizes quotes, whitespace, comments, and semicolons', () => {
    const raw1 = '  const result = "test"; // comment'
    const raw2 = "const result = 'test'"
    const raw3 = 'const   result  =  `test`;'

    assert.strictEqual(normalizeLineStructure(raw1), normalizeLineStructure(raw2))
    assert.strictEqual(normalizeLineStructure(raw2), normalizeLineStructure(raw3))
  })

  it('scoreToStatus maps consensus score into color status categories', () => {
    assert.strictEqual(scoreToStatus(1.0), 'full_consensus')
    assert.strictEqual(scoreToStatus(0.99), 'full_consensus')
    assert.strictEqual(scoreToStatus(0.67), 'partial_consensus')
    assert.strictEqual(scoreToStatus(0.33), 'diverged')
    assert.strictEqual(scoreToStatus(0.0), 'diverged')
  })

  it('computes line-by-line consensus heatmap and identifies contested blocks across 3 models', () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const cand1 = {
      index: 1,
      label: 'Model A',
      text: 'import fs from "node:fs";\n\nexport function readConfig() {\n  return JSON.parse(fs.readFileSync("config.json"));\n}',
    }
    const cand2 = {
      index: 2,
      label: 'Model B',
      text: 'import fs from "node:fs";\n\nexport function readConfig() {\n  // Alternative approach\n  return JSON.parse(fs.readFileSync("config.json"));\n}',
    }
    const cand3 = {
      index: 3,
      label: 'Model C',
      text: 'import fs from "node:fs";\n\nexport function readConfig() {\n  const raw = fs.readFileSync("config.json", "utf8");\n  return JSON.parse(raw);\n}',
    }

    const res = computeConsensusHeatmap('lib/config.js', [cand1, cand2, cand3], { ctx: mockCtx })
    assert.ok(res)
    assert.strictEqual(res.file, 'lib/config.js')
    assert.ok(res.totalLines >= 4)
    assert.ok(res.overallConsensusScore > 0.5)

    // Line 1 ('import fs from "node:fs"') should have 100% agreement
    assert.strictEqual(res.lines[0].status, 'full_consensus')
    assert.strictEqual(res.lines[0].consensusScore, 1.0)

    // Unified heatmap text diff should contain color badges
    assert.ok(res.unifiedHeatmapDiff.includes('🟢 [100%]'))

    assert.ok(events.some((e) => e.evt === MOA_EVENTS.AST_HEATMAP_COMPUTED))
  })

  it('resolves contested blocks when user selects preferred model alternative', () => {
    const baseCode = 'function auth() {\n  // line 2: contested\n  return false;\n}'
    const contestedBlocks = [
      {
        id: 'contested-1',
        startLine: 2,
        endLine: 3,
        alternatives: [
          { candidateIndex: 1, label: 'Model A', code: '  // Model A pick\n  return verifyJwt(token);' },
          { candidateIndex: 2, label: 'Model B', code: '  // Model B pick\n  return checkSession(session);' },
        ],
      },
    ]

    const resolved = resolveContestedBlocks(baseCode, contestedBlocks, {
      'contested-1': 2,
    })

    assert.ok(resolved.includes('checkSession(session)'))
    assert.ok(!resolved.includes('verifyJwt(token)'))
  })
})
