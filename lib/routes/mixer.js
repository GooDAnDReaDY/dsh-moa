import { getWebServer } from '../services.js'
/**
 * DeepSeek Harness Mixture of Agents (MoA) — Block Mixer Routes (#296)
 */

import {
  parseCandidateBlocks,
  stitchCandidateBlocks,
  formatBlockMixerDirective
} from '../pipeline/block-mixer.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'

export function registerMixerRoutes(ctx) {
  if (!ctx?.webServer?.register) return

  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'prefix',
      path: '/dsh-moa/mixer',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        const url = new URL(req.url, 'http://localhost')
        const action = url.pathname.replace(/^\/dsh-moa\/mixer\/?/, '')

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

          // POST /dsh-moa/mixer/parse
          if (action === 'parse') {
            const text = body.text || ''
            const candidateLabel = body.candidateLabel || 'candidate'
            const blocks = parseCandidateBlocks(text, candidateLabel)
            return writeJson(res, 200, { ok: true, blocks, count: blocks.length })
          }

          // POST /dsh-moa/mixer/stitch
          if (action === 'stitch') {
            const blocks = body.blocks || []
            const userGoal = body.userGoal || ''
            const stitched = stitchCandidateBlocks(blocks)
            const directive = formatBlockMixerDirective(stitched, userGoal)
            return writeJson(res, 200, {
              ok: true,
              stitchedText: stitched.stitchedText,
              blockCount: stitched.blockCount,
              sources: stitched.sources,
              directive
            })
          }
        }

        return writeJson(res, 404, { ok: false, error: 'Route not found' })
      }
    })
  }, 'dsh-moa: block mixer routes')
}
