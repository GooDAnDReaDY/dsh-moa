import { logger } from './logger.js'
/**
 * MoA Run History & Analytics Module
 * Records every MoA pipeline execution, tracks model win rates and costs,
 * and provides history search, file rotation, and non-blocking I/O.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

export function isTestEnvironment() {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.DSH_TEST === '1' ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    Boolean(process.execArgv?.some((arg) => arg.includes('test'))) ||
    Boolean(process.argv?.[1]?.includes('test'))
  )
}

export function getDefaultHistoryDir() {
  if (process.env.DSH_HISTORY_DIR) {
    return process.env.DSH_HISTORY_DIR
  }
  if (process.env.DSH_HOME) {
    const trimmed = process.env.DSH_HOME.trim()
    return trimmed.endsWith('.dsh') ? trimmed : path.join(trimmed, '.dsh')
  }
  if (isTestEnvironment()) {
    return path.join(os.tmpdir(), '.dsh-test')
  }
  return path.join(os.homedir(), '.dsh')
}

export function getDefaultHistoryFile() {
  if (process.env.DSH_HISTORY_FILE) {
    return process.env.DSH_HISTORY_FILE
  }
  return path.join(getDefaultHistoryDir(), 'moa-history.jsonl')
}

/** Max history file size before rotation (10 MB) */
export const MAX_HISTORY_BYTES = 10 * 1024 * 1024

/** In-memory cache for leaderboard and parsed analytics */
let _historyCache = null

export function invalidateHistoryCache() {
  _historyCache = null
}

/**
 * Checks if the history file exceeds the size threshold and rotates it.
 * Moves current file to `${filePath}.1`, removing any older `.1` backup.
 */
export function rotateHistoryFileIfNeeded(filePath = getDefaultHistoryFile(), maxBytes = MAX_HISTORY_BYTES) {
  try {
    if (!fs.existsSync(filePath)) return false
    const stat = fs.statSync(filePath)
    if (stat.size >= maxBytes) {
      const backupPath = `${filePath}.1`
      if (fs.existsSync(backupPath)) {
        try { fs.unlinkSync(backupPath) } catch { /* backup unlink best-effort */ }
      }
      fs.renameSync(filePath, backupPath)
      invalidateHistoryCache()
      return true
    }
  } catch (err) {
    logger.warn('[dsh-moa] History rotation warning:', err?.message || err)
  }
  return false
}

/**
 * Prepares a normalized history record entry.
 * Preserves candidate persona, temperature, fallback, testResult, and slot details (#169).
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
      ? record.candidates.map((c, idx) => ({
          index: typeof c.index === 'number' ? c.index : (idx + 1),
          provider: c.provider || c.slot?.provider || '',
          model: c.model || c.slot?.model || '',
          slot: c.slot ? { provider: c.slot.provider, model: c.slot.model } : (c.provider && c.model ? { provider: c.provider, model: c.model } : undefined),
          role: c.role || c.role_persona || 'general',
          temperature: typeof c.temperature === 'number' ? c.temperature : undefined,
          wasFallback: Boolean(c.wasFallback || c.was_fallback),
          originalModel: c.originalModel || c.original_model || null,
          filesCount: Array.isArray(c.files) ? c.files.length : (c.filesCount || 0),
          files: Array.isArray(c.files) ? c.files : undefined,
          usage: c.usage || { inputTokens: 0, outputTokens: 0 },
          costUsd: Number(c.costUsd || 0),
          testResult: c.testResult ? {
            passed: Boolean(c.testResult.passed),
            exitCode: c.testResult.exitCode ?? 0,
            summary: c.testResult.summary || '',
            durationMs: c.testResult.durationMs ?? 0,
          } : null,
        }))
      : [],
    aggregator: record.aggregator
      ? {
          provider: record.aggregator.provider || record.aggregator.slot?.provider || '',
          model: record.aggregator.model || record.aggregator.slot?.model || '',
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
    benchmarkReport: record.benchmarkReport || null,
    consensus: record.consensus || null,
  }
}

/**
 * Appends a completed MoA run record to the history file synchronously (preserves sync API).
 * Performs automatic size-based rotation.
 */
