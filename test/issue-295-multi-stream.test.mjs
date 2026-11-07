import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { multiStreamHub } from '../lib/pipeline/multi-stream.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #295 - Multi-Column Live Streaming for Parallel Candidates', () => {
  const sessionId = 'test-session-295'

  beforeEach(() => {
    multiStreamHub.sessions.delete(sessionId)
  })

  it('initializes a multi-candidate stream session correctly', () => {
    const candidates = [
      { index: 1, label: 'Model A', model: 'gpt-4o' },
      { index: 2, label: 'Model B', model: 'claude-3-5-sonnet' },
    ]
    const session = multiStreamHub.initSession(sessionId, candidates)
    assert.ok(session)
    assert.strictEqual(session.sessionId, sessionId)
    assert.strictEqual(session.candidates.length, 2)
    assert.strictEqual(session.candidates[0].status, 'streaming')
    assert.strictEqual(session.candidates[0].tokensCount, 0)
    assert.strictEqual(session.candidates[0].ttftMs, null)
  })

  it('measures TTFT on first token chunk and calculates tok/s speed', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    multiStreamHub.initSession(sessionId, [
      { index: 1, label: 'Model A' },
      { index: 2, label: 'Model B' },
    ], mockCtx)

    // Wait a brief delay to simulate latency for TTFT
    await new Promise((resolve) => setTimeout(resolve, 20))

    const chunk1 = 'export function calculateMetrics() {'
    const ok1 = multiStreamHub.pushDelta(sessionId, 1, chunk1)
    assert.strictEqual(ok1, true)

    const status1 = multiStreamHub.getStatus(sessionId)
    const cand1 = status1.candidates.find((c) => c.index === 1)
    assert.ok(cand1.ttftMs !== null && cand1.ttftMs >= 15)
    assert.ok(cand1.tokensCount > 0)
    assert.strictEqual(cand1.textLength, chunk1.length)

    // Send second chunk
    multiStreamHub.pushDelta(sessionId, 1, '\n  return 42;\n}')
    const status2 = multiStreamHub.getStatus(sessionId)
    const cand1v2 = status2.candidates.find((c) => c.index === 1)
    assert.ok(cand1v2.tokensCount > cand1.tokensCount)

    assert.ok(events.some((e) => e.evt === MOA_EVENTS.CANDIDATE_STREAM_DELTA))
  })

  it('marks candidate finished and emits completion events', () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    multiStreamHub.initSession(sessionId, [
      { index: 1, label: 'Model A' },
    ], mockCtx)

    multiStreamHub.pushDelta(sessionId, 1, 'const x = 1;')
    const finished = multiStreamHub.finishCandidate(sessionId, 1, { ok: true })
    assert.strictEqual(finished, true)

    const status = multiStreamHub.getStatus(sessionId)
    assert.strictEqual(status.candidates[0].status, 'done')
    assert.ok(status.candidates[0].durationMs >= 0)

    const finishEvt = events.find((e) => e.evt === MOA_EVENTS.CANDIDATE_STREAM_FINISH)
    assert.ok(finishEvt)
    assert.strictEqual(finishEvt.payload.candidateIndex, 1)
    assert.strictEqual(finishEvt.payload.status, 'done')
  })

  it('subscribes SSE listener and writes events to HTTP stream', (t, done) => {
    multiStreamHub.initSession(sessionId, [
      { index: 1, label: 'Model A' },
    ])

    const req = new PassThrough()
    const res = new PassThrough()
    let written = ''

    res.writeHead = (status, headers) => {
      assert.strictEqual(status, 200)
      assert.strictEqual(headers['Content-Type'], 'text/event-stream')
    }
    res.write = (chunk) => {
      written += chunk
    }

    const subscribed = multiStreamHub.subscribe(sessionId, req, res)
    assert.strictEqual(subscribed, true)

    // Initial snapshot should have been written
    assert.ok(written.includes('event: session-init'))
    assert.ok(written.includes('Model A'))

    // Push new delta
    multiStreamHub.pushDelta(sessionId, 1, 'hello streaming')
    assert.ok(written.includes('event: candidate-delta'))
    assert.ok(written.includes('hello streaming'))

    req.emit('close')
    const session = multiStreamHub.getSession(sessionId)
    assert.strictEqual(session.listeners.size, 0)
    done()
  })
})
