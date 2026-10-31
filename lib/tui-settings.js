/**
 * DSH Terminal User Interface (TUI) Settings Section for dsh-moa (#277)
 */

import { service } from './services.js'

function boolFormat(value) {
  return value === false ? 'false' : 'true'
}

function boolParse(text) {
  return { kind: 'set', value: String(text).trim() === 'true' }
}

/**
 * Builds the TUI settings section descriptor from live configuration.
 *
 * @param {{ live: () => Record<string, any> }} deps
 * @returns {object}
 */
export function buildTuiSection({ live }) {
  const cfg = (typeof live === 'function' ? live() : live) || {}
  const presets = Array.isArray(cfg.presets) ? cfg.presets : []
  const presetOptions = presets.length > 0
    ? presets.map((p) => ({
        value: String(p.name || p.id || ''),
        label: `${p.name || p.id} (${(p.reference_models || p.references || []).length} models)`,
      })).filter((o) => o.value !== '')
    : [{ value: 'default', label: 'default' }]

  const fields = [
    {
      path: ['enabled'],
      group: 'general',
      kind: 'boolean',
      label: 'Enable MoA (/moa slash command)',
      hint: 'Master switch for Mixture of Agents turn routing.',
      format: boolFormat,
      parse: boolParse,
    },
    {
      path: ['default_preset'],
      group: 'general',
      kind: 'text',
      label: 'Default preset',
      hint: 'Active consensus preset used when /moa is invoked without --preset.',
      options: presetOptions,
      format: (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : 'default'),
      parse: (text) => {
        const value = String(text).trim()
        return value === '' ? { kind: 'set', value: 'default' } : { kind: 'set', value }
      },
    },
    {
      path: ['interactive_workbench_enabled'],
      group: 'pipeline',
      kind: 'boolean',
      label: 'Interactive Workbench',
      hint: 'Enable interactive per-file candidate assembly workbench.',
      format: (val) => (val === true ? 'true' : 'false'),
      parse: boolParse,
    },
    {
      path: ['ask_clarifying_questions'],
      group: 'pipeline',
      kind: 'boolean',
      label: 'Ask clarifying questions',
      hint: 'Prompt user for clarification on broad or ambiguous requests before running ensemble.',
      format: boolFormat,
      parse: boolParse,
    },
    {
      path: ['test_gate_enabled'],
      group: 'pipeline',
      kind: 'boolean',
      label: 'Test Execution Gate',
      hint: 'Run syntax and unit test checks against candidate solutions before judge ranking.',
      format: (val) => (val === true ? 'true' : 'false'),
      parse: boolParse,
    },
    {
      path: ['smart_routing_enabled'],
      group: 'advanced',
      kind: 'boolean',
      label: 'Smart Routing',
      hint: 'Automatically select the best preset based on prompt complexity.',
      format: (val) => (val === true ? 'true' : 'false'),
      parse: boolParse,
    },
    {
      path: ['uncertainty_scoring_enabled'],
      group: 'advanced',
      kind: 'boolean',
      label: 'Token Uncertainty Scoring',
      hint: 'Calculate token-level entropy from logprobs to highlight potential hallucinations for the judge.',
      format: (val) => (val === true ? 'true' : 'false'),
      parse: boolParse,
    },
  ]

  return {
    ns: 'dsh-moa',
    title: 'Mixture of Agents (MoA)',
    descriptions: {
      en: 'Multi-model ensemble synthesis, judge consensus, and pipeline verification controls.',
      zh: '多模型集成合成、裁判共识与流水线验证设置。',
    },
    groups: [
      { id: 'general', title: 'General', descriptions: { zh: '常规' } },
      { id: 'pipeline', title: 'Pipeline & Gates', descriptions: { zh: '流水线与验证' } },
      { id: 'advanced', title: 'Advanced', descriptions: { zh: '高级' } },
    ],
    fields,
  }
}

/**
 * Registers the TUI settings section when the host provides tuiSettingsSections.
 *
 * @param {object} ctx
 * @param {{ live: () => Record<string, any> }} deps
 */
export function applyTuiSettings(ctx, { live }) {
  const registerWithService = (tuiCtx) => {
    if (!tuiCtx) return
    const tuiService = service(tuiCtx, 'tuiSettingsSections')
    if (!tuiService || typeof tuiService.register !== 'function') return
    try {
      const dispose = tuiService.register(buildTuiSection({ live }))
      const eff = typeof tuiCtx.effect === 'function' ? tuiCtx.effect : (typeof ctx?.effect === 'function' ? ctx.effect : null)
      if (eff) {
        eff(() => () => {
          try { if (typeof dispose === 'function') dispose() } catch {}
        }, 'dsh-moa: tui settings')
      }
    } catch (err) {
      ctx?.logger?.warn?.('[dsh-moa] Could not register TUI settings: ' + (err?.message || err))
    }
  }

  if (service(ctx, 'tuiSettingsSections')?.register) {
    registerWithService(ctx)
  } else if (typeof ctx?.inject === 'function') {
    ctx.inject(['tuiSettingsSections'], registerWithService)
  }
}
