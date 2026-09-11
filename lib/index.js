import { refreshCatalogInBackground } from './pricing.js'
/**
 * DeepSeek Harness Mixture of Agents (MoA) Plugin
 *
 * Implements an intelligent ensemble pipeline:
 * 1. User issues /moa <prompt>
 * 2. Parallel candidate proposers write to isolated workspaces (.moa/candidate-X/)
 * 3. Aggregator evaluates and synthesizes the optimal solution
 * 4. Winner candidate files are promoted to the project root
 * 5. Native cost tracking, history logging and leaderboard analytics
 */

import z from '@deepseek-ai/schemastery'
import path from 'node:path'
import os from 'node:os'
import {
  parseMoACommand,
  runMoAPipeline,
  streamMoATurn,
} from './moa-runner.js'

import {
  getMoaHistory,
  getMoaLeaderboard,
  getMoaRunById,
} from './history.js'

import { createLiveCanvasClient } from './live-canvas.js'

export const name = 'dsh-moa'
export const inject = ['webServer', 'llm', 'settings', 'sessions', 'tools']

export const NS = 'dsh-moa'

export const PriceRow = z.object({
  input: z.number().default(0),
  output: z.number().default(0),
  cacheHit: z.number().default(0),
})

export const ModelSlotSchema = z.object({
  provider: z.string().default('opencode-go'),
  model: z.string().default('deepseek-v4-flash'),
})

export const PresetSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  ask_clarifying_questions: z.boolean().default(true),
  reference_models: z.array(ModelSlotSchema).default([]),
  aggregator: ModelSlotSchema.default({ provider: 'codex', model: 'gpt-5.6-sol' }),
  reference_temperature: z.number().default(0.6),
  aggregator_temperature: z.number().default(0.4),
  max_tokens: z.number().default(4096),
  judge_criteria: z.string().default(''),
})

