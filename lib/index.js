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

// Ensure .volatile() helper exists on Schemastery schema prototype
try {
  const schemaProto = Object.getPrototypeOf(z.boolean())
  if (schemaProto && typeof schemaProto.volatile !== 'function') {
    schemaProto.volatile = function () {
      return typeof this.extra === 'function' ? this.extra('volatile', true) : this
    }
  }
} catch {
  // safe fallback
}
import path from 'node:path'
import os from 'node:os'
import {
  parseMoACommand,
  runMoAPipeline,
  streamMoATurn,
} from './moa-runner.js'

import { registerMoaRoutes } from './routes.js'

import { createLiveCanvasClient } from './live-canvas.js'
import { registerPluginUpdater, isSafeWriteRequest } from './updater.js'

export const name = '@goodandready/dsh-moa'
export { collectProjectContext, formatProjectContext } from './file-workspace.js'
export const inject = ['webServer', 'llm', 'sessions', 'tools']

export const NS = 'dsh-moa'

export const PriceRow = z.object({
  input: z.number().default(0),
  output: z.number().default(0),
  cacheHit: z.number().default(0),
})

export const ModelSlotSchema = z.object({
  provider: z.string().default('opencode-go'),
  model: z.string().default('deepseek-v4-flash'),
  role_persona: z.string().default(''),
})

export const PresetSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  ask_clarifying_questions: z.boolean().default(true),
  curator_synthesis: z.boolean().default(false),
  stream_aggregator: z.boolean().default(true),
  quorum_enabled: z.boolean().default(false),
  grace_period_sec: z.number().default(10),
  reference_models: z.array(ModelSlotSchema).default([]),
  aggregator: ModelSlotSchema.default({ provider: 'codex', model: 'gpt-5.6-sol' }),
  aggregator_fallbacks: z.array(ModelSlotSchema).default([]),
  reference_temperature: z.number().default(0.6),
  aggregator_temperature: z.number().default(0.4),
  reference_timeout_sec: z.number().default(60),
  aggregator_timeout_sec: z.number().default(180),
  blind_evaluation: z.boolean().default(false),
  peer_critique_enabled: z.boolean().default(false),
  allow_candidate_override: z.boolean().default(false),
  max_tokens: z.number().default(4096),
  judge_criteria: z.string().default(''),
})

export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  default_preset: z.string().default('default').volatile(),
  prices: z.dict(PriceRow).default({}).volatile(),
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
  ]).volatile(),
})


export function plainConfig(value) {
  if (value && typeof value === 'object' && typeof value.get === 'function') {
    return plainConfig(value.get())
  }
  if (Array.isArray(value)) {
    return value.map(plainConfig)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, plainConfig(child)])
    )
  }
  return value
}

export function apply(ctx, config) {
  refreshCatalogInBackground()

  let localConfig = plainConfig(config ?? {})
  const getConfig = () => localConfig
  const live = () => {
    try {
      const raw = getConfig() ?? {}
      const validated = Config(plainConfig(raw))
      return plainConfig(validated) ?? localConfig
    } catch {
      return localConfig
    }
  }

  let settingsService = null

  // Optional policy hook for DSH 0.1.7 settings forms:
  // Suppress auto-generated settings form since dsh-moa provides its own
  // custom settings surface in settings.plugin.item.
  ctx.inject(['settings'], (sctx) => {
    settingsService = sctx.settings
    if (sctx.settings && typeof sctx.settings.configure === 'function') {
      try {
        const dispose = sctx.settings.configure({ auto: false }, ctx.fiber)
        if (typeof sctx.effect === 'function') {
          sctx.effect(() => () => {
            dispose()
            settingsService = null
          }, 'dsh-moa: settings policy')
        }
      } catch {
        // Safe fallback if configure is already registered or throws
      }
    }
  })

  const saveConfig = async (newFields) => {
    const plain = plainConfig(newFields)
    localConfig = { ...localConfig, ...plain }
    try {
      if (settingsService && typeof settingsService.replace === 'function') {
        await settingsService.replace(NS, plain)
      } else if (settingsService && typeof settingsService.update === 'function') {
        await settingsService.update(NS, plain)
      }
    } catch (err) {
      console.warn('[dsh-moa] Settings persistence warning:', err?.message || err)
    }
    return localConfig
  }

  /**
   * Unified LLM dispatch function using ctx.llm.prepareCall / stream
   */
  const callLlm = async ({ provider, model, messages, temperature = 0.6, maxTokens = 4096, timeoutMs, onStreamDelta }) => {
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

    const effectiveTimeoutMs = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 120000
    const abortCtrl = new AbortController()
    const timeoutId = setTimeout(() => abortCtrl.abort(new Error(`LLM call timeout after ${Math.round(effectiveTimeoutMs / 1000)}s`)), effectiveTimeoutMs)
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
          if (typeof onStreamDelta === 'function') {
            onStreamDelta(chunk.text)
          }
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
  // Register one-click updater endpoint
  ctx.effect(() => {
    return registerPluginUpdater(ctx, {
      endpoint: '/api/dsh-moa/update',
      packageName: '@goodandready/dsh-moa',
      manifestUrl: new URL('../package.json', import.meta.url),
    })
  }, 'dsh-moa: plugin updater route')

  // Route dispatch: req.method verified fail-closed in lib/routes.js
  registerMoaRoutes(ctx, {
    live,
    callLlm,
    liveCanvas,
    saveConfig,
    Config,
    plainConfig,
  })

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
