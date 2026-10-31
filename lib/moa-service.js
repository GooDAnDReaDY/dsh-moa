/**
 * Native Cordis Service: ctx.moa
 * Allows in-process MoA consensus pipeline execution and telemetry by peer plugins.
 */

import { emitEvent, MOA_EVENTS } from './events.js'

export class MoaService {
  /**
   * @param {import('@deepseek-ai/cordis').Context} ctx
   * @param {object} [deps={}]
   */
  constructor(ctx, deps = {}) {
    this.ctx = ctx
    this.deps = deps
  }

  get live() {
    return typeof this.deps.live === 'function' ? this.deps.live() : (this.deps.live || {})
  }

  /**
   * Get all active configured presets
   * @returns {Array<object>}
   */
  getPresets() {
    const cfg = this.live
    return Array.isArray(cfg?.presets) ? [...cfg.presets] : []
  }

  /**
   * Get preset by ID or name
   * @param {string} [idOrName]
   * @returns {object|null}
   */
  getPreset(idOrName) {
    const presets = this.getPresets()
    if (!idOrName) return presets[0] || null
    return presets.find((p) => p.id === idOrName || p.name === idOrName) || presets[0] || null
  }

  /**
   * Get historical MoA runs
   * @param {number} [limit=20]
   * @param {number} [offset=0]
   * @returns {object}
   */
  getHistory(limit = 20, offset = 0) {
    const getHistoryFn = this.deps.getMoaHistory
    if (typeof getHistoryFn === 'function') {
      return getHistoryFn(limit, offset)
    }
    return { runs: [], total: 0 }
  }

  /**
   * Resolve best preset for a given user prompt
   * @param {string} prompt
   * @returns {Promise<object>}
   */
  async resolvePresetForPrompt(prompt) {
    const resolveFn = this.deps.resolvePresetForPrompt
    if (typeof resolveFn === 'function') {
      return resolveFn({ prompt, live: () => this.live, callLlm: this.deps.callLlm })
    }
    return { preset: this.getPreset() }
  }

  /**
   * Run MoA consensus pipeline in-process
   * @param {object} options
   * @returns {Promise<object>}
   */
  async run(options = {}) {
    const runFn = this.deps.runMoAPipeline
    if (typeof runFn !== 'function') {
      throw new Error('[dsh-moa] runMoAPipeline is not available in MoaService')
    }

    const {
      prompt,
      userPrompt,
      messages = [],
      preset: customPreset,
      presetId,
      cwd = process.cwd(),
      signal,
      onProgress,
      onStreamDelta,
      checkpoint,
      force,
      testGateEnabled,
      testCommand,
    } = options

    const effectivePrompt = prompt || userPrompt || (messages[messages.length - 1]?.content) || ''
    if (!effectivePrompt && messages.length === 0) {
      throw new Error('[dsh-moa] prompt or userPrompt is required to run MoA')
    }

    let preset = customPreset
    if (!preset) {
      if (presetId) {
        preset = this.getPreset(presetId)
      } else {
        const routed = await this.resolvePresetForPrompt(effectivePrompt)
        preset = routed?.preset || this.getPreset()
      }
    }

    const cfg = this.live
    return runFn({
      userPrompt: effectivePrompt,
      messages,
      preset,
      callLlm: options.callLlm || this.deps.callLlm,
      cwd,
      prices: options.prices || cfg?.prices || this.deps.prices || {},
      onProgress,
      onStreamDelta,
      signal,
      checkpoint,
      force,
      testGateEnabled,
      testCommand,
      liveCanvas: options.liveCanvas || this.deps.liveCanvas,
      webServerPort: options.webServerPort || this.deps.webServerPort,
      timeMachineEngine: options.timeMachineEngine || this.deps.timeMachineEngine,
      historyFilePath: options.historyFilePath || this.deps.historyFilePath,
      ctx: this.ctx,
    })
  }

  /**
   * Attach listener to MoA events on the underlying Cordis Context
   * @param {string} event
   * @param {Function} listener
   * @returns {Function|undefined}
   */
  on(event, listener) {
    if (typeof this.ctx?.on === 'function') {
      return this.ctx.on(event, listener)
    }
    return undefined
  }

  /**
   * Emit an event on the Cordis event bus
   * @param {string} event
   * @param {any} payload
   */
  emit(event, payload) {
    emitEvent(this.ctx, event, payload)
  }
}
