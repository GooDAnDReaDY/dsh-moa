import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  anonymizeCandidates,
  revealArenaSession,
  calculateEloUpdate,
  recordBattleVote,
  getArenaLeaderboard,
  loadArenaRatings,
  saveArenaRatings
} from '../lib/pipeline/battle-arena.js'

test('Issue #294: ELO update math calculates expected score and rating delta', () => {
  // Model A (1200) vs Model B (1200): Equal rating, A wins
  const { newRatingA, newRatingB } = calculateEloUpdate(1200, 1200, 1.0, 32)
  assert.equal(newRatingA, 1216)
  assert.equal(newRatingB, 1184)

  // Tie outcome
  const tie = calculateEloUpdate(1200, 1200, 0.5, 32)
  assert.equal(tie.newRatingA, 1200)
  assert.equal(tie.newRatingB, 1200)
})

test('Issue #294: Candidate anonymization and reveal flow in Blind Battle Arena', () => {
  const sessionId = 'test_arena_session_1'
  const rawCandidates = [
    { label: 'DeepSeek-V3', model: 'deepseek/deepseek-chat', text: 'Solution A code' },
    { label: 'Claude-3.5', model: 'anthropic/claude-3-5-sonnet', text: 'Solution B code' }
  ]

  const anonymized = anonymizeCandidates(rawCandidates, sessionId)
  assert.equal(anonymized.length, 2)
  assert.equal(anonymized[0].label, 'Candidate A')
  assert.equal(anonymized[1].label, 'Candidate B')
  assert.equal(anonymized[0].isAnonymized, true)
  assert.equal(anonymized[0].originalModel, undefined)

  const revealRes = revealArenaSession(sessionId)
  assert.equal(revealRes.ok, true)
  assert.equal(revealRes.mapping.length, 2)
  assert.equal(revealRes.mapping[0].originalModel, 'deepseek/deepseek-chat')
  assert.equal(revealRes.mapping[1].originalModel, 'anthropic/claude-3-5-sonnet')
})

test('Issue #294: Recording votes updates persistent ELO ratings and leaderboard', () => {
  const tmpFile = path.join(os.tmpdir(), `test_arena_ratings_${Date.now()}.json`)
  try {
    const sessionId = 'test_arena_session_vote'
    anonymizeCandidates([
      { model: 'model-alpha', text: 'Code alpha' },
      { model: 'model-beta', text: 'Code beta' }
    ], sessionId)

    const voteRes = recordBattleVote({
      sessionId,
      winnerId: 'Candidate A',
      notes: 'Model A was cleaner',
      customPath: tmpFile
    })

    assert.equal(voteRes.ok, true)
    assert.equal(voteRes.winnerModel, 'model-alpha')

    const board = getArenaLeaderboard(tmpFile)
    assert.equal(board.totalMatches, 1)
    assert.equal(board.leaderboard.length, 2)
    assert.equal(board.leaderboard[0].model, 'model-alpha')
    assert.equal(board.leaderboard[0].wins, 1)
    assert.equal(board.leaderboard[0].rating > 1200, true)
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  }
})
