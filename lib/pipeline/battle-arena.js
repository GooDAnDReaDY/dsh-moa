/**
 * DeepSeek Harness Mixture of Agents (MoA) — Human Jury & Blind Battle Arena (#294)
 * Provides anonymized blind evaluation, human-in-the-loop voting, and ELO ratings.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export function getBaseDshDir() {
  if (process.env.DSH_HOME) {
    const trimmed = process.env.DSH_HOME.trim()
    return trimmed.endsWith('.dsh') ? trimmed : path.join(trimmed, '.dsh')
  }
  return path.join(os.homedir(), '.dsh')
}

export const DEFAULT_ARENA_FILE = path.join(getBaseDshDir(), 'moa', 'arena_ratings.json')

// In-memory active arena sessions map for live anonymization/reveal
const activeArenaSessions = new Map()

export function getArenaFilePath(customPath = null) {
  if (customPath && typeof customPath === 'string' && customPath.trim().length > 0) {
    return path.resolve(customPath)
  }
  if (process.env.DSH_MOA_ARENA_PATH) {
    return path.resolve(process.env.DSH_MOA_ARENA_PATH)
  }
  return DEFAULT_ARENA_FILE
}

export function loadArenaRatings(customPath = null) {
  const target = getArenaFilePath(customPath)
  if (!fs.existsSync(target)) {
    return { version: 1, models: {}, history: [] }
  }
  try {
    const raw = fs.readFileSync(target, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      version: parsed.version || 1,
      models: parsed.models || {},
      history: Array.isArray(parsed.history) ? parsed.history : []
    }
  } catch {
    return { version: 1, models: {}, history: [] }
  }
}

export function saveArenaRatings(data, customPath = null) {
  const target = getArenaFilePath(customPath)
  const dir = path.dirname(target)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const cleanData = {
    version: data?.version || 1,
    models: data?.models || {},
    history: Array.isArray(data?.history) ? data.history.slice(-500) : []
  }
  fs.writeFileSync(target, JSON.stringify(cleanData, null, 2), 'utf-8')
  return true
}

/**
 * Standard ELO expected score
 */
export function getExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/**
 * Updates pairwise ELO between model A and model B
 * outcome: 1.0 (A wins), 0.5 (tie), 0.0 (B wins)
 */
export function calculateEloUpdate(ratingA, ratingB, outcomeA, kFactor = 32) {
  const expectedA = getExpectedScore(ratingA, ratingB)
  const expectedB = 1 - expectedA
  const outcomeB = 1 - outcomeA
  const newRatingA = Math.round(ratingA + kFactor * (outcomeA - expectedA))
  const newRatingB = Math.round(ratingB + kFactor * (outcomeB - expectedB))
  return { newRatingA, newRatingB }
}

/**
 * Anonymizes candidate responses for Blind Battle Arena
 */
export function anonymizeCandidates(candidates, sessionId = 'default') {
  if (!Array.isArray(candidates)) return []
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const mapping = []
  
  const anonymized = candidates.map((cand, idx) => {
    const alias = `Вариант ${letters[idx] || (idx + 1)}`
    const anonId = `cand_anon_${idx + 1}`
    const originalModel = cand.model || cand.label || `model_${idx + 1}`
    mapping.push({
      anonId,
      alias,
      originalModel,
      originalLabel: cand.label || originalModel
    })
    return {
      ...cand,
      id: anonId,
      label: alias,
      isAnonymized: true,
      originalModel: undefined, // Hidden from client until reveal
    }
  })

  activeArenaSessions.set(sessionId, {
    sessionId,
    timestamp: Date.now(),
    isRevealed: false,
    mapping,
    originalCandidates: candidates
  })

  return anonymized
}

/**
 * Reveals original models for an arena session
 */
export function revealArenaSession(sessionId) {
  const session = activeArenaSessions.get(sessionId)
  if (!session) {
    return { ok: false, error: 'Arena session not found' }
  }
  session.isRevealed = true
  return {
    ok: true,
    sessionId,
    isRevealed: true,
    mapping: session.mapping
  }
}

/**
 * Records human jury vote and updates ELO ratings
 */
export function recordBattleVote({ sessionId, winnerId, scores = {}, notes = '', customPath = null }) {
  const session = activeArenaSessions.get(sessionId)
  const ratings = loadArenaRatings(customPath)

  let winnerModel = null
  const participantModels = []

  if (session) {
    for (const item of session.mapping) {
      participantModels.push(item.originalModel)
      if (item.anonId === winnerId || item.alias === winnerId || item.originalModel === winnerId) {
        winnerModel = item.originalModel
      }
    }
  } else if (winnerId) {
    winnerModel = winnerId
  }

  // Ensure all participating models have rating records
  for (const m of participantModels) {
    if (!ratings.models[m]) {
      ratings.models[m] = { rating: 1200, matches: 0, wins: 0, losses: 0, ties: 0 }
    }
  }

  // Pairwise ELO updates against winner
  if (winnerModel && participantModels.length > 1) {
    const winnerStats = ratings.models[winnerModel] || { rating: 1200, matches: 0, wins: 0, losses: 0, ties: 0 }
    for (const otherModel of participantModels) {
      if (otherModel === winnerModel) continue
      const otherStats = ratings.models[otherModel] || { rating: 1200, matches: 0, wins: 0, losses: 0, ties: 0 }
      
      const { newRatingA, newRatingB } = calculateEloUpdate(winnerStats.rating, otherStats.rating, 1.0)
      winnerStats.rating = newRatingA
      winnerStats.matches += 1
      winnerStats.wins += 1

      otherStats.rating = newRatingB
      otherStats.matches += 1
      otherStats.losses += 1
      ratings.models[otherModel] = otherStats
    }
    ratings.models[winnerModel] = winnerStats
  }

  const historyEntry = {
    sessionId: sessionId || `session_${Date.now()}`,
    timestamp: Date.now(),
    winnerModel,
    participants: participantModels,
    scores,
    notes: String(notes || '').slice(0, 500)
  }

  ratings.history.push(historyEntry)
  saveArenaRatings(ratings, customPath)

  return {
    ok: true,
    winnerModel,
    updatedRatings: ratings.models,
    historyEntry
  }
}

/**
 * Returns formatted ELO leaderboard
 */
export function getArenaLeaderboard(customPath = null) {
  const data = loadArenaRatings(customPath)
  const models = data.models || {}
  const list = Object.entries(models).map(([name, stats]) => {
    const matches = stats.matches || 0
    const wins = stats.wins || 0
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0
    return {
      model: name,
      rating: stats.rating || 1200,
      matches,
      wins,
      losses: stats.losses || 0,
      ties: stats.ties || 0,
      winRate
    }
  })

  list.sort((a, b) => b.rating - a.rating)
  return {
    totalMatches: data.history?.length || 0,
    leaderboard: list
  }
}
