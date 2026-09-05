/**
 * MoA Run History & Analytics Module
 * Records every MoA pipeline execution, tracks model win rates and costs,
 * and provides history search and run replay capabilities.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const DEFAULT_HISTORY_DIR = path.join(os.homedir(), '.dsh')
const DEFAULT_HISTORY_FILE = path.join(DEFAULT_HISTORY_DIR, 'moa-history.jsonl')

export function getHistoryFilePath(customDir) {
  if (customDir) {
    return path.join(customDir, '.moa-history.jsonl')
  }
  return DEFAULT_HISTORY_FILE
}

/**
 * Appends a completed MoA run record to the history file.
 */
export function recordMoaRun(record, filePath = DEFAULT_HISTORY_FILE) {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const entry = {
      id: record.id || crypto.randomUUID(),
      timestamp: record.timestamp || new Date().toISOString(),
      prompt: record.prompt || '',
      preset: record.preset || 'default',
      isRefinement: Boolean(record.isRefinement),
      candidates: Array.isArray(record.candidates)
        ? record.candidates.map((c) => ({
            provider: c.provider || '',
            model: c.model || '',
            filesCount: Array.isArray(c.files) ? c.files.length : (c.filesCount || 0),
            usage: c.usage || { inputTokens: 0, outputTokens: 0 },
            costUsd: Number(c.costUsd || 0),
          }))
        : [],
      aggregator: record.aggregator
        ? {
            provider: record.aggregator.provider || '',
            model: record.aggregator.model || '',
            usage: record.aggregator.usage || { inputTokens: 0, outputTokens: 0 },
            costUsd: Number(record.aggregator.costUsd || 0),
          }
        : null,
      winnerIndex: typeof record.winnerIndex === 'number' ? record.winnerIndex : -1,
      winnerModel: record.winnerModel || '',
      promotedFiles: Array.isArray(record.promotedFiles) ? record.promotedFiles : [],
      totalTokens: Number(record.totalTokens || 0),
      totalCostUsd: Number(record.totalCostUsd || 0),
      durationMs: Number(record.durationMs || 0),
    }

    const line = JSON.stringify(entry) + '\n'
    fs.appendFileSync(filePath, line, 'utf8')
    return entry
  } catch (err) {
    console.warn('[dsh-moa] Failed to record run to history:', err)
    return null
  }
}

/**
 * Reads history runs with pagination (latest first).
 */
export function getMoaHistory(limit = 20, offset = 0, filePath = DEFAULT_HISTORY_FILE) {
  try {
    if (!fs.existsSync(filePath)) {
      return { total: 0, runs: [] }
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    const total = lines.length

    const sliced = lines
      .slice(Math.max(0, total - offset - limit), total - offset)
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)

    return { total, runs: sliced }
  } catch (err) {
    console.warn('[dsh-moa] Failed to read history:', err)
    return { total: 0, runs: [] }
  }
}

/**
 * Calculates win-rate leaderboard and model performance statistics across history.
 */
export function getMoaLeaderboard(filePath = DEFAULT_HISTORY_FILE) {
  try {
    if (!fs.existsSync(filePath)) {
      return { totalRuns: 0, models: [] }
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    const totalRuns = lines.length

    const modelStats = new Map()

    for (const line of lines) {
      try {
        const item = JSON.parse(line)
        if (!item) continue

        const winner = item.winnerModel ? String(item.winnerModel).trim() : null

        if (Array.isArray(item.candidates)) {
          for (const cand of item.candidates) {
            const key = cand.provider && cand.model ? `${cand.provider}:${cand.model}` : (cand.model || 'unknown')
            if (!modelStats.has(key)) {
              modelStats.set(key, {
                modelKey: key,
                provider: cand.provider || '',
                model: cand.model || key,
                runs: 0,
                wins: 0,
                totalTokens: 0,
                totalCostUsd: 0,
              })
            }
            const st = modelStats.get(key)
            st.runs += 1
            const inTok = cand.usage?.inputTokens || 0
            const outTok = cand.usage?.outputTokens || 0
            st.totalTokens += inTok + outTok
            st.totalCostUsd += Number(cand.costUsd || 0)

            if (winner && (winner === key || winner === cand.model || winner.includes(cand.model))) {
              st.wins += 1
            }
          }
        }
      } catch {
        // ignore malformed line
      }
    }

    const models = Array.from(modelStats.values())
      .map((st) => ({
        ...st,
        winRate: st.runs > 0 ? Number(((st.wins / st.runs) * 100).toFixed(1)) : 0,
        avgTokens: st.runs > 0 ? Math.round(st.totalTokens / st.runs) : 0,
        avgCostUsd: st.runs > 0 ? Number((st.totalCostUsd / st.runs).toFixed(4)) : 0,
      }))
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)

    return { totalRuns, models }
  } catch (err) {
    console.warn('[dsh-moa] Failed to calculate leaderboard:', err)
    return { totalRuns: 0, models: [] }
  }
}

/**
 * Retrieves a single history run by ID.
 */
export function getMoaRunById(runId, filePath = DEFAULT_HISTORY_FILE) {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const item = JSON.parse(lines[i])
        if (item && item.id === runId) return item
      } catch {}
    }
    return null
  } catch {
    return null
  }
}