export function recordMoaRun(record, filePath = getDefaultHistoryFile()) {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    rotateHistoryFileIfNeeded(filePath)

    const entry = normalizeRunRecord(record)
    const line = JSON.stringify(entry) + '\n'
    fs.appendFileSync(filePath, line, 'utf8')
    invalidateHistoryCache()
    return entry
  } catch (err) {
    logger.warn('[dsh-moa] Failed to record run to history:', err)
    return null
  }
}

/**
 * Asynchronously appends a completed MoA run record without blocking the event loop.
 */
export async function recordMoaRunAsync(record, filePath = getDefaultHistoryFile()) {
  try {
    const dir = path.dirname(filePath)
    await fs.promises.mkdir(dir, { recursive: true }).catch(() => {})

    rotateHistoryFileIfNeeded(filePath)

    const entry = normalizeRunRecord(record)
    const line = JSON.stringify(entry) + '\n'
    await fs.promises.appendFile(filePath, line, 'utf8')
    invalidateHistoryCache()
    return entry
  } catch (err) {
    logger.warn('[dsh-moa] Failed to async-record run to history:', err)
    return null
  }
}

/**
 * Reads lines from the end of a file in reverse order in chunks.
 * Avoids loading multi-megabyte JSONL files into V8 heap strings.
 * Buffer-safe: never splits multi-byte UTF-8 sequences at chunk boundaries (#184).
 */
export function readTailLinesSync(filePath, countNeeded = 50) {
  const CHUNK_SIZE = 64 * 1024
  const fd = fs.openSync(filePath, 'r')
  try {
    const stat = fs.fstatSync(fd)
    let pos = stat.size
    let remainderBuf = Buffer.alloc(0)
    const collectedLines = []

    while (pos > 0 && collectedLines.length < countNeeded) {
      const bytesToRead = Math.min(CHUNK_SIZE, pos)
      pos -= bytesToRead
      const buf = Buffer.alloc(bytesToRead)
      fs.readSync(fd, buf, 0, bytesToRead, pos)
      const totalBuf = remainderBuf.length > 0 ? Buffer.concat([buf, remainderBuf]) : buf

      let endIdx = totalBuf.length
      for (let i = totalBuf.length - 1; i >= 0; i--) {
        if (totalBuf[i] === 0x0A) {
          if (i + 1 < endIdx) {
            const lineBuf = totalBuf.subarray(i + 1, endIdx)
            const lineStr = lineBuf.toString('utf8').trim()
            if (lineStr) {
              collectedLines.push(lineStr)
              if (collectedLines.length >= countNeeded) break
            }
          }
          endIdx = i
        }
      }

      if (collectedLines.length >= countNeeded) {
        remainderBuf = Buffer.alloc(0)
        break
      }

      if (pos > 0) {
        remainderBuf = totalBuf.subarray(0, endIdx)
      } else {
        if (endIdx > 0) {
          const firstLineStr = totalBuf.subarray(0, endIdx).toString('utf8').trim()
          if (firstLineStr && collectedLines.length < countNeeded) {
            collectedLines.push(firstLineStr)
          }
        }
        remainderBuf = Buffer.alloc(0)
      }
    }

    if (remainderBuf.length > 0 && collectedLines.length < countNeeded) {
      const lineStr = remainderBuf.toString('utf8').trim()
      if (lineStr) collectedLines.push(lineStr)
    }

    return collectedLines
  } finally {
    try { fs.closeSync(fd) } catch { /* best effort */ }
  }
}

/**
 * Counts lines in a file by scanning for 0x0A newline bytes in chunks.
 * Fast, memory-efficient, and caches result in _historyCache (#183).
 */
