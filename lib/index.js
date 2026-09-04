import os from 'node:os'
import path from 'node:path'
import z from '@deepseek-ai/schemastery'
import { runMoAPipeline, parseMoACommand, formatMoAResponse, MoaRunnerAdapter } from './moa-runner.js'

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
    { provider: 'opencode-go', model: 'deepseek-v4-flash' },
    { provider: 'codex', model: 'gpt-5.6-sol' },
  ]),
  aggregator: ModelSlotSchema.default({
    provider: 'antigravity',
    model: 'gemini-3-flash',
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
        { provider: 'opencode-go', model: 'deepseek-v4-flash' },
        { provider: 'codex', model: 'gpt-5.6-sol' },
      ],
      aggregator: {
        provider: 'antigravity',
        model: 'gemini-3-flash',
      },
      reference_temperature: 0.6,
      aggregator_temperature: 0.4,
      max_tokens: 4096,
    },
    {
      name: 'deep-reasoning',
      enabled: true,
      reference_models: [
        { provider: 'grok', model: 'grok-4.20-0309-reasoning' },
        { provider: 'codex', model: 'gpt-5.6-terra' },
      ],
      aggregator: {
        provider: 'antigravity',
        model: 'gemini-3-flash',
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
  let settingsApi = null
  let currentConfig = structuredClone(config)

  // Try reading persisted config from ~/.dsh/settings.yaml on load
  try {
    const fs = require('node:fs')
    const yaml = require('yaml')
    const p = path.join(os.homedir(), '.dsh', 'settings.yaml')
    if (fs.existsSync(p)) {
      const parsed = yaml.parse(fs.readFileSync(p, 'utf8'))
      if (parsed && parsed[NS]) {
        currentConfig = Config(parsed[NS])
      }
    }
  } catch {}

  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, Config, { base: currentConfig })
    settingsApi = scope
    const val = scope.get()
    if (val && Object.keys(val).length > 0) {
      currentConfig = val
    }
    sctx.effect(() => () => {
      settingsApi = null
    })
  })

  const getConfig = () => {
    if (settingsApi) {
      const live = settingsApi.get()
      if (live && live.presets && live.presets.length) return live
    }
    return currentConfig || config
  }

  // Canonical collector for ctx.llm.stream chunk streams
  const collectStreamText = async (iterable) => {
    let out = ''
    let sawDelta = false
    for await (const chunk of iterable) {
      if (chunk && chunk.type === 'text-delta' && typeof chunk.text === 'string') {
        out += chunk.text
        sawDelta = true
      } else if (
        !sawDelta && chunk && chunk.type === 'block-end' &&
        chunk.block && chunk.block.type === 'text' && typeof chunk.block.text === 'string'
      ) {
        out += chunk.block.text
      } else if (chunk && chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
        throw new Error(chunk.reason.failure?.message || 'LLM stream failed')
      }
    }
    return out.trim()
  }

  // Adapter to ctx.llm.stream
  const callLlm = async (params) => {
    if (!ctx.llm || typeof ctx.llm.stream !== 'function') {
      throw new Error('ctx.llm.stream service is not available')
    }

    const { provider, model, messages, temperature, maxTokens, signal } = params

    // Convert string/simple role messages to format expected by ctx.llm.stream
    // Each message must have role, content (array of blocks or string), and source
    const formattedMessages = (messages || []).map((m) => {
      let content = m.content
      if (typeof content === 'string') {
        content = [{ type: 'text', text: content }]
      } else if (Array.isArray(content)) {
        content = content.map((b) => (typeof b === 'string' ? { type: 'text', text: b } : b))
      } else {
        content = [{ type: 'text', text: String(content || '') }]
      }

      const role = m.role || 'user'
      const source = m.source || (role === 'assistant' ? { kind: 'model', provider, model } : { kind: 'user' })

      return {
        role,
        content,
        source,
      }
    })

    // Provider-specific parameter cleansing (Codex / reasoning models reject temperature, max_output_tokens, etc.)
    const isCodexOrReasoning = provider === 'codex' || String(model).includes('sol') || String(model).includes('reasoner')
    const streamOpts = {
      provider,
      model,
      messages: formattedMessages,
      ...(signal ? { signal } : {}),
    }

    if (!isCodexOrReasoning) {
      if (temperature !== undefined) streamOpts.temperature = temperature
      if (maxTokens !== undefined) streamOpts.maxTokens = maxTokens
    }

    const chunks = ctx.llm.stream(streamOpts)

    return await collectStreamText(chunks)
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
          hasCtxLlm: Boolean(ctx.llm),
          llmKeys: ctx.llm ? Object.keys(ctx.llm) : [],
          llmProto: ctx.llm ? Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.llm)) : [],
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

        // ONLY query REAL models from runtime adapters & settings. NO hardcoded fallbacks!
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
            const newConfig = {
              enabled: cfg.enabled !== false,
              default_preset: payload.default_preset || cfg.default_preset || 'default',
              presets: Array.isArray(payload.presets) ? payload.presets : (cfg.presets || []),
            }

            // 1. Persist via Cordis Settings API
            if (settingsApi && typeof settingsApi.replace === 'function') {
              await settingsApi.replace(newConfig)
            }
            currentConfig = newConfig

            // 2. Direct persistence to ~/.dsh/settings.yaml
            try {
              const fs = await import('node:fs')
              const yaml = await import('yaml')
              const p = path.join(os.homedir(), '.dsh', 'settings.yaml')
              if (fs.existsSync(p)) {
                const curYaml = yaml.parse(fs.readFileSync(p, 'utf8')) || {}
                curYaml[NS] = newConfig
                fs.writeFileSync(p, yaml.stringify(curYaml), 'utf8')
              }
            } catch (fsErr) {
              console.warn('[dsh-moa] direct file write error:', fsErr)
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

        const cfg = getConfig()
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
      const cfg = getConfig()
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
