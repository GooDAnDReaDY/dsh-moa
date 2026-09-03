import os from 'node:os'
import path from 'node:path'
import z from '@deepseek-ai/schemastery'
import { runMoAPipeline, parseMoACommand } from './moa-runner.js'

export const name = '@goodandready/dsh-moa'
export const inject = ['settings', 'webServer', 'llm', 'credentials', 'sessions', 'agents']

export { parseMoACommand }

export const ModelSlotSchema = z.object({
  provider: z.string().default(''),
  model: z.string().default(''),
})

export const PresetSchema = z.object({
  name: z.string().default('default'),
  enabled: z.boolean().default(true),
  reference_models: z.array(ModelSlotSchema).default([
    { provider: 'deepseek', model: 'deepseek-chat' },
    { provider: 'openai', model: 'gpt-4o' },
  ]),
  aggregator: ModelSlotSchema.default({
    provider: 'anthropic',
    model: 'claude-3-7-sonnet',
  }),
  reference_temperature: z.number().step(0.05).min(0).max(2).default(0.6),
  aggregator_temperature: z.number().step(0.05).min(0).max(2).default(0.4),
  max_tokens: z.number().min(256).max(65536).default(4096),
})

export const Config = z.object({
  enabled: z.boolean().default(true),
  default_preset: z.string().default('default'),
  presets: z.array(PresetSchema).default([
    {
      name: 'default',
      enabled: true,
      reference_models: [
        { provider: 'deepseek', model: 'deepseek-chat' },
        { provider: 'openai', model: 'gpt-4o' },
      ],
      aggregator: {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet',
      },
      reference_temperature: 0.6,
      aggregator_temperature: 0.4,
      max_tokens: 4096,
    },
    {
      name: 'deep-reasoning',
      enabled: true,
      reference_models: [
        { provider: 'deepseek', model: 'deepseek-reasoner' },
        { provider: 'openai', model: 'o3-mini' },
      ],
      aggregator: {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet',
      },
      reference_temperature: 0.7,
      aggregator_temperature: 0.2,
      max_tokens: 8192,
    },
  ]),
})

const NS = 'dsh-moa'

