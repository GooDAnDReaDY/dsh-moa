/**
 * AST Consensus Heatmap Routes (#297)
 *
 * Exposes endpoints:
 * - POST /dsh-moa/ast-heatmap: Computes line-by-line consensus heatmap and contested blocks
 * - POST /dsh-moa/ast-heatmap/apply: Resolves contested blocks based on user picks
 */

import { computeConsensusHeatmap, resolveContestedBlocks } from '../pipeline/ast-heatmap.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'

export function registerHeatmapRoutes(ctx) {
  // 1. Compute Heatmap: /dsh-moa/ast-heatmap
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/ast-heatmap',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        if (req.method !== 'POST') {
          return writeJson(res, 405, { ok: false, error: 'Method Not Allowed' })
        }

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

        const file = body.file || 'output.js'
        const candidates = Array.isArray(body.candidates) ? body.candidates : []
        const heatmap = computeConsensusHeatmap(file, candidates, { ctx })

        return writeJson(res, 200, { ok: true, heatmap })
      },
    })
  })

  // 2. Apply Contested Block Selection: /dsh-moa/ast-heatmap/apply
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/ast-heatmap/apply',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        if (req.method !== 'POST') {
          return writeJson(res, 405, { ok: false, error: 'Method Not Allowed' })
        }

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

        const baseCode = body.baseCode || ''
        const contestedBlocks = Array.isArray(body.contestedBlocks) ? body.contestedBlocks : []
        const selections = body.selections || {}

        const resolvedCode = resolveContestedBlocks(baseCode, contestedBlocks, selections)
        return writeJson(res, 200, { ok: true, code: resolvedCode })
      },
    })
  })
}
