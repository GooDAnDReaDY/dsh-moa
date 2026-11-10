import { getWebServer } from '../services.js'
import { bestEffort } from '../best-effort.js'
import { validateAllPresets } from '../moa-model-validator.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'
import { resolvePresetForPrompt } from '../moa-router.js'

let _modelsCache = { timestamp: 0, models: [] }
const MODELS_CACHE_TTL = 60 * 1000

export function registerPresetRoutes(ctx, { live, callLlm, saveConfig, Config, plainConfig }) {
ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/status',
      handler: (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET required' })
        try {
          const cfg = live()
          writeJson(res, 200, {
            ok: true,
            enabled: cfg.enabled !== false,
            defaultPreset: cfg.default_preset || 'default',
            presetsCount: (cfg.presets || []).length,
          })
        } catch (err) { writeJson(res, 500, { ok: false, error: err?.message || String(err) }) }
      },
    })
  }, 'dsh-moa: status route')

  // Route: /dsh-moa/models

  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/models',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET required' })
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
            ctx.logger?.warn?.('[dsh-moa] ctx.llm.listAvailableModels error:', e)
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
            ctx.logger?.warn?.('[dsh-moa] ctx.llm.listConfigurableProviders error:', e)
          }
        }

        // Query settings for configured providers
        try {
          let s = null
          try { s = ctx.get ? ctx.get('settings') : null } catch { s = null }
          const getSetting = (k) => { try { return s?.get?.(k) } catch { return undefined } }

          const def = getSetting('agent-default-model')
          if (def?.provider && def?.model) add(def.provider, def.model)

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
          ctx.logger?.warn?.('[dsh-moa] Error reading settings:', e)
        }

        _modelsCache = { timestamp: Date.now(), models: result }
        writeJson(res, 200, { ok: true, models: result })
      },
    })
  }, 'dsh-moa: models route')

  // Route: /dsh-moa/presets

  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/presets',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        const cfg = live()
        if (req.method === 'GET') {
          const validation = await bestEffort('validate presets on GET', () => validateAllPresets(cfg.presets || [], ctx), ctx?.logger) ?? null
          writeJson(res, 200, {
            ok: true,
            defaultPreset: cfg.default_preset || 'default',
            presets: cfg.presets || [],
            validation,
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
              ...cfg,
              enabled: typeof payload.enabled === 'boolean' ? payload.enabled : cfg.enabled !== false,
              default_preset: payload.default_preset || cfg.default_preset || 'default',
              presets: Array.isArray(payload.presets) ? payload.presets : (cfg.presets || []),
              ...(payload.prices !== undefined ? { prices: payload.prices } : {}),
              ...(payload.smart_routing_enabled !== undefined ? { smart_routing_enabled: payload.smart_routing_enabled } : {}),
              ...(payload.smart_routing_model !== undefined ? { smart_routing_model: payload.smart_routing_model } : {}),
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
            let persistResult
            if (typeof saveConfig === 'function') {
              try { persistResult = await saveConfig(validated) }
              catch (perr) { return writeJson(res, 500, { ok: false, error: 'Settings persistence failed: ' + (perr?.message || String(perr)) }) }
            }

            const unwrapped = typeof plainConfig === 'function' ? plainConfig(validated) : validated
            const validation = await bestEffort('validate presets on write', () => validateAllPresets(unwrapped.presets || [], ctx), ctx?.logger) ?? null
            writeJson(res, 200, {
              ok: true,
              persisted: persistResult?.persisted ?? false,
              enabled: unwrapped.enabled !== false,
              defaultPreset: unwrapped.default_preset,
              presets: unwrapped.presets,
              validation,
            })
          } catch (err) { writeJson(res, 400, { ok: false, error: err?.message || String(err) }) }
          return
        }

        writeJson(res, 405, { ok: false, error: 'Method Not Allowed' })
      },
    })
  }, 'dsh-moa: presets route')

  // Route: /dsh-moa/history (#9)

  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/route-preset',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST required' })
        if (!isSafeWriteRequest(req)) {
          writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          return
        }
        try {
          const cfg = live()
          if (cfg.enabled === false) {
            writeJson(res, 400, { ok: false, error: 'MoA is disabled in settings' })
            return
          }
          const raw = await readBody(req)
          const body = JSON.parse(raw || '{}')
          const prompt = body?.prompt || ''
          const activePreset = (cfg.presets || []).find((p) => p.name === (cfg.default_preset || 'default')) || cfg.presets?.[0]
          const routingModel = (activePreset?.smart_routing_model?.model && activePreset.smart_routing_model)
            || (cfg.smart_routing_model?.model && cfg.smart_routing_model) || activePreset?.smart_routing_model || cfg.smart_routing_model
          const result = await resolvePresetForPrompt({
            prompt,
            presets: cfg.presets || [],
            defaultPreset: cfg.default_preset || 'default',
            routingModel,
            callLlm,
            enabled: cfg.enabled !== false,
          })
          writeJson(res, 200, { ok: true, ...result })
        } catch (err) { writeJson(res, 500, { ok: false, error: err?.message || String(err) }) }
      },
    })
  }, 'dsh-moa: route preset endpoint')

  let _lastRunTimestamp = 0
  const RUN_MIN_INTERVAL_MS = 1000

  // Route: /dsh-moa/run
}
