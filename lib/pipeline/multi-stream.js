/**
 * Multi-Column Live Streaming Hub for Parallel Candidates (#295)
 *
 * Multiplexes streaming outputs from parallel candidates into isolated visual columns:
 * 1. Tracks live TTFT (Time to First Token) and generation speed (tokens/sec).
 * 2. Broadcasts Server-Sent Events (SSE) per candidate index.
 * 3. Eliminates blocking wait for slowest candidates through independent stream buffers.
 */

import { emitEvent, MOA_EVENTS } from '../events.js'
import { logger } from '../logger.js'

class MultiStreamHub {
  constructor() {
    this.sessions = new Map()
    this.cleanupInterval = setInterval(() => this.pruneStaleSessions(), 5 * 60 * 1000)
    if (this.cleanupInterval?.unref) this.cleanupInterval.unref()
  }

  pruneStaleSessions() {
    const cutoff = Date.now() - 30 * 60 * 1000 // 30 mins
    for (const [id, session] of this.sessions.entries()) {
      if (session.createdAt < cutoff) {
        for (const res of session.listeners) {
          try { res.end() } catch (_e) {}
        }
        this.sessions.delete(id)
      }
    }
  }

  initSession(sessionId, candidates = [], ctx = null) {
    if (!sessionId) return null
    const existing = this.sessions.get(sessionId)
    if (existing) return existing

    const session = {
      sessionId,
      ctx,
      createdAt: Date.now(),
      listeners: new Set(),
      candidates: (candidates || []).map((c, idx) => ({
        index: c.index || (idx + 1),
        label: c.label || `Candidate ${idx + 1}`,
        model: c.model || '',
        provider: c.provider || '',
        role_persona: c.role_persona || 'general',
        status: 'streaming', // 'waiting' | 'streaming' | 'done' | 'error'
        startTime: Date.now(),
        firstTokenTime: null,
        ttftMs: null,
        tokensCount: 0,
        tokPerSec: 0,
        text: '',
        error: null,
      })),
    }

    this.sessions.set(sessionId, session)
    return session
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null
  }

  pushDelta(sessionId, candidateIndex, textDelta) {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    const cand = session.candidates.find((c) => c.index === candidateIndex)
    if (!cand) return false

    const now = Date.now()
    if (!cand.firstTokenTime) {
      cand.firstTokenTime = now
      cand.ttftMs = now - cand.startTime
    }

    const deltaStr = String(textDelta || '')
    cand.text += deltaStr
    // Approximate tokens by chunks / words (avg 4 chars/tok)
    const addedTokens = Math.max(1, Math.round(deltaStr.length / 4))
    cand.tokensCount += addedTokens

    const elapsedFromFirst = (now - cand.firstTokenTime) / 1000
    if (elapsedFromFirst > 0.1) {
      cand.tokPerSec = Number((cand.tokensCount / elapsedFromFirst).toFixed(1))
    }

    const payload = {
      type: 'delta',
      sessionId,
      candidateIndex,
      delta: deltaStr,
      ttftMs: cand.ttftMs,
      tokPerSec: cand.tokPerSec,
      totalTokens: cand.tokensCount,
      status: 'streaming',
    }

    this.broadcast(session, 'candidate-delta', payload)
    emitEvent(session.ctx, MOA_EVENTS.CANDIDATE_STREAM_DELTA, payload)
    return true
  }

  finishCandidate(sessionId, candidateIndex, { ok = true, error = null } = {}) {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    const cand = session.candidates.find((c) => c.index === candidateIndex)
    if (!cand) return false

    cand.status = ok ? 'done' : 'error'
    cand.error = error ? (error.message || String(error)) : null
    const durationMs = Date.now() - cand.startTime

    const payload = {
      type: 'finish',
      sessionId,
      candidateIndex,
      status: cand.status,
      durationMs,
      ttftMs: cand.ttftMs || durationMs,
      totalTokens: cand.tokensCount,
      tokPerSec: cand.tokPerSec,
      error: cand.error,
    }

    this.broadcast(session, 'candidate-finish', payload)
    emitEvent(session.ctx, MOA_EVENTS.CANDIDATE_STREAM_FINISH, payload)

    // Check if all candidates are finished
    const allDone = session.candidates.every((c) => c.status === 'done' || c.status === 'error')
    if (allDone) {
      this.broadcast(session, 'session-complete', {
        sessionId,
        candidatesCount: session.candidates.length,
        totalDurationMs: Date.now() - session.createdAt,
      })
    }
    return true
  }

  broadcast(session, eventName, data) {
    if (!session || !session.listeners || session.listeners.size === 0) return
    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of session.listeners) {
      try {
        res.write(message)
      } catch (err) {
        logger.debug('[dsh-moa:multi-stream] Listener write error:', err?.message || err)
        session.listeners.delete(res)
      }
    }
  }

  subscribe(sessionId, req, res) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Stream session not found or expired' }))
      return false
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // Send initial snapshot
    const initPayload = {
      type: 'init',
      sessionId,
      candidates: session.candidates.map((c) => ({
        index: c.index,
        label: c.label,
        model: c.model,
        provider: c.provider,
        role_persona: c.role_persona,
        status: c.status,
        ttftMs: c.ttftMs,
        tokPerSec: c.tokPerSec,
        tokensCount: c.tokensCount,
        text: c.text,
      })),
    }
    res.write(`event: session-init\ndata: ${JSON.stringify(initPayload)}\n\n`)

    session.listeners.add(res)
    req.on('close', () => {
      session.listeners.delete(res)
    })
    return true
  }

  getStatus(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return {
      sessionId,
      createdAt: session.createdAt,
      activeListeners: session.listeners.size,
      candidates: session.candidates.map((c) => ({
        index: c.index,
        label: c.label,
        model: c.model,
        provider: c.provider,
        role_persona: c.role_persona,
        status: c.status,
        durationMs: Date.now() - c.startTime,
        ttftMs: c.ttftMs,
        tokPerSec: c.tokPerSec,
        tokensCount: c.tokensCount,
        textLength: c.text.length,
        error: c.error,
      })),
    }
  }
}

export const multiStreamHub = new MultiStreamHub()
