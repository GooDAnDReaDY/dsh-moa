import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  recordMoaRun,
  getMoaHistory,
  getMoaLeaderboard,
  getMoaRunById,
} from '../lib/history.js'

test('history: records run, reads paginated history, and calculates leaderboard', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-hist-test-'))
  const histFile = path.join(tmpDir, 'history.jsonl')

  try {
    // 1. Record Run 1
    const run1 = recordMoaRun(
      {
        prompt: 'Build calculator',
        preset: 'default',
        candidates: [
          { provider: 'p1', model: 'm1', files: ['index.html'], usage: { inputTokens: 100, outputTokens: 200 }, costUsd: 0.001 },
          { provider: 'p2', model: 'm2', files: ['index.html'], usage: { inputTokens: 100, outputTokens: 180 }, costUsd: 0.002 },
        ],
        aggregator: { provider: 'p3', model: 'm3', usage: { inputTokens: 300, outputTokens: 150 }, costUsd: 0.005 },
        winnerIndex: 0,
        winnerModel: 'p1:m1',
        promotedFiles: ['index.html'],
        totalTokens: 1030,
        totalCostUsd: 0.008,
      },
      histFile
    )

    assert.ok(run1.id, 'Run 1 has ID')
    assert.equal(run1.winnerModel, 'p1:m1')

    // 2. Record Run 2
    const run2 = recordMoaRun(
      {
        prompt: 'Build stopwatch',
        preset: 'fast',
        candidates: [
          { provider: 'p1', model: 'm1', files: ['index.html'], usage: { inputTokens: 50, outputTokens: 100 }, costUsd: 0.0005 },
        ],
        winnerIndex: 0,
        winnerModel: 'p1:m1',
        promotedFiles: ['index.html'],
        totalTokens: 150,
        totalCostUsd: 0.0005,
      },
      histFile
    )

    // 3. Read history
    const history = getMoaHistory(10, 0, histFile)
    assert.equal(history.total, 2)
    assert.equal(history.runs.length, 2)
    assert.equal(history.runs[0].id, run2.id, 'Latest run is first')

    // 4. Get by ID
    const found = getMoaRunById(run1.id, histFile)
    assert.ok(found)
    assert.equal(found.prompt, 'Build calculator')

    // 5. Leaderboard
    const lb = getMoaLeaderboard(histFile)
    assert.equal(lb.totalRuns, 2)
    assert.ok(lb.models.length >= 2)
    const m1Stats = lb.models.find((m) => m.modelKey === 'p1:m1')
    assert.ok(m1Stats)
    assert.equal(m1Stats.wins, 2)
    assert.equal(m1Stats.runs, 2)
    assert.equal(m1Stats.winRate, 100)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
