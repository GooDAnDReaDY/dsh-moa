import { getWebServer } from '../services.js'
import { getMoaHistory, getMoaLeaderboard, exportMoaHistory } from '../history.js'
import { writeJson, assertAuthorizedRequest } from '../access.js'

export function registerHistoryRoutes(ctx, { live }) {
  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/history',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET required' })
        try {
          const u = new URL(req.url, 'http://localhost')
          const limit = Math.max(1, Math.min(100, parseInt(u.searchParams.get('limit') || '20', 10) || 20))
          const offset = Math.max(0, parseInt(u.searchParams.get('offset') || '0', 10) || 0)
          const data = getMoaHistory(limit, offset)
          writeJson(res, 200, { ok: true, ...data })
        } catch (err) { writeJson(res, 500, { ok: false, error: err?.message || String(err) }) }
      },
    })
  }, 'dsh-moa: history route')

  // Route: /dsh-moa/leaderboard

  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/leaderboard',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET required' })
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const preset = url.searchParams.get('preset') || null
          const format = url.searchParams.get('format') || 'json'

          if (format === 'csv') {
            const csv = exportMoaHistory(undefined, { format: 'csv', preset })
            res.writeHead(200, {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="moa-leaderboard.csv"',
            })
            res.end(csv)
            return
          }

          const data = getMoaLeaderboard(undefined, { preset })
          writeJson(res, 200, { ok: true, ...data })
        } catch (err) { writeJson(res, 500, { ok: false, error: err?.message || String(err) }) }
      },
    })
  }, 'dsh-moa: leaderboard route')

  // Route: /dsh-moa/promote (Candidate Override Action)

  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/history/export',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET required' })
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const preset = url.searchParams.get('preset') || null
          const format = url.searchParams.get('format') || 'json'
          const data = exportMoaHistory(undefined, { format, preset })

          const isCsv = format === 'csv'
          res.writeHead(200, {
            'Content-Type': isCsv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="moa-history.${isCsv ? 'csv' : 'json'}"`,
          })
          res.end(data)
        } catch (err) { writeJson(res, 500, { ok: false, error: err?.message || String(err) }) }
      },
    })
  }, 'dsh-moa: history export route')

  // Route: /dsh-moa/runs/<id> (run replay by id and interactive workbench)
}