export const Config = z.object({
  enabled: z.boolean().default(true),
  default_preset: z.string().default('default'),
  prices: z.dict(PriceRow).default({}),
  presets: z.array(PresetSchema).default([
    {
      name: 'default',
      enabled: true,
      ask_clarifying_questions: true,
      reference_models: [
        { provider: 'opencode-go', model: 'deepseek-v4-flash' },
        { provider: 'grok', model: 'grok-build-0.1' },
      ],
      aggregator: { provider: 'codex', model: 'gpt-5.6-sol' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.4,
      max_tokens: 4096,
      judge_criteria: '',
    },
    {
      name: 'fast',
      enabled: true,
      ask_clarifying_questions: false,
      reference_models: [
        { provider: 'opencode-go', model: 'deepseek-v4-flash' },
      ],
      aggregator: { provider: 'opencode-go', model: 'deepseek-v4-flash' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.2,
      max_tokens: 4096,
      judge_criteria: '',
    },
    {
      name: 'deep-reasoning',
      enabled: true,
      ask_clarifying_questions: true,
      reference_models: [
        { provider: 'grok', model: 'grok-build-0.1' },
        { provider: 'commandcode', model: 'deepseek/deepseek-v4-flash' },
      ],
      aggregator: { provider: 'codex', model: 'gpt-5.6-sol' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.2,
      max_tokens: 8192,
      judge_criteria: '',
    },
  ]),
})

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

export function apply(ctx, config) {
  refreshCatalogInBackground()

  let settingsScope = null
  let getConfig = () => config
  const live = () => Config(structuredClone(getConfig() ?? {})) ?? config

  ctx.inject(['settings'], (sctx) => {
    try {
      const scope = sctx.settings.register(NS, Config, { base: config })
      settingsScope = scope
      getConfig = () => scope.get() ?? config
      sctx.effect(() => () => {
        settingsScope = null
        getConfig = () => config
      }, 'dsh-moa: settings')
    } catch (e) {
      console.warn('[dsh-moa] Settings registration warning:', e)
    }
  })

  /**
   * Unified LLM dispatch function using ctx.llm.prepareCall / stream
   */
  const callLlm = async ({ provider, model, messages, temperature = 0.6, maxTokens = 4096 }) => {
    if (!ctx.llm) {
      throw new Error('ctx.llm is not available in cordis context')
    }

    let prep
    try {
      // DSH 0.1.2-rc.1 API expects { provider, model } object
      prep = await ctx.llm.prepareCall({ provider, model })
    } catch (err) {
      if (typeof ctx.llm.prepareCall === 'function') {
        try {
          prep = await ctx.llm.prepareCall(provider, model)
        } catch {
          throw err
        }
      } else {
        throw err
      }
    }
    if (!prep || typeof prep.stream !== 'function') {
      throw new Error(`LLM provider/model ${provider}:${model} could not be prepared`)
    }

    const abortCtrl = new AbortController()
    const timeoutId = setTimeout(() => abortCtrl.abort(new Error('LLM call timeout')), 120000)
    timeoutId.unref?.()

    try {
      const stream = prep.stream({
        messages,
        temperature,
        maxTokens,
        signal: abortCtrl.signal,
      })

      let fullText = ''
      let usageInfo = null

      for await (const chunk of stream) {
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
          fullText += chunk.text
        } else if (chunk.type === 'block-end' && chunk.block?.text) {
          if (!fullText) fullText = chunk.block.text
        } else if (chunk.type === 'usage' && chunk.usage) {
          usageInfo = chunk.usage
        }
      }

      clearTimeout(timeoutId)
      return {
        content: fullText,
        text: fullText,
        usage: usageInfo || {
          inputTokens: Math.round(JSON.stringify(messages).length / 4),
          outputTokens: Math.round(fullText.length / 4),
        },
      }
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  }

  // Optional Live Canvas preview client: the harness port is resolved per
  // call and any failure degrades to "no preview link" (live-canvas is not
  // required to be installed).
  const liveCanvas = createLiveCanvasClient({ getPort: () => ctx.webServer?.port })

  // Route: /dsh-moa/status
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
              for (const cp of cProvs) {
                const cpId = cp.provider || cp.id
                if (cpId && typeof ctx.llm.listModels === 'function') {
                  try {
                    const mList = await ctx.llm.listModels(cpId)
                    for (const m of (mList || [])) {
                      const mId = typeof m === 'string' ? m : (m.id || m.model || m.name)
                      if (mId) add(cpId, mId)
                    }
                  } catch {}
                }
              }
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

            // Persist via Cordis Settings API
            if (settingsScope && typeof settingsScope.replace === 'function') {
              await settingsScope.replace(validated)
            } else {
              // In-memory fallback if settings service is unavailable
              getConfig = () => validated
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

  // Route: /dsh-moa/leaderboard (#11)
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
          const data = getMoaLeaderboard()
          writeJson(res, 200, { ok: true, ...data })
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: leaderboard route')

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

          writeJson(res, 200, { ok: true, ...result })
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: run pipeline route')
  // Session turn interceptor: route turn to real aggregator model & stream MoA synthesis
  const moaPendingTurns = new WeakMap()
  const moaSessionTurns = new Map()

  function setSessionTurn(sessionId, turnContext) {
    if (!sessionId) return
    const existing = moaSessionTurns.get(sessionId)
    if (existing?.ttlTimer) clearTimeout(existing.ttlTimer)

    // TTL (3 minutes) to prevent memory leaks if turn is aborted or skipped before llm/stream
    const ttlTimer = setTimeout(() => {
      moaSessionTurns.delete(sessionId)
    }, 180000)
    ttlTimer.unref?.()

    moaSessionTurns.set(sessionId, { ...turnContext, ttlTimer })
  }

  function getSessionTurn(sessionId) {
    if (!sessionId) return null
    return moaSessionTurns.get(sessionId) || null
  }

  function consumeSessionTurn(sessionId) {
    if (!sessionId) return null
    const entry = moaSessionTurns.get(sessionId)
    if (entry) {
      if (entry.ttlTimer) clearTimeout(entry.ttlTimer)
      moaSessionTurns.delete(sessionId)
    }
    return entry
  }

  ctx.on('agent/pre-step', async (event, next) => {
    const messages = event.messages || []
    const lastUserMsg = [...messages].reverse().find((m) => m && m.role === 'user')
    const userText = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content.trim()
      : (Array.isArray(lastUserMsg?.content)
          ? lastUserMsg.content.filter((p) => p.type === 'text').map((p) => p.text).join('\n').trim()
          : '')

    if (userText.startsWith('/moa')) {
      const cfg = live()
      if (cfg.enabled !== false) {
        const parsed = parseMoACommand(userText, cfg.presets || []) || { prompt: userText, presetName: cfg.default_preset || 'default' }
        const targetPreset = (cfg.presets || []).find((p) => p.name === parsed.presetName) || cfg.presets?.[0]
        const aggProvider = targetPreset?.aggregator?.provider || 'codex'
        const aggModel = targetPreset?.aggregator?.model || 'gpt-5.6-sol'
        const sessCwd = event.cwd || event.session?.cwd || (event.session?.path ? path.dirname(event.session.path) : undefined) || process.cwd()

        const turnContext = {
          targetPreset,
          userPrompt: parsed.prompt || userText,
          messages: messages.slice(0, -1),
          cwd: sessCwd,
          aggregator: { provider: aggProvider, model: aggModel },
          callLlm,
          prices: cfg.prices || {},
          liveCanvas,
        }

        if (event.signal) {
          moaPendingTurns.set(event.signal, turnContext)
        }
        if (event.session?.id) {
          setSessionTurn(event.session.id, turnContext)
        }
      }
    }

    return next()
  })

  ctx.on('agent/request', async (payload, next) => {
    const resolved = await next()
    const turnContext = (payload.signal ? moaPendingTurns.get(payload.signal) : null)
      || (payload.session?.id ? getSessionTurn(payload.session.id) : null)

    if (turnContext) {
      return {
        ...resolved,
        provider: turnContext.aggregator.provider,
        model: turnContext.aggregator.model,
      }
    }
    return resolved
  })

  ctx.effect(() => {
    return ctx.on('llm/stream', (options, next) => {
      const turnContext = (options.signal ? moaPendingTurns.get(options.signal) : null)
        || (options.session?.id ? consumeSessionTurn(options.session.id) : null)

      if (turnContext) {
        if (options.signal) moaPendingTurns.delete(options.signal)
        if (options.session?.id) consumeSessionTurn(options.session.id)

        return streamMoATurn(turnContext, options)
      }

      return next(options)
    })
  }, 'dsh-moa: llm stream interceptor')
}
