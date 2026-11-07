/**
 * DeepSeek Harness Mixture of Agents (MoA) — Historical Decision Timeline & Forking (#320)
 * Records granular phase snapshots across execution stages and allows time-travel forking.
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

export const DEFAULT_TIMELINE_FILE = path.join(getBaseDshDir(), 'moa', 'timeline_sessions.json')

// In-memory active timeline sessions buffer
const activeTimelineSessions = new Map()

export function getTimelineFilePath(customPath = null) {
  if (customPath && typeof customPath === 'string' && customPath.trim().length > 0) {
    return path.resolve(customPath)
  }
  if (process.env.DSH_MOA_TIMELINE_PATH) {
    return path.resolve(process.env.DSH_MOA_TIMELINE_PATH)
  }
  return DEFAULT_TIMELINE_FILE
}

export function loadTimelineStorage(customPath = null) {
  const target = getTimelineFilePath(customPath)
  if (!fs.existsSync(target)) {
    return { version: 1, sessions: {} }
  }
  try {
    const raw = fs.readFileSync(target, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      version: parsed.version || 1,
      sessions: parsed.sessions || {}
    }
  } catch {
    return { version: 1, sessions: {} }
  }
}

export function saveTimelineStorage(data, customPath = null) {
  const target = getTimelineFilePath(customPath)
  const dir = path.dirname(target)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const cleanData = {
    version: data?.version || 1,
    sessions: data?.sessions || {}
  }
  fs.writeFileSync(target, JSON.stringify(cleanData, null, 2), 'utf-8')
  return true
}

/**
 * Initializes or retrieves a timeline session
 */
export function getOrCreateTimelineSession(sessionId, metadata = {}) {
  if (activeTimelineSessions.has(sessionId)) {
    return activeTimelineSessions.get(sessionId)
  }

  const storage = loadTimelineStorage()
  if (storage.sessions[sessionId]) {
    activeTimelineSessions.set(sessionId, storage.sessions[sessionId])
    return storage.sessions[sessionId]
  }

  const newSession = {
    sessionId,
    createdAt: Date.now(),
    prompt: metadata.prompt || '',
    metadata: { ...metadata },
    stages: []
  }

  activeTimelineSessions.set(sessionId, newSession)
  return newSession
}

/**
 * Records an execution phase snapshot into the session timeline.
 */
export function recordTimelineStage(sessionId, stageName, payload = {}, options = {}) {
  const session = getOrCreateTimelineSession(sessionId, options.metadata)
  
  const stageEntry = {
    index: session.stages.length,
    stage: stageName,
    timestamp: Date.now(),
    durationMs: options.durationMs || 0,
    summary: options.summary || `Phase ${stageName} completed`,
    data: payload
  }

  session.stages.push(stageEntry)

  // Persist if flagged or on terminal stages
  if (options.persist || stageName === 'synthesis' || stageName === 'promotion') {
    const storage = loadTimelineStorage(options.customPath)
    storage.sessions[sessionId] = session
    // Cap stored sessions at 100
    const keys = Object.keys(storage.sessions)
    if (keys.length > 100) {
      delete storage.sessions[keys[0]]
    }
    saveTimelineStorage(storage, options.customPath)
  }

  return stageEntry
}

/**
 * Retrieves timeline session by ID
 */
export function getTimelineSession(sessionId, customPath = null) {
  if (activeTimelineSessions.has(sessionId)) {
    return activeTimelineSessions.get(sessionId)
  }
  const storage = loadTimelineStorage(customPath)
  return storage.sessions[sessionId] || null
}

/**
 * Lists recent timeline sessions
 */
export function listTimelineSessions(customPath = null, limit = 20) {
  const storage = loadTimelineStorage(customPath)
  const sessions = Object.values(storage.sessions || {})
  sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return sessions.slice(0, limit).map((s) => ({
    sessionId: s.sessionId,
    createdAt: s.createdAt,
    prompt: s.prompt ? s.prompt.slice(0, 100) : '',
    stageCount: s.stages?.length || 0,
    stages: s.stages?.map((st) => st.stage) || []
  }))
}

/**
 * Forks a timeline session from a specified stage index
 */
export function forkTimelineSession(sessionId, fromStageIndex, overrides = {}, customPath = null) {
  const original = getTimelineSession(sessionId, customPath)
  if (!original) {
    return { ok: false, error: 'Original session not found' }
  }

  const stageIdx = Number(fromStageIndex)
  if (isNaN(stageIdx) || stageIdx < 0 || stageIdx >= original.stages.length) {
    return { ok: false, error: 'Invalid fromStageIndex' }
  }

  const forkedSessionId = `fork_${sessionId}_${Date.now()}`
  const forkedStages = original.stages.slice(0, stageIdx + 1).map((st, i) => ({
    ...st,
    index: i,
    forkedFrom: sessionId
  }))

  const forkedSession = {
    sessionId: forkedSessionId,
    createdAt: Date.now(),
    parentSessionId: sessionId,
    forkedFromStage: original.stages[stageIdx].stage,
    prompt: overrides.prompt || original.prompt,
    metadata: { ...original.metadata, ...overrides.metadata },
    stages: forkedStages
  }

  activeTimelineSessions.set(forkedSessionId, forkedSession)
  const storage = loadTimelineStorage(customPath)
  storage.sessions[forkedSessionId] = forkedSession
  saveTimelineStorage(storage, customPath)

  return {
    ok: true,
    forkedSessionId,
    session: forkedSession
  }
}
