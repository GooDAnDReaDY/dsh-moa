import { getWebServer } from '../services.js'
/**
 * DeepSeek Harness Mixture of Agents (MoA) — Decision Timeline Routes (#320)
 */

import {
  recordTimelineStage,
  getTimelineSession,
  listTimelineSessions,
  forkTimelineSession
} from '../pipeline/decision-timeline.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'

export function registerTimelineRoutes(ctx) {
  if (!ctx?.webServer?.register) return

  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'prefix',
      path: '/dsh-moa/timeline',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        const url = new URL(req.url, 'http://localhost')
        const action = url.pathname.replace(/^\/dsh-moa\/timeline\/?/, '')

        // GET /dsh-moa/timeline/sessions
        if (req.method === 'GET') {
          if (action === 'sessions') {
            const sessions = listTimelineSessions()
            return writeJson(res, 200, { ok: true, sessions })
          }
          // GET /dsh-moa/timeline/:sessionId
          if (action.length > 0) {
            const session = getTimelineSession(action)
            if (!session) {
              return writeJson(res, 404, { ok: false, error: 'Timeline session not found' })
            }
            return writeJson(res, 200, { ok: true, session })
          }
        }

        if (req.method === 'POST') {
          if (!isSafeWriteRequest(req)) {
            return writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          }

          let body = {}
          try {
            const raw = await readBody(req)
            body = JSON.parse(raw || '{}')
          } catch {
            return writeJson(res, 400, { ok: false, error: 'Invalid JSON body' })
          }

          // POST /dsh-moa/timeline/record
          if (action === 'record') {
            const entry = recordTimelineStage(body.sessionId, body.stage, body.data, body.options || {})
            return writeJson(res, 200, { ok: true, entry })
          }

          // POST /dsh-moa/timeline/fork
          if (action === 'fork') {
            const result = forkTimelineSession(body.sessionId, body.fromStageIndex, body.overrides || {})
            return writeJson(res, result.ok ? 200 : 400, result)
          }
        }

        return writeJson(res, 404, { ok: false, error: 'Route not found' })
      }
    })
  }, 'dsh-moa: decision timeline routes')
}
