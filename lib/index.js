import z from '@deepseek-ai/schemastery'
import { runMoAPipeline } from './moa-runner.js'

export const name = '@goodandready/dsh-moa'
export const inject = ['settings', 'webServer', 'llm', 'credentials', 'sessions', 'agents']

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

export function parseMoACommand(text, presets = []) {
  if (typeof text !== 'string' || !text.startsWith('/moa')) {
    return null
  }

  const remainder = text.slice(4).trim()
  if (!remainder) {
    return { presetName: 'default', prompt: '' }
  }

  const parts = remainder.split(/\s+/)
  const firstWord = parts[0]
  const matchedPreset = presets.find((p) => p && p.name === firstWord)

  if (matchedPreset) {
    return {
      presetName: matchedPreset.name,
      prompt: remainder.slice(firstWord.length).trim(),
    }
  }

  return {
    presetName: 'default',
    prompt: remainder,
  }
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
