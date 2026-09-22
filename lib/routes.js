/**
 * DeepSeek Harness Mixture of Agents (MoA) — HTTP Route Handlers
 */

import {
  getMoaHistory,
  getMoaLeaderboard,
  getMoaRunById,
  exportMoaHistory,
} from './history.js'
import { promoteCandidateWorkspace, readCandidateFiles, computeLineDiff, isSafeRelativePath } from './file-workspace.js'
import { isSafeWriteRequest } from './updater.js'
import { runMoAPipeline } from './moa-runner.js'

let _modelsCache = { timestamp: 0, models: [] }
const MODELS_CACHE_TTL = 60 * 1000

function writeJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let acc = ''
    req.on('data', (chunk) => {
      acc += chunk
      if (acc.length > 5 * 1024 * 1024) {
        req.destroy()
        reject(new Error('Payload Too Large'))
      }
    })
    req.on('end', () => resolve(acc))
    req.on('error', reject)
  })
}

export function registerMoaRoutes(ctx, { live, callLlm, liveCanvas, saveConfig, Config }) {

ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/status',
      handler: (_req, res) => {
        const cfg = live()
        writeJson(res, 200, {
          ok: true,
          enabled: cfg.enabled !== false,
          defaultPreset: cfg.default_preset || 'default',
          presetsCount: (cfg.presets || []).length,
        })
      },
    })
  }, 'dsh-moa: status route')

  // Route: /dsh-moa/models
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/models',
      handler: async (_req, res) => {
        if (_modelsCache.models.length > 0 && Date.now() - _modelsCache.timestamp < MODELS_CACHE_TTL) {
          writeJson(res, 200, { ok: true, models: _modelsCache.models, cached: true })
          return
        }

        const result = []
        const seen = new Set()

        const add = (p, m) => {
          if (!p || !m) return
          const key = `${p}:${m}`
          if (!seen.has(key)) {
            seen.add(key)
            result.push({ provider: p, model: m, label: key })
          }
        }

        if (ctx.llm) {
          try {
            if (typeof ctx.llm.listAvailableModels === 'function') {
              const list = await ctx.llm.listAvailableModels()
              for (const item of (list || [])) {
                if (item?.provider && item?.id) add(item.provider, item.id)
              }
            }
          } catch (e) {
            console.warn('[dsh-moa] ctx.llm.listAvailableModels error:', e)
          }

          try {
            if (typeof ctx.llm.listConfigurableProviders === 'function') {
              const cProvs = ctx.llm.listConfigurableProviders() || []
              const queries = cProvs.map(async (cp) => {
                const cpId = cp.provider || cp.id
                if (!cpId || typeof ctx.llm.listModels !== 'function') return
                try {
                  const mList = await Promise.race([
                    ctx.llm.listModels(cpId),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
                  ])
                  for (const m of (mList || [])) {
                    const mId = typeof m === 'string' ? m : (m?.id || m?.model || m?.name)
                    if (mId) add(cpId, mId)
                  }
                } catch {
                  /* provider query timeout or error handled best-effort */
                }
              })
              await Promise.allSettled(queries)
            }
          } catch (e) {
            console.warn('[dsh-moa] ctx.llm.listConfigurableProviders error:', e)
          }
        }

        // Query settings for configured providers
        try {
          const s = ctx.get ? ctx.get('settings') : ctx.settings
          const getSetting = (k) => {
            try { return s?.get?.(k) } catch { return undefined }
          }

          const def = getSetting('agent-default-model')
          if (def?.provider && def?.model) {
            add(def.provider, def.model)
          }

          const piAi = getSetting('llm-pi-ai')
          for (const [pName, pData] of Object.entries(piAi?.providers || {})) {
            for (const m of (pData?.models || [])) {
              const mId = typeof m === 'string' ? m : (m?.id || m?.model)
              if (mId) add(pName, mId)
            }
          }

          const sync = getSetting('dsh-model-sync')
          for (const [syncProv, syncModels] of Object.entries(sync?.modelCatalogs || {})) {
            for (const m of (syncModels || [])) {
              const mId = typeof m === 'string' ? m : (m?.id || m?.model)
              if (mId) add(syncProv, mId)
            }
          }
        } catch (e) {
          console.warn('[dsh-moa] Error reading settings:', e)
        }

        _modelsCache = { timestamp: Date.now(), models: result }
        writeJson(res, 200, { ok: true, models: result })
      },
    })
  }, 'dsh-moa: models route')

  // Route: /dsh-moa/presets
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/presets',
      handler: async (req, res) => {
        const cfg = live()
        if (req.method === 'GET') {
          writeJson(res, 200, {
            ok: true,
            defaultPreset: cfg.default_preset || 'default',
            presets: cfg.presets || [],
          })
          return
        }

        if (req.method === 'POST' || req.method === 'PUT') {
          if (!isSafeWriteRequest(req)) {
            writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
            return
          }
          try {
            const raw = await readBody(req)
            const payload = JSON.parse(raw)
            const newConfig = {
              enabled: typeof payload.enabled === 'boolean' ? payload.enabled : cfg.enabled !== false,
              default_preset: payload.default_preset || cfg.default_preset || 'default',
              presets: Array.isArray(payload.presets) ? payload.presets : (cfg.presets || []),
            }

            // Validate the merged payload through the plugin schema before it
            // reaches the settings storage: malformed payloads must be
            // rejected with 400 instead of being persisted.
            let validated
            try {
              validated = Config(structuredClone(newConfig))
            } catch (verr) {
              writeJson(res, 400, { ok: false, error: 'Invalid presets payload: ' + (verr?.message || String(verr)) })
              return
            }

            // Persist via saveConfig (in-memory and DSH profile settings)
            if (typeof saveConfig === 'function') {
              await saveConfig(validated)
            }

            writeJson(res, 200, {
              ok: true,
              enabled: validated.enabled !== false,
              defaultPreset: validated.default_preset,
              presets: validated.presets,
            })
          } catch (err) {
            writeJson(res, 400, { ok: false, error: err?.message || String(err) })
          }
          return
        }

        writeJson(res, 405, { ok: false, error: 'Method Not Allowed' })
      },
    })
  }, 'dsh-moa: presets route')

  // Route: /dsh-moa/history (#9)
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/history',
      handler: async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { ok: false, error: 'GET required' })
          return
        }
        try {
          const u = new URL(req.url, 'http://localhost')
          const limit = parseInt(u.searchParams.get('limit') || '20', 10)
          const offset = parseInt(u.searchParams.get('offset') || '0', 10)
          const data = getMoaHistory(limit, offset)
          writeJson(res, 200, { ok: true, ...data })
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: history route')

  // Route: /dsh-moa/leaderboard
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/leaderboard',
      handler: async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { ok: false, error: 'GET required' })
          return
        }
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
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: leaderboard route')

  // Route: /dsh-moa/promote (Candidate Override Action)
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/promote',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { ok: false, error: 'POST required' })
          return
        }
        if (!isSafeWriteRequest(req)) {
          writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          return
        }
        try {
          const raw = await readBody(req)
          const body = JSON.parse(raw || '{}')
          const candidateIndex = parseInt(body?.candidateIndex, 10)
          if (isNaN(candidateIndex) || candidateIndex < 1) {
            writeJson(res, 400, { ok: false, error: 'Valid candidateIndex required (>= 1)' })
            return
          }
          const cwd = body?.cwd || process.cwd()
          const promotedFiles = await promoteCandidateWorkspace(cwd, candidateIndex, { keepMoa: true })
          writeJson(res, 200, { ok: true, candidateIndex, promotedFiles, checkpoint: promotedFiles?.checkpoint || null })
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: promote candidate route')

  // Route: /dsh-moa/diff (Candidate Diff Viewer)
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/diff',
      handler: async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { ok: false, error: 'GET required' })
          return
        }
        try {
          const u = new URL(req.url, 'http://localhost')
          const cwd = u.searchParams.get('cwd') || process.cwd()
          const sanitizeTarget = (val, def) => {
            const clean = String(val || '').trim().replace(/[^a-zA-Z0-9_-]/g, '')
            return clean || def
          }
          const from = sanitizeTarget(u.searchParams.get('from'), '1')
          const to = sanitizeTarget(u.searchParams.get('to'), 'curator-synthesis')
          const rawFile = u.searchParams.get('file') || ''
          const file = (rawFile && isSafeRelativePath(rawFile)) ? rawFile : ''

          const fromFiles = await readCandidateFiles(cwd, from)
          const toFiles = await readCandidateFiles(cwd, to)

          // Collect all unique file paths
          const allPaths = Array.from(new Set([
            ...fromFiles.map((f) => f.relativePath),
            ...toFiles.map((f) => f.relativePath),
          ])).sort()

          const targetPath = file || allPaths[0] || ''
          const fromItem = fromFiles.find((f) => f.relativePath === targetPath)
          const toItem = toFiles.find((f) => f.relativePath === targetPath)

          const diff = targetPath
            ? computeLineDiff(fromItem?.content || '', toItem?.content || '')
            : []

          writeJson(res, 200, {
            ok: true,
            from,
            to,
            files: allPaths,
            selectedFile: targetPath,
            fromSize: fromItem?.size || 0,
            toSize: toItem?.size || 0,
            diff,
          })
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: candidate diff route')


  // Route: /dsh-moa/history/export
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/history/export',
      handler: async (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { ok: false, error: 'GET required' })
          return
        }
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const preset = url.searchParams.get('preset') || null
          const format = url.searchParams.get('format') || 'json'
          const data = exportMoaHistory(undefined, { format, preset })

          if (format === 'csv') {
            res.writeHead(200, {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="moa-history.csv"',
            })
            res.end(data)
            return
          }

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': 'attachment; filename="moa-history.json"',
          })
          res.end(data)
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: history export route')

  // Route: /dsh-moa/runs/<id> (run replay by id)
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'prefix',
      path: '/dsh-moa/runs/',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          writeJson(res, 405, { ok: false, error: 'GET required' })
          return
        }
        const urlPath = req.url.split('?')[0]
        const parts = urlPath.split('/').filter(Boolean)
        const runId = parts[2] || ''
        const run = runId ? getMoaRunById(runId) : null
        if (!run) {
          writeJson(res, 404, { ok: false, error: 'Run not found' })
          return
        }
        writeJson(res, 200, { ok: true, run })
      },
    })
  }, 'dsh-moa: run by id route')

  // Route: /dsh-moa/run
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/run',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { ok: false, error: 'POST required' })
          return
        }
        if (!isSafeWriteRequest(req)) {
          writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
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

          const cfg = live()
          if (cfg.enabled === false) {
            writeJson(res, 400, { ok: false, error: 'MoA is disabled in settings' })
            return
          }
          const presetName = payload.preset || cfg.default_preset || 'default'
          const preset = (cfg.presets || []).find((p) => p.name === presetName) || cfg.presets?.[0]

          const result = await runMoAPipeline({
            userPrompt: prompt,
            messages: payload.messages || [],
            preset,
            callLlm,
            cwd: payload.cwd || process.cwd(),
            prices: cfg.prices || {},
            liveCanvas,
          })

          if (result?.skippedFiles > 0) {
            ctx.logger?.warn?.(`[dsh-moa] Workspace scan skipped ${result.skippedFiles} file(s): ${result.skippedList.join(', ')}`)
          }

          writeJson(res, 200, { ok: true, ...result })
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: run pipeline route')
}
