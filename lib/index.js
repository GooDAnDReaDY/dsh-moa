import path from 'node:path'
import { setLogger, logger } from './logger.js'
import { refreshCatalogInBackground } from './pricing.js'
import {
  PriceRow,
  ModelSlotSchema,
  PresetSchema,
  Config,
  plainConfig,
} from './moa-schema.js'
import { createLlmCaller } from './moa-llm.js'
import {
  parseMoACommand,
  streamMoATurn,
} from './moa-runner.js'
import { registerMoaRoutes } from './routes.js'
import { resolvePresetForPrompt } from './moa-router.js'
import { createLiveCanvasClient } from './live-canvas.js'
import { registerPluginUpdater } from './updater.js'

export const name = '@goodandready/dsh-moa'
export { collectProjectContext, formatProjectContext } from './file-workspace.js'
export const inject = ['webServer', 'llm', 'sessions', 'tools']
export const NS = 'dsh-moa'

export {
  PriceRow,
  ModelSlotSchema,
  PresetSchema,
  Config,
  plainConfig,
} from './moa-schema.js'
export { createLlmCaller } from './moa-llm.js'

export function apply(ctx, config) {
  if (ctx.logger) setLogger(ctx.logger)
  refreshCatalogInBackground()

  let localConfig = plainConfig(config ?? {})
  const getConfig = () => localConfig
  const live = () => {
    try {
      const raw = getConfig() ?? {}
      const validated = plainConfig(Config(plainConfig(raw)))
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
      logger.warn('[dsh-moa] Settings persistence warning:', err?.message || err)
    }
    return localConfig
  }

  const callLlm = createLlmCaller(ctx)

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
  ctx.effect(() => {
    return () => {
      for (const entry of moaSessionTurns.values()) {
        if (entry?.ttlTimer) clearTimeout(entry.ttlTimer)
      }
      moaSessionTurns.clear()
    }
  }, 'dsh-moa: session turns cleanup')
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

  ctx.effect(() => {
    return ctx.on('agent/pre-step', async (event, next) => {
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
          const isExplicitPreset = userText.includes('--preset') || userText.includes('-p ')
          if (!isExplicitPreset && (cfg.smart_routing_enabled || cfg.presets?.some((p) => p.smart_routing_enabled))) {
            try {
              const routed = await resolvePresetForPrompt({
                prompt: parsed.prompt || userText,
                presets: cfg.presets || [],
                defaultPreset: parsed.presetName || cfg.default_preset || 'default',
                routingModel: cfg.smart_routing_model,
                callLlm,
                enabled: true,
              })
              if (routed?.isAutoRouted && routed.presetName) {
                parsed.presetName = routed.presetName
              }
            } catch {
              // fallback silently
            }
          }
          const targetPreset = (cfg.presets || []).find((p) => p.name === parsed.presetName) || cfg.presets?.[0]
          const aggProvider = targetPreset?.aggregator?.provider || ''
          const aggModel = targetPreset?.aggregator?.model || ''
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
            webServerPort: ctx.webServer?.port,
            timeMachineEngine: ctx.get?.('timeMachineEngine') || ctx.timeMachineEngine,
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
  }, 'dsh-moa: agent pre-step interceptor')

  ctx.effect(() => {
    return ctx.on('agent/request', async (payload, next) => {
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
  }, 'dsh-moa: agent request interceptor')

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

export { executeTestGateForCandidates, runCandidateTestGate } from './moa-test-gate.js'