function writeJson(res, code, data) {
  try {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(data))
  } catch {
    /* socket closed */
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function apply(ctx, config) {
  let getConfig = () => config

  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, Config, { base: config })
    getConfig = () => scope.get() ?? config
  })

  // Adapter to ctx.llm or auxiliary LLM call
  const callLlm = async (params) => {
    if (ctx.llm && typeof ctx.llm.chat === 'function') {
      const res = await ctx.llm.chat(params)
      return res?.choices?.[0]?.message?.content || res?.content || ''
    }
    if (ctx.llm && typeof ctx.llm.call === 'function') {
      const res = await ctx.llm.call(params)
      return res?.text || res?.content || ''
    }
    throw new Error('ctx.llm service is not available')
  }

  // HTTP endpoints
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/status',
      handler: (_req, res) => {
        const cfg = getConfig()
        writeJson(res, 200, {
          ok: true,
          enabled: cfg.enabled !== false,
          defaultPreset: cfg.default_preset || 'default',
          presetsCount: (cfg.presets || []).length,
        })
      },
    })
  }, 'dsh-moa: status route')

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/models',
      handler: async (_req, res) => {
        const result = []
        const seen = new Set()

        const add = (prov, mod, label) => {
          if (!prov || !mod) return
          const p = String(prov).trim()
          const m = String(mod).trim()
          if (!p || !m) return
          const key = `${p}:${m}`
          if (seen.has(key)) return
          seen.add(key)
          result.push({ provider: p, model: m, label: label || key })
        }

        // 1. Query ctx.llm async methods (all registered adapters in cordis runtime)
        if (ctx.llm) {
          try {
            if (typeof ctx.llm.listProviders === 'function') {
              const provList = ctx.llm.listProviders() || []
              for (const p of provList) {
                const pId = typeof p === 'string' ? p : (p.id || p.provider || p.name)
                if (!pId) continue
                if (typeof ctx.llm.listModels === 'function') {
                  try {
                    const mList = await ctx.llm.listModels(pId)
                    for (const m of (mList || [])) {
                      const mId = typeof m === 'string' ? m : (m.id || m.model || m.name)
                      const mLabel = m.displayName || m.name || mId
                      if (mId) add(pId, mId, `${pId}: ${mLabel}`)
                    }
                  } catch {}
                }
                for (const m of (p.models || [])) {
                  const mId = typeof m === 'string' ? m : (m.id || m.model || m.name)
                  if (mId) add(pId, mId)
                }
              }
            }
          } catch (e) {
            console.warn('[dsh-moa] ctx.llm.listProviders error:', e)
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

        // 2. Query settings service for configured providers & plugins
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

          // dsh-subscriptions plugin (Claude, ChatGPT Codex, Grok, Gemini, Antigravity)
          const subs = getSetting('dsh-subscriptions')
          for (const slot of (subs?.slots || [])) {
            const p = slot.provider
            if (p === 'codex') {
              add('codex', 'gpt-5.1-codex')
              add('codex', 'gpt-5.1-codex-mini')
              add('codex', 'gpt-5.1')
            } else if (p === 'claude') {
              add('claude', 'claude-opus-5')
              add('claude', 'claude-sonnet-5')
              add('claude', 'claude-fable-5')
              add('claude', 'claude-haiku-4-5-20251001')
              add('claude', 'claude-3-7-sonnet')
            } else if (p === 'grok') {
              add('grok', 'grok-4')
              add('grok', 'grok-4-fast-reasoning')
              add('grok', 'grok-code-fast-1')
            } else if (p === 'antigravity') {
              add('antigravity', 'gemini-3.5-flash-low')
              add('antigravity', 'gemini-3-flash')
              add('antigravity', 'gemini-2.5-flash')
            } else if (p === 'gemini') {
              add('gemini', 'gemini-2.5-flash')
              add('gemini', 'gemini-2.5-pro')
            }
          }

          // dsh-model-sync plugin catalogs
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

        // 3. Fallback direct inspection from settings.yaml using os.homedir()
        try {
          const fs = await import('node:fs')
          const yaml = await import('yaml')
          const p = path.join(os.homedir(), '.dsh', 'settings.yaml')
          if (fs.existsSync(p)) {
            const raw = yaml.parse(fs.readFileSync(p, 'utf8'))
            const pi = raw?.['llm-pi-ai']?.providers || {}
            for (const [pName, pData] of Object.entries(pi)) {
              for (const m of (pData?.models || [])) {
                const mId = typeof m === 'string' ? m : (m?.id || m?.model)
                if (mId) add(pName, mId)
              }
            }
            const sSlots = raw?.['dsh-subscriptions']?.slots || []
            for (const slot of sSlots) {
              const p = slot.provider
              if (p === 'codex') {
                add('codex', 'gpt-5.1-codex')
                add('codex', 'gpt-5.1-codex-mini')
                add('codex', 'gpt-5.1')
              } else if (p === 'claude') {
                add('claude', 'claude-opus-5')
                add('claude', 'claude-sonnet-5')
                add('claude', 'claude-fable-5')
                add('claude', 'claude-haiku-4-5-20251001')
              } else if (p === 'grok') {
                add('grok', 'grok-4')
                add('grok', 'grok-4-fast-reasoning')
                add('grok', 'grok-code-fast-1')
              } else if (p === 'antigravity') {
                add('antigravity', 'gemini-3.5-flash-low')
                add('antigravity', 'gemini-3-flash')
                add('antigravity', 'gemini-2.5-flash')
              } else if (p === 'gemini') {
                add('gemini', 'gemini-2.5-flash')
                add('gemini', 'gemini-2.5-pro')
              }
            }
          }
        } catch {}

        // Fallback defaults if still empty
        if (result.length === 0) {
          add('deepseek', 'deepseek-chat')
          add('openai', 'gpt-4o')
          add('anthropic', 'claude-3-7-sonnet')
        }

        writeJson(res, 200, { ok: true, models: result })
      },
    })
  }, 'dsh-moa: models route')

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/presets',
      handler: async (req, res) => {
        const cfg = getConfig()
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
            if (Array.isArray(payload.presets)) {
              cfg.presets = payload.presets
            }
            if (payload.default_preset) {
              cfg.default_preset = payload.default_preset
            }
            writeJson(res, 200, { ok: true, presets: cfg.presets })
          } catch (err) {
            writeJson(res, 400, { ok: false, error: err?.message || String(err) })
          }
          return
        }

        writeJson(res, 405, { ok: false, error: 'Method Not Allowed' })
      },
    })
  }, 'dsh-moa: presets route')

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

          const cfg = getConfig()
          const presetName = payload.preset || cfg.default_preset || 'default'
          const preset = (cfg.presets || []).find((p) => p.name === presetName) || cfg.presets?.[0]

          const result = await runMoAPipeline({
            userPrompt: prompt,
            messages: payload.messages || [],
            preset,
            callLlm,
          })

          writeJson(res, 200, { ok: true, ...result })
        } catch (err) {
          writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  }, 'dsh-moa: run pipeline route')

  // One-shot session turn interceptor
  ctx.on('agent/pre-step', async (event, next) => {
    const messages = event.messages || []
    const lastUserMsg = [...messages].reverse().find((m) => m && m.role === 'user')
    const userText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content.trim() : ''

    if (!userText.startsWith('/moa')) {
      return next()
    }

    const cfg = getConfig()
    if (cfg.enabled === false) {
      return next()
    }

    const parsed = parseMoACommand(userText, cfg.presets || [])
    if (!parsed || !parsed.prompt) {
      return next()
    }

    const session = event.session || {}
    const originalModel = session.model
    const originalProvider = session.provider

    const targetPreset = (cfg.presets || []).find((p) => p.name === parsed.presetName) || cfg.presets?.[0]

    // Temporary override to aggregator model for this turn
    if (targetPreset?.aggregator) {
      session.provider = targetPreset.aggregator.provider
      session.model = targetPreset.aggregator.model
    }

    try {
      const moaResult = await runMoAPipeline({
        userPrompt: parsed.prompt,
        messages: messages.slice(0, -1),
        preset: targetPreset,
        callLlm,
      })

      // Inject the MoA synthesis directly as guidance or assistant response
      if (lastUserMsg) {
        lastUserMsg.content = parsed.prompt + '\n\n' +
          `[Mixture of Agents Synthesized Context — Aggregator: ${moaResult.aggregator}]\n` +
          moaResult.content
      }

      return next()
    } finally {
      // Guaranteed restoration of session model
      session.model = originalModel
      session.provider = originalProvider
    }
  })
}
