/**
 * Official Slash Command Registration for /moa via dsh-commands service (#275)
 */

import { service } from './services.js'

export function registerMoaCommands(ctx, { live, moaService }) {
  const registerWithService = (cmdCtx) => {
    if (!cmdCtx) return
    const commands = service(cmdCtx, 'commands')
    if (!commands || typeof commands.register !== 'function') return

    const formatPresetsList = (cfg) => {
      const presets = Array.isArray(cfg?.presets) ? cfg.presets : []
      if (presets.length === 0) return 'No presets configured in dsh-moa.'
      return '### 🧠 Configured MoA Presets:\n' + presets.map((p, i) =>
        `- **${p.name}** (${p.id || `preset-${i + 1}`}): ${p.description || 'Consensus preset'} | ${p.references?.length || p.reference_models?.length || 0} advisors`
      ).join('\n')
    }

    const commandHandler = async (invocation) => {
      const rawText = typeof invocation === 'string' ? invocation : (invocation?.text || invocation?.raw || invocation?.args || '')
      const trimmed = String(rawText).trim()

      if (!trimmed || trimmed === 'help' || trimmed === '--help') {
        return {
          text: '🧠 **MoA Command Guide**:\n- `/moa presets` — list configured presets\n- `/moa history` — view recent runs\n- `/moa status` — check plugin status\n- `/moa [--preset <name>] <prompt>` — run MoA consensus in chat',
        }
      }

      if (trimmed === 'presets' || trimmed === 'list') {
        const cfg = typeof live === 'function' ? live() : {}
        return { text: formatPresetsList(cfg) }
      }

      if (trimmed === 'status') {
        const cfg = typeof live === 'function' ? live() : {}
        return {
          text: `🧠 **MoA Plugin Status**: ${cfg?.enabled !== false ? 'Enabled' : 'Disabled'} | Default preset: \`${cfg?.default_preset || 'default'}\``,
        }
      }

      if (trimmed === 'history') {
        const hist = moaService?.getHistory ? moaService.getHistory(5, 0) : { runs: [] }
        if (!hist?.runs?.length) return { text: 'No MoA runs recorded in history.' }
        return {
          text: '### 📜 Recent MoA Runs:\n' + hist.runs.slice(0, 5).map((r) =>
            `- \`${r.id?.slice(0, 8)}\` (${r.preset || 'default'}): "${r.prompt?.slice(0, 40)}..." (Winner: ${r.winnerModel || 'none'}, $${(r.totalCostUsd || 0).toFixed(4)})`
          ).join('\n'),
        }
      }

      return {
        text: `🧠 MoA turn dispatched: "${trimmed}". The turn will execute with live consensus streaming.`,
      }
    }

    const unregister = commands.register({
      definitionId: '@goodandready/dsh-moa',
      name: 'moa',
      description: 'Run Mixture of Agents consensus or inspect presets (/moa [presets|history|status|<prompt>])',
      input: { hint: '[presets|history|status|<prompt>]' },
      handler: commandHandler,
      execute: async (rawArgs, invocation = null) => {
        const res = await commandHandler(invocation || rawArgs)
        return res?.text || String(res || '')
      },
    })

    const eff = typeof cmdCtx.effect === 'function' ? cmdCtx.effect : (fn) => fn()
    eff(() => () => {
      try {
        if (typeof unregister === 'function') unregister()
      } catch (_e) {}
    }, 'dsh-moa: slash command registration')
  }

  if (service(ctx, 'commands')?.register) {
    registerWithService(ctx)
  } else if (typeof ctx.inject === 'function') {
    ctx.inject(['commands'], registerWithService)
  }
}
