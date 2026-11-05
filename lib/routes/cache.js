/**
 * Semantic Cache Management Routes (#318)
 * Exposes inspection and purge endpoints for locally cached candidate generations.
 */

import { getSemanticCacheStats, clearSemanticCache } from '../pipeline/semantic-cache.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'

export function registerCacheRoutes(ctx, { workspaceRoot }) {
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/cache',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method === 'GET') {
          const stats = getSemanticCacheStats({ cwd: workspaceRoot })
          return writeJson(res, 200, { ok: true, stats })
        }
        if (req.method === 'POST') {
          if (!isSafeWriteRequest(req)) {
            return writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          }
          let olderThanMs = null
          try {
            const raw = await readBody(req)
            if (raw) {
              const body = JSON.parse(raw)
              if (typeof body.olderThanMs === 'number') olderThanMs = body.olderThanMs
            }
          } catch (_err) {
            /* ignore invalid body for clear */
          }
          const result = clearSemanticCache({ cwd: workspaceRoot, olderThanMs })
          return writeJson(res, 200, { ok: true, clearedCount: result.clearedCount })
        }
        return writeJson(res, 405, { ok: false, error: 'GET or POST required' })
      },
    })
  })
}