export function countFileLinesSync(filePath, stat) {
  if (
    _historyCache &&
    _historyCache.filePath === filePath &&
    _historyCache.mtimeMs === stat.mtimeMs &&
    _historyCache.size === stat.size &&
    typeof _historyCache.totalCount === 'number'
  ) {
    return _historyCache.totalCount
  }

  let count = 0
  const fd = fs.openSync(filePath, 'r')
  try {
    const CHUNK_SIZE = 64 * 1024
    const buf = Buffer.alloc(CHUNK_SIZE)
    let pos = 0
    let lastByte = 0
    while (pos < stat.size) {
      const bytesToRead = Math.min(CHUNK_SIZE, stat.size - pos)
      fs.readSync(fd, buf, 0, bytesToRead, pos)
      for (let i = 0; i < bytesToRead; i++) {
        if (buf[i] === 0x0A) count++
      }
      lastByte = buf[bytesToRead - 1]
      pos += bytesToRead
    }
    if (stat.size > 0 && lastByte !== 0x0A) {
      count++
    }
  } finally {
    try { fs.closeSync(fd) } catch { /* best effort */ }
  }

  if (
    !_historyCache ||
    _historyCache.filePath !== filePath ||
    _historyCache.mtimeMs !== stat.mtimeMs ||
    _historyCache.size !== stat.size
  ) {
    _historyCache = {
      filePath,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      leaderboards: new Map(),
      totalCount: count,
    }
  } else {
    _historyCache.totalCount = count
  }
  return count
}

/**
 * Reads history runs with pagination (latest first).
 */
export function getMoaHistory(limit = 20, offset = 0, filePath = getDefaultHistoryFile()) {
  try {
    if (!fs.existsSync(filePath)) {
      return { total: 0, runs: [] }
    }

    const stat = fs.statSync(filePath)
    const needed = offset + limit

    // For files under 64KB, straightforward full-read is fast and keeps exact total
    if (stat.size <= 65536) {
      const raw = fs.readFileSync(filePath, 'utf8')
      const lines = raw.trim().split('\n').filter(Boolean)
      const total = lines.length

      if (
        !_historyCache ||
        _historyCache.filePath !== filePath ||
        _historyCache.mtimeMs !== stat.mtimeMs ||
        _historyCache.size !== stat.size
      ) {
        _historyCache = {
          filePath,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          leaderboards: new Map(),
          totalCount: total,
        }
      } else {
        _historyCache.totalCount = total
      }

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
    }

    // For larger files: read only tail lines backwards to avoid splitting 10MB in memory
    const tailLines = readTailLinesSync(filePath, needed)
    const pageLines = tailLines.slice(offset, offset + limit)
    const runs = pageLines
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)

    let total = _historyCache?.totalCount
    if (typeof total !== 'number') {
      total = tailLines.length < needed ? tailLines.length : countFileLinesSync(filePath, stat)
    }

    return { total, runs }
  } catch (err) {
    logger.warn('[dsh-moa] Failed to read history:', err)
    return { total: 0, runs: [] }
  }
}

/**
 * Calculates win-rate leaderboard and model performance statistics across history.
 * Employs in-memory caching keyed by file mtime and size for O(1) repeated queries.
 * Robust matching for aliases, fallbacks, and winnerIndex (#185).
 */
