import { getWebServer } from '../services.js'
/**
 * DeepSeek Harness Mixture of Agents (MoA) — Human Jury & Battle Arena Routes (#294)
 */

import {
  anonymizeCandidates,
  revealArenaSession,
  recordBattleVote,
  getArenaLeaderboard
} from '../pipeline/battle-arena.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'

export function registerBattleRoutes(ctx) {
  if (!ctx?.webServer?.register) return

  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'prefix',
      path: '/dsh-moa/arena',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        const url = new URL(req.url, 'http://localhost')
        const action = url.pathname.replace(/^\/dsh-moa\/arena\/?/, '')

        // GET /dsh-moa/arena/leaderboard
        if (req.method === 'GET' && action === 'leaderboard') {
          const board = getArenaLeaderboard()
          return writeJson(res, 200, { ok: true, ...board })
        }

        // Mutation routes require safe write checks
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

          // POST /dsh-moa/arena/anonymize
          if (action === 'anonymize') {
            const candidates = body.candidates || []
            const sessionId = body.sessionId || `session_${Date.now()}`
            const anonymized = anonymizeCandidates(candidates, sessionId)
            return writeJson(res, 200, { ok: true, sessionId, candidates: anonymized })
          }

          // POST /dsh-moa/arena/reveal
          if (action === 'reveal') {
            const result = revealArenaSession(body.sessionId)
            return writeJson(res, result.ok ? 200 : 404, result)
          }

          // POST /dsh-moa/arena/vote
          if (action === 'vote') {
            const result = recordBattleVote({
              sessionId: body.sessionId,
              winnerId: body.winnerId,
              scores: body.scores,
              notes: body.notes
            })
            return writeJson(res, 200, result)
          }
        }

        return writeJson(res, 404, { ok: false, error: 'Route not found' })
      }
    })
  }, 'dsh-moa: battle arena routes')
}
