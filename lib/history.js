/**
 * MoA Run History & Analytics Module
 * Records every MoA pipeline execution, tracks model win rates and costs,
 * and provides history search, file rotation, and non-blocking I/O.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const DEFAULT_HISTORY_DIR = path.join(os.homedir(), '.dsh')
const DEFAULT_HISTORY_FILE = path.join(DEFAULT_HISTORY_DIR, 'moa-history.jsonl')

/** Max history file size before rotation (10 MB) */
export const MAX_HISTORY_BYTES = 10 * 1024 * 1024

export function getHistoryFilePath(customDir) {
  if (customDir) {
    return path.join(customDir, '.moa-history.jsonl')
  }
  return DEFAULT_HISTORY_FILE
}

/**
 * Checks if the history file exceeds the size threshold and rotates it.
 * Moves current file to `${filePath}.1`, removing any older `.1` backup.
 */
export function rotateHistoryFileIfNeeded(filePath = DEFAULT_HISTORY_FILE, maxBytes = MAX_HISTORY_BYTES) {
  try {
    if (!fs.existsSync(filePath)) return false
    const stat = fs.statSync(filePath)
    if (stat.size >= maxBytes) {
      const backupPath = `${filePath}.1`
      if (fs.existsSync(backupPath)) {
        try { fs.unlinkSync(backupPath) } catch {}
      }
      fs.renameSync(filePath, backupPath)
      return true
    }
  } catch (err) {
    console.warn('[dsh-moa] History rotation warning:', err?.message || err)
  }
  return false
}

/**
 * Prepares a normalized history record entry.
 */
function normalizeRunRecord(record) {
  return {
    id: record.id || crypto.randomUUID(),
    timestamp: record.timestamp || new Date().toISOString(),
    prompt: record.prompt || '',
    preset: record.preset || 'default',
    isRefinement: Boolean(record.isRefinement),
    isFastMode: Boolean(record.isFastMode),
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
}

/**
 * Appends a completed MoA run record to the history file synchronously (preserves sync API).
 * Performs automatic size-based rotation.
 */
export function recordMoaRun(record, filePath = DEFAULT_HISTORY_FILE) {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    rotateHistoryFileIfNeeded(filePath)

    const entry = normalizeRunRecord(record)
    const line = JSON.stringify(entry) + '\n'
    fs.appendFileSync(filePath, line, 'utf8')
    return entry
  } catch (err) {
    console.warn('[dsh-moa] Failed to record run to history:', err)
    return null
  }
}

/**
 * Asynchronously appends a completed MoA run record without blocking the event loop.
 */
export async function recordMoaRunAsync(record, filePath = DEFAULT_HISTORY_FILE) {
  try {
    const dir = path.dirname(filePath)
    await fs.promises.mkdir(dir, { recursive: true }).catch(() => {})

    rotateHistoryFileIfNeeded(filePath)

    const entry = normalizeRunRecord(record)
    const line = JSON.stringify(entry) + '\n'
    await fs.promises.appendFile(filePath, line, 'utf8')
    return entry
  } catch (err) {
    console.warn('[dsh-moa] Failed to async-record run to history:', err)
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
export function getMoaLeaderboard(filePath = DEFAULT_HISTORY_FILE, options = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      return { totalRuns: 0, models: [] }
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    const totalRuns = lines.length

    const modelStats = new Map()
    const presetFilter = typeof options === 'string' ? options : (options?.presetFilter || options?.preset || null)

    let filteredRuns = 0
    for (const line of lines) {
      try {
        const item = JSON.parse(line)
        if (!item) continue
        if (presetFilter && presetFilter !== 'all' && item.preset !== presetFilter) continue
        filteredRuns++

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

            if (winner && cand.model && (winner === key || winner === cand.model)) {
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

    return { totalRuns: presetFilter && presetFilter !== 'all' ? filteredRuns : totalRuns, models, preset: presetFilter }
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

/**
 * Exports history data in JSON or CSV format with optional preset filtering.
 */
export function exportMoaHistory(filePath = DEFAULT_HISTORY_FILE, options = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      return options?.format === 'csv' ? 'id,timestamp,preset,winnerModel,totalTokens,totalCostUsd,durationMs\n' : '[]'
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    const presetFilter = typeof options === 'string' ? options : (options?.presetFilter || options?.preset || null)
    const format = options?.format === 'csv' ? 'csv' : 'json'

    const records = []
    for (const line of lines) {
      try {
        const item = JSON.parse(line)
        if (!item) continue
        if (presetFilter && presetFilter !== 'all' && item.preset !== presetFilter) continue
        records.push(item)
      } catch {}
    }

    if (format === 'csv') {
      const header = 'id,timestamp,preset,winnerModel,totalTokens,totalCostUsd,durationMs,isRefinement,isFastMode'
      const rows = records.map((r) => {
        const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
        return [
          escapeCsv(r.id),
          escapeCsv(r.timestamp),
          escapeCsv(r.preset),
          escapeCsv(r.winnerModel),
          Number(r.totalTokens || 0),
          Number(r.totalCostUsd || 0).toFixed(4),
          Number(r.durationMs || 0),
          Boolean(r.isRefinement),
          Boolean(r.isFastMode),
        ].join(',')
      })
      return [header, ...rows].join('\n')
    }

    return JSON.stringify(records, null, 2)
  } catch (err) {
    console.warn('[dsh-moa] Failed to export history:', err)
    return options?.format === 'csv' ? '' : '[]'
  }
}

export function candidatesForHistory(referenceOutputs) {
  return (referenceOutputs || []).map((r) => ({
    provider: r.slot?.provider || "",
    model: r.slot?.model || "",
    files: (r.files || []).map((f) => f.relativePath),
    usage: r.usage || { inputTokens: 0, outputTokens: 0 },
    costUsd: r.costUsd || 0,
  }))
}
