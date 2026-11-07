import { applyTuiSettings, buildTuiSection } from './tui-settings.js'
import { registerMoaCommands } from './commands.js'
import { service, getWebServer, getWebServerPort } from './services.js'
import crypto from 'node:crypto'
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
  streamPromoteTurn,
} from './moa-runner.js'
import { registerMoaRoutes } from './routes.js'
import { resolvePresetForPrompt } from './moa-router.js'
import { createLiveCanvasClient } from './live-canvas.js'
import { registerPluginUpdater } from './updater.js'
import { bestEffort } from './best-effort.js'
import { getMoaHistory } from './history.js'
import { runMoAPipeline } from './moa-runner.js'
import { MoaService } from './moa-service.js'
import { MOA_EVENTS, emitEvent } from './events.js'

export const name = '@goodandready/dsh-moa'
export { collectProjectContext, formatProjectContext } from './file-workspace.js'
export const inject = ['llm']
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

  let localOverrides = null
  let baseAtOverride = {}
  const getSourceConfig = () => {
    let liveCandidate = ctx.fiber?.config
    if (!liveCandidate && ('config' in ctx)) {
      bestEffort('ctx.config probe', () => { liveCandidate = ctx.config }, ctx.logger)
    }
    const liveSource = plainConfig(liveCandidate ?? config ?? {})
    if (localOverrides) {
      for (const key of Object.keys(localOverrides)) {
        if (baseAtOverride[key] !== undefined && JSON.stringify(liveSource[key]) !== baseAtOverride[key]) {
          delete localOverrides[key]
          delete baseAtOverride[key]
        }
      }
      if (Object.keys(localOverrides).length === 0) {
        localOverrides = null
      }
    }
    return localOverrides ? { ...liveSource, ...localOverrides } : liveSource
  }
  const live = () => {
    try {
      const raw = getSourceConfig() ?? {}
      const validated = plainConfig(Config(plainConfig(raw)))
      return plainConfig(validated) ?? raw
    } catch {
      return getSourceConfig()
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
    let persisted = false
    if (settingsService && typeof settingsService.replace === 'function') {
      await settingsService.replace(NS, plain)
      persisted = true
    } else if (settingsService && typeof settingsService.update === 'function') {
      await settingsService.update(NS, plain)
      persisted = true
    }
    if (config && typeof config === 'object') {
      for (const [k, v] of Object.entries(plain)) {
        if (config[k] && typeof config[k] === 'object' && typeof config[k].get === 'function') continue
        const desc = Object.getOwnPropertyDescriptor(config, k)
        if (desc && desc.get && !desc.set) continue
        bestEffort('update in-memory config key', () => { config[k] = v }, ctx.logger)
      }
    }
    let liveCandidate = ctx.fiber?.config
    if (!liveCandidate && ('config' in ctx)) {
      bestEffort('ctx.config probe', () => { liveCandidate = ctx.config }, ctx.logger)
    }
    const currentLive = plainConfig(liveCandidate ?? config ?? {})
    baseAtOverride = baseAtOverride || {}
    for (const key of Object.keys(plain)) {
      baseAtOverride[key] = JSON.stringify(currentLive[key])
    }
    localOverrides = { ...(localOverrides || {}), ...plain }
    return { ok: true, persisted, ...live() }
  }

  const callLlm = createLlmCaller(ctx)

  // Optional Live Canvas preview client: the harness port is resolved per
  // call and any failure degrades to "no preview link" (live-canvas is not
  // required to be installed).
  const liveCanvas = createLiveCanvasClient({ getPort: () => getWebServerPort(ctx) })

  let activeWebServerPort = null
  // Native Cordis service: ctx.moa
  const moaService = new MoaService(ctx, {
    live,
    runMoAPipeline,
    resolvePresetForPrompt,
    getMoaHistory,
    callLlm,
    liveCanvas,
    get webServerPort() { return activeWebServerPort || getWebServerPort(ctx) },
    get timeMachineEngine() { return service(ctx, 'timeMachineEngine') },
  })

  if (typeof ctx.provide === 'function') {
    ctx.provide('moa', moaService)
  }
  ctx.moa = moaService

  // Route: /dsh-moa/status & one-click updater
  let webSurfacesRegistered = false
  const registerWebSurfaces = (webCtx) => {
    if (webSurfacesRegistered) return
    const targetCtx = (getWebServer(webCtx)?.register ? webCtx : (getWebServer(ctx)?.register ? ctx : null))
    if (!targetCtx) return
    webSurfacesRegistered = true

    const eff = typeof targetCtx.effect === 'function' ? targetCtx.effect : (typeof ctx.effect === 'function' ? ctx.effect : (fn) => fn())
    eff(() => {
      return registerPluginUpdater(targetCtx, {
        endpoint: '/api/dsh-moa/update',
        packageName: '@goodandready/dsh-moa',
        manifestUrl: new URL('../package.json', import.meta.url),
      })
    }, 'dsh-moa: plugin updater route')

    registerMoaRoutes(targetCtx, {
      live,
      callLlm,
      liveCanvas,
      saveConfig,
      Config,
      plainConfig,
      webServerPort: (() => {
        activeWebServerPort = getWebServerPort(targetCtx) || getWebServerPort(ctx)
        return activeWebServerPort
      })(),
      timeMachineEngine: service(targetCtx, 'timeMachineEngine') || service(ctx, 'timeMachineEngine') || ctx.reflect?.get?.('timeMachineEngine', false),
    })
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (injectedCtx) => {
      registerWebSurfaces(injectedCtx)
    })
  }
  if (!webSurfacesRegistered && getWebServer(ctx)?.register) {
    registerWebSurfaces(ctx)
  }

  // Official slash command /moa registration via dsh-commands (#275)
  registerMoaCommands(ctx, { live, moaService })

  // Official TUI settings section registration (#277)
  applyTuiSettings(ctx, { live })

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
          const effectiveDefault = cfg.default_preset || 'default'
          const parsed = parseMoACommand(userText, cfg.presets || [], effectiveDefault) || { prompt: userText, presetName: effectiveDefault, isExplicit: false }
          if (parsed.isPromote) {
            let promoteRunId = parsed.runId
            if (!promoteRunId) {
              const latestRun = getMoaHistory(1, 0)?.runs?.[0]
              if (latestRun?.id) promoteRunId = latestRun.id
            }
            const sessCwd = event.cwd || event.session?.cwd || (event.session?.path ? path.dirname(event.session.path) : undefined) || process.cwd()
            const turnContext = {
              isPromoteTurn: true,
              runId: promoteRunId,
              candidateIndex: parsed.candidateIndex,
              cwd: sessCwd,
              webServerPort: getWebServerPort(ctx),
              timeMachineEngine: service(ctx, 'timeMachineEngine') || ctx.reflect?.get?.('timeMachineEngine', false),
            }
            if (event.signal) moaPendingTurns.set(event.signal, turnContext)
            if (event.session?.id) setSessionTurn(event.session.id, turnContext)
            return next()
          }
          const isExplicitPreset = Boolean(parsed.isExplicit || userText.includes('--preset') || userText.includes('-p '))
          if (!isExplicitPreset && (cfg.smart_routing_enabled || cfg.presets?.some((p) => p.smart_routing_enabled))) {
            try {
              const activePreset = (cfg.presets || []).find((p) => p.name === (parsed.presetName || effectiveDefault)) || cfg.presets?.[0]
              const routingModel = (activePreset?.smart_routing_model?.model && activePreset.smart_routing_model)
                || (cfg.smart_routing_model?.model && cfg.smart_routing_model) || activePreset?.smart_routing_model || cfg.smart_routing_model
              const routed = await resolvePresetForPrompt({
                prompt: parsed.prompt || userText,
                presets: cfg.presets || [],
                defaultPreset: parsed.presetName || effectiveDefault,
                routingModel,
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
          const targetPreset = (cfg.presets || []).find((p) => p.name === (parsed.presetName || effectiveDefault))
            || (!isExplicitPreset ? (cfg.presets || []).find((p) => p.name === effectiveDefault) || cfg.presets?.[0] : null)
          if (!targetPreset) {
            logger.warn(`[dsh-moa] Unknown explicit preset "${parsed.presetName}" in /moa command.`)
            return next()
          }
          const aggProvider = targetPreset?.aggregator?.provider || ''
          const aggModel = targetPreset?.aggregator?.model || ''
          const sessCwd = event.cwd || event.session?.cwd || (event.session?.path ? path.dirname(event.session.path) : undefined) || process.cwd()
          const runId = crypto.randomUUID()

          const turnContext = {
            runId,
            targetPreset,
            userPrompt: parsed.prompt || userText,
            messages: messages.slice(0, -1),
            cwd: sessCwd,
            aggregator: { provider: aggProvider, model: aggModel },
            callLlm,
            prices: cfg.prices || {},
            liveCanvas,
            webServerPort: getWebServerPort(ctx),
            timeMachineEngine: service(ctx, 'timeMachineEngine') || ctx.reflect?.get?.('timeMachineEngine', false),
            ctx,
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

      if (turnContext && !turnContext.isPromoteTurn) {
        return {
          ...resolved,
          provider: turnContext.aggregator?.provider || resolved.provider,
          model: turnContext.aggregator?.model || resolved.model,
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

        if (turnContext.isPromoteTurn) {
          return streamPromoteTurn(turnContext, options)
        }
        return streamMoATurn(turnContext, options)
      }

      return next(options)
    })
  }, 'dsh-moa: llm stream interceptor')
}

export { runMoAPipeline } from './moa-runner.js'
export { MoaService } from './moa-service.js'
export { MOA_EVENTS, emitEvent } from './events.js'
export { executeTestGateForCandidates, runCandidateTestGate } from './moa-test-gate.js'
export {
  COMPANION_PLUGINS,
  formatFileScoresDirective,
  parseFileScores,
  findTopModel,
  assembleWorkbenchSelection,
  handleWorkbenchGet,
  handleWorkbenchAssemble,
} from './moa-workbench.js'
export { registerMoaCommands } from './commands.js'
export {
  MoaError,
  RateLimitError,
  ContextOverflowError,
  AuthenticationError,
  ModelNotFoundError,
  TransientNetworkError,
  classifyLlmError,
  isFailoverEligible,
} from './errors.js'
export {
  validatePreset,
  validateAllPresets,
  getActiveLlmProviders,
  getActiveLlmModels,
} from './moa-model-validator.js'
export { applyTuiSettings, buildTuiSection } from './tui-settings.js'
export {
  calculateTokenEntropy,
  analyzeCandidateUncertainty,
  formatUncertaintyAnnotations,
} from './moa-uncertainty.js'
export {
  classifyPromptDomain,
  assignAdaptivePersonas,
  DOMAIN_PERSONA_POOLS,
} from './moa-adaptive-personas.js'
export {
  isGitRepository,
  createSwarmWorktree,
  collectSwarmWorktreeDiff,
  cleanupSwarmWorktrees,
  runSubagentSwarm,
} from './moa-swarm.js'
