import { refreshCatalogInBackground } from './pricing.js'
/**
 * DeepSeek Harness Mixture of Agents (MoA) Plugin
 *
 * Implements an intelligent ensemble pipeline:
 * 1. User issues /moa <prompt>
 * 2. Parallel candidate proposers write to isolated workspaces (.moa/candidate-X/)
 * 3. Aggregator evaluates and synthesizes the optimal solution
 * 4. Winner candidate files are promoted to the project root and previewed in Live Canvas
 * 5. Native cost tracking, history logging and leaderboard analytics
 */

import z from '@deepseek-ai/schemastery'
import path from 'node:path'
import os from 'node:os'
import {
  parseMoACommand,
  runMoAPipeline,
  MoaRunnerAdapter,
} from './moa-runner.js'

import {
  getMoaHistory,
  getMoaLeaderboard,
  getMoaRunById,
} from './history.js'

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
  reference_models: z.array(ModelSlotSchema).default([]),
  aggregator: ModelSlotSchema.default({ provider: 'codex', model: 'gpt-5.6-sol' }),
  reference_temperature: z.number().default(0.6),
  aggregator_temperature: z.number().default(0.4),
  max_tokens: z.number().default(4096),
  judge_criteria: z.string().default(''),
  judge_mode: z.string().default('auto'),
})

export const Config = z.object({
  enabled: z.boolean().default(true),
  default_preset: z.string().default('default'),
  prices: z.dict(PriceRow).default({}),
  presets: z.array(PresetSchema).default([
    {
      name: 'default',
      enabled: true,
      reference_models: [
        { provider: 'opencode-go', model: 'deepseek-v4-flash' },
        { provider: 'grok', model: 'grok-build-0.1' },
      ],
      aggregator: { provider: 'codex', model: 'gpt-5.6-sol' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.4,
      max_tokens: 4096,
      judge_criteria: '',
      judge_mode: 'auto',
    },
    {
      name: 'fast',
      enabled: true,
      reference_models: [
        { provider: 'opencode-go', model: 'deepseek-v4-flash' },
      ],
      aggregator: { provider: 'opencode-go', model: 'deepseek-v4-flash' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.2,
      max_tokens: 4096,
      judge_criteria: '',
      judge_mode: 'auto',
    },
    {
      name: 'deep-reasoning',
      enabled: true,
      reference_models: [
        { provider: 'grok', model: 'grok-build-0.1' },
        { provider: 'commandcode', model: 'deepseek/deepseek-v4-flash' },
      ],
      aggregator: { provider: 'codex', model: 'gpt-5.6-sol' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.2,
      max_tokens: 8192,
      judge_criteria: 'Приоритет: математическая строгость и отсутствие галлюцинаций',
      judge_mode: 'auto',
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
              enabled: cfg.enabled !== false,
              default_preset: payload.default_preset || cfg.default_preset || 'default',
              presets: Array.isArray(payload.presets) ? payload.presets : (cfg.presets || []),
            }

            // Persist via Cordis Settings API
            if (settingsScope && typeof settingsScope.replace === 'function') {
              await settingsScope.replace(newConfig)
            } else {
              // In-memory fallback if settings service is unavailable
              getConfig = () => newConfig
            }

            writeJson(res, 200, {
              ok: true,
              defaultPreset: newConfig.default_preset,
              presets: newConfig.presets,
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
          const presetName = payload.preset || cfg.default_preset || 'default'
          const preset = (cfg.presets || []).find((p) => p.name === presetName) || cfg.presets?.[0]

          const result = await runMoAPipeline({
            userPrompt: prompt,
            messages: payload.messages || [],
            preset,
            callLlm,
            cwd: payload.cwd || process.cwd(),
          })

          writeJson(res, 200, { ok: true, ...result })
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: run pipeline route')

  // Register virtual LLM adapter for live-streaming MoA turns
  if (ctx.llm && typeof ctx.llm.registerAdapter === 'function') {
    ctx.effect(() => {
      const adapter = new MoaRunnerAdapter((options) => {
        const msgs = options.messages || []
        const lastUser = [...msgs].reverse().find((m) => m && m.role === 'user')
        const userText = typeof lastUser?.content === 'string'
          ? lastUser.content
          : (Array.isArray(lastUser?.content)
              ? lastUser.content.filter((p) => p.type === 'text').map((p) => p.text).join('\n')
              : '')

        const cfg = live()
        const parsed = parseMoACommand(userText, cfg.presets || []) || { prompt: userText, presetName: 'default' }
        const targetPreset = (cfg.presets || []).find((p) => p.name === parsed.presetName) || cfg.presets?.[0]

        const extraCtx = options.signal ? moaPendingContexts.get(options.signal) : null
        const cwd = options.cwd || extraCtx?.cwd || process.cwd()

        return {
          targetPreset,
          userPrompt: parsed.prompt || userText,
          messages: msgs.slice(0, -1),
          callLlm,
          cwd,
        }
      })

      const dispose = ctx.llm.registerAdapter(['moa-runner'], adapter)
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    }, 'dsh-moa: llm adapter')
  }

  // Session turn interceptor: flag MoA turns and route to moa-runner adapter
  const moaPendingSignals = new WeakSet()
  const moaPendingContexts = new WeakMap()

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
        if (event.signal) {
          moaPendingSignals.add(event.signal)
          const sessCwd = event.cwd || event.session?.cwd || (event.session?.path ? path.dirname(event.session.path) : undefined)
          moaPendingContexts.set(event.signal, { cwd: sessCwd })
        }
      }
    }

    return next()
  })

  ctx.on('agent/request', async (payload, next) => {
    const resolved = await next()
    if (payload.signal && moaPendingSignals.has(payload.signal)) {
      moaPendingSignals.delete(payload.signal)
      return {
        ...resolved,
        provider: 'moa-runner',
        model: 'ensemble',
      }
    }
    return resolved
  })
}