export function getMoaLeaderboard(filePath = getDefaultHistoryFile(), options = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      return { totalRuns: 0, models: [] }
    }

    const stat = fs.statSync(filePath)
    const presetFilter = typeof options === 'string' ? options : (options?.presetFilter || options?.preset || null)
    const filterKey = presetFilter || 'all'

    if (
      _historyCache &&
      _historyCache.filePath === filePath &&
      _historyCache.mtimeMs === stat.mtimeMs &&
      _historyCache.size === stat.size
    ) {
      if (_historyCache.leaderboards.has(filterKey)) {
        return _historyCache.leaderboards.get(filterKey)
      }
    } else {
      _historyCache = {
        filePath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        leaderboards: new Map(),
        totalCount: null,
      }
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    const totalRuns = lines.length
    _historyCache.totalCount = totalRuns

    const modelStats = new Map()
    let filteredRuns = 0
    for (const line of lines) {
      try {
        const item = JSON.parse(line)
        if (!item) continue
        if (presetFilter && presetFilter !== 'all' && item.preset !== presetFilter) continue
        filteredRuns++

        const rawWinner = item.winnerModel ? String(item.winnerModel).trim() : null
        const cleanWinner = rawWinner ? rawWinner.replace(/\s*\[fallback for .*\]$/i, '').trim() : null
        const normWinner = cleanWinner && cleanWinner !== 'none' && cleanWinner !== 'unknown'
          ? cleanWinner.replace(/[\/:]/g, ':').toLowerCase()
          : null

        if (Array.isArray(item.candidates)) {
          for (let candIdx = 0; candIdx < item.candidates.length; candIdx++) {
            const cand = item.candidates[candIdx]
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

            const inTok = cand.usage?.inputTokens ?? cand.usage?.totalInputTokens ?? cand.usage?.prompt_tokens ?? 0
            const outTok = cand.usage?.outputTokens ?? cand.usage?.totalOutputTokens ?? cand.usage?.completion_tokens ?? 0
            st.totalTokens += inTok + outTok
            st.totalCostUsd += Number(cand.costUsd || 0)

            let isWin = false
            if (normWinner) {
              const normKey = key.replace(/[\/:]/g, ':').toLowerCase()
              const normModel = String(cand.model || '').replace(/[\/:]/g, ':').toLowerCase()
              if (normWinner === normKey || normWinner === normModel || normWinner.endsWith(`:${normModel}`)) {
                isWin = true
              }
            }
            if (!isWin && typeof item.winnerIndex === 'number' && item.winnerIndex > 0) {
              if (cand.index === item.winnerIndex || candIdx === item.winnerIndex - 1) {
                isWin = true
              }
            }
            if (isWin) {
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

    const result = {
      totalRuns: presetFilter && presetFilter !== 'all' ? filteredRuns : totalRuns,
      models,
      preset: presetFilter,
    }
    _historyCache.leaderboards.set(filterKey, result)
    return result
  } catch (err) {
    logger.warn('[dsh-moa] Failed to calculate leaderboard:', err)
    return { totalRuns: 0, models: [] }
  }
}

/**
 * Retrieves a single history run by ID.
 */
export function getMoaRunById(runId, filePath = getDefaultHistoryFile()) {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const item = JSON.parse(lines[i])
        if (item && item.id === runId) return item
      } catch { /* corrupt line skipped */ }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Exports history data in JSON or CSV format with optional preset filtering.
 */
export function exportMoaHistory(filePath = getDefaultHistoryFile(), options = {}) {
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
      } catch { /* corrupt line skipped */ }
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
    logger.warn('[dsh-moa] Failed to export history:', err)
    return options?.format === 'csv' ? '' : '[]'
  }
}

/**
 * Formats candidate outputs for history storage (#169).
 */
export function candidatesForHistory(referenceOutputs) {
  return (referenceOutputs || []).map((r, i) => ({
    index: r.index ?? (i + 1),
    provider: r.slot?.provider || r.provider || "",
    model: r.slot?.model || r.model || "",
    slot: r.slot ? { provider: r.slot.provider, model: r.slot.model } : undefined,
    role: r.role_persona || r.slot?.role_persona || r.slot?.role || "general",
    temperature: r.temperature,
    wasFallback: Boolean(r.was_fallback),
    originalModel: r.original_model || null,
    files: (r.files || []).map((f) => f.relativePath || f),
    usage: r.usage || { inputTokens: 0, outputTokens: 0 },
    costUsd: r.costUsd || 0,
    testResult: r.testResult ? {
      passed: Boolean(r.testResult.passed),
      exitCode: r.testResult.exitCode ?? 0,
      summary: r.testResult.summary || '',
      durationMs: r.testResult.durationMs ?? 0,
    } : null,
  }))
}
