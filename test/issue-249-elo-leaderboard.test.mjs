import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  INITIAL_ELO,
  classifyEloCategory,
  expectedEloScore,
  computeEloFromRuns,
  selectBestPresetByElo,
} from '../lib/moa-elo.js'
import { recordMoaRunAsync, getMoaLeaderboard } from '../lib/history.js'
import { resolvePresetForPrompt } from '../lib/moa-router.js'
import { PresetSchema } from '../lib/moa-schema.js'

test('issue #249: PresetSchema defaults elo_ranking_enabled to true and classifyEloCategory segments tasks', () => {
  const parsed = PresetSchema({ name: 'elo-p' })
  assert.equal(parsed.elo_ranking_enabled, true)

  assert.equal(classifyEloCategory('Create a React Tailwind button component'), 'frontend')
  assert.equal(classifyEloCategory('Optimize PostgreSQL index migration query'), 'sql')
  assert.equal(classifyEloCategory('Write unit test suite with assertions'), 'testing')
  assert.equal(classifyEloCategory('Refactor and clean up dead code'), 'refactoring')
  assert.equal(classifyEloCategory('Build JWT auth middleware REST endpoint'), 'backend')
})

test('issue #249: computeEloFromRuns and getMoaLeaderboard compute pairwise Elo and categoryElo', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-elo-test-'))
  const histFile = path.join(tmpDir, 'history.jsonl')
  try {
    for (let i = 0; i < 3; i++) {
      await recordMoaRunAsync({
        id: `run-${i}`,
        prompt: 'Build React UI component',
        preset: 'frontend-ui',
        candidates: [
          { index: 1, provider: 'anthropic', model: 'claude-3-7', usage: { inputTokens: 10, outputTokens: 10 }, costUsd: 0.001 },
          { index: 2, provider: 'openai', model: 'gpt-4o', usage: { inputTokens: 10, outputTokens: 10 }, costUsd: 0.001 },
        ],
        winnerIndex: 1,
        winnerModel: 'anthropic:claude-3-7',
      }, histFile)
    }

    const lb = getMoaLeaderboard(histFile)
    assert.equal(lb.models.length, 2)
    const winner = lb.models.find((m) => m.modelKey === 'anthropic:claude-3-7')
    const loser = lb.models.find((m) => m.modelKey === 'openai:gpt-4o')

    assert.ok(winner.elo > INITIAL_ELO, `Expected winner Elo (${winner.elo}) > ${INITIAL_ELO}`)
    assert.ok(loser.elo < INITIAL_ELO, `Expected loser Elo (${loser.elo}) < ${INITIAL_ELO}`)
    assert.ok(winner.categoryElo.frontend > INITIAL_ELO)

    // Verify Smart Routing uses Elo active learning leaderboard
    const presets = [
      { name: 'default', enabled: true, reference_models: [{ provider: 'openai', model: 'gpt-4o' }] },
      { name: 'pro-ui', enabled: true, reference_models: [{ provider: 'anthropic', model: 'claude-3-7' }] },
    ]
    const routed = await resolvePresetForPrompt('Design a responsive CSS modal', presets, 'default', {
      smartRoutingEnabled: true,
      leaderboard: lb,
    })
    assert.equal(routed.presetName, 'pro-ui')
    assert.equal(routed.reason, 'elo_active_learning')
    assert.equal(routed.category, 'frontend')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
