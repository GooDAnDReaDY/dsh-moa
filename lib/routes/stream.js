import { getWebServer } from '../services.js'
/**
 * Multi-Column Live Streaming Routes (#295)
 *
 * Exposes SSE and status endpoints:
 * - GET /dsh-moa/stream/:sessionId: Server-Sent Events stream for candidate columns
 * - GET /dsh-moa/stream/:sessionId/status: JSON status with TTFT and tok/s metrics
 * - POST /dsh-moa/stream/init: Initializes a streaming session
 * - POST /dsh-moa/stream/delta: Pushes delta token chunk
 * - POST /dsh-moa/stream/finish: Marks candidate complete or errored
 */

import { multiStreamHub } from '../pipeline/multi-stream.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'

export function registerStreamRoutes(ctx) {
  // 1. SSE Stream: /dsh-moa/stream (prefix route matching /dsh-moa/stream/:sessionId)
  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'prefix',
      path: '/dsh-moa/stream',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        const url = new URL(req.url, 'http://localhost')
        const parts = url.pathname.replace(/^\/dsh-moa\/stream\/?/, '').split('/')
        const sessionId = parts[0]
        const action = parts[1] || ''

        if (!sessionId) {
          return writeJson(res, 400, { ok: false, error: 'Session ID is required' })
        }

        // GET /dsh-moa/stream/:sessionId/status
        if (req.method === 'GET' && action === 'status') {
          const status = multiStreamHub.getStatus(sessionId)
          if (!status) {
            return writeJson(res, 404, { ok: false, error: 'Session not found' })
          }
          return writeJson(res, 200, { ok: true, session: status })
        }

        // GET /dsh-moa/stream/:sessionId -> SSE
        if (req.method === 'GET' && !action) {
          const ok = multiStreamHub.subscribe(sessionId, req, res)
          if (!ok) {
            return writeJson(res, 404, { ok: false, error: 'Stream session not found' })
          }
          return
        }

        // Write endpoints
        if (req.method === 'POST') {
          if (!isSafeWriteRequest(req)) {
            return writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site write rejected' })
          }

          let body = {}
          try {
            const raw = await readBody(req)
            if (raw) body = JSON.parse(raw)
          } catch (_e) {
            return writeJson(res, 400, { ok: false, error: 'Malformed JSON payload' })
          }

          if (sessionId === 'init' || action === 'init') {
            const targetId = body.sessionId || sessionId
            const session = multiStreamHub.initSession(targetId, body.candidates || [], ctx)
            return writeJson(res, 200, { ok: true, sessionId: targetId, session: multiStreamHub.getStatus(targetId) })
          }

          if (action === 'delta') {
            const candidateIndex = Number(body.candidateIndex || 1)
            const success = multiStreamHub.pushDelta(sessionId, candidateIndex, body.delta || '')
            return writeJson(res, success ? 200 : 404, { ok: success })
          }

          if (action === 'finish') {
            const candidateIndex = Number(body.candidateIndex || 1)
            const success = multiStreamHub.finishCandidate(sessionId, candidateIndex, {
              ok: body.ok !== false,
              error: body.error ? new Error(body.error) : null,
            })
            return writeJson(res, success ? 200 : 404, { ok: success })
          }
        }

        return writeJson(res, 405, { ok: false, error: 'Method Not Allowed' })
      },
    })
  })
}
