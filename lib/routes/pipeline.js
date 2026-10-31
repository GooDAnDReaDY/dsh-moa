import path from 'node:path'
import os from 'node:os'
import { isTestEnvironment } from '../history.js'
import { isLoopbackUrl } from '../file-workspace.js'
import { runMoAPipeline } from '../moa-runner.js'
import { writeJson, readBody, isAllowedWorkspace, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'


export function registerPipelineRoutes(ctx, { live, callLlm, liveCanvas, webServerPort, timeMachineEngine, workspaceRoot }) {
  let _lastRunTimestamp = 0
  const RUN_MIN_INTERVAL_MS = 1000

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/run',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST required' })
        if (!isSafeWriteRequest(req)) {
          writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          return
        }
        const now = Date.now()
        if (now - _lastRunTimestamp < RUN_MIN_INTERVAL_MS) {
          writeJson(res, 429, { ok: false, error: 'Rate limit exceeded: please wait before starting another run' })
          return
        }

        try {
          const raw = await readBody(req)
          const payload = JSON.parse(raw)
          const prompt = payload.prompt || ''
          if (!prompt.trim()) {
            writeJson(res, 400, { ok: false, error: 'Empty prompt' })
            return
          }
          _lastRunTimestamp = now

          const cfg = live()
          if (cfg.enabled === false) {
            writeJson(res, 400, { ok: false, error: 'MoA is disabled in settings' })
            return
          }
          if (payload.timeMachineUrl && !isLoopbackUrl(payload.timeMachineUrl)) {
            writeJson(res, 400, { ok: false, error: 'Invalid timeMachineUrl: loopback host required' })
            return
          }
          const presetName = payload.preset || cfg.default_preset || 'default'
          const preset = (cfg.presets || []).find((p) => p.name === presetName) || cfg.presets?.[0]

          const baseWorkspaceRoot = workspaceRoot || ctx?.reflect?.get?.('baseDir', false) || ctx?.reflect?.get?.('workspaceDir', false) || process.cwd()
          const allowedRoots = [
            baseWorkspaceRoot,
            process.cwd(),
            cfg.workspace_root,
            ...(Array.isArray(cfg.allowed_workspaces) ? cfg.allowed_workspaces : (cfg.allowed_workspaces ? [cfg.allowed_workspaces] : [])),
            ...(isTestEnvironment() ? [os.tmpdir()] : []),
          ].filter(Boolean)

          const targetCwd = payload.cwd ? path.resolve(payload.cwd) : baseWorkspaceRoot
          if (payload.cwd && !isAllowedWorkspace(targetCwd, allowedRoots)) {
            writeJson(res, 403, { ok: false, error: 'Forbidden: cwd escapes allowed workspace boundary' })
            return
          }

          const result = await runMoAPipeline({
            userPrompt: prompt, messages: payload.messages || [], preset, callLlm,
            cwd: targetCwd, prices: cfg.prices || {}, liveCanvas,
            webServerPort: webServerPort || ctx.webServer?.port,
            timeMachineEngine: timeMachineEngine || ctx.reflect?.get?.('timeMachineEngine', false),
            timeMachineUrl: payload.timeMachineUrl, force: false,
            checkpoint: true,
            runId: payload.runId,
          })

          if (result?.skippedFiles > 0) {
            ctx.logger?.warn?.(`[dsh-moa] Workspace scan skipped ${result.skippedFiles} file(s): ${result.skippedList.join(', ')}`)
          }
          if (result?.error) {
            writeJson(res, 500, { ok: false, error: result.error?.message || String(result.error) })
            return
          }

          writeJson(res, 200, { ok: true, ...result })
        } catch (err) { writeJson(res, 500, { ok: false, error: err?.message || String(err) }) }
      },
    })
  }, 'dsh-moa: run pipeline route')
}
