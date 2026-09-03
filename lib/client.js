window.__ModuleLoader__.load({
  id: '@goodandready/dsh-moa',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    let React = require('react')

    const NS = 'dsh-moa'

    let ChevronIcon = null
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
      ChevronIcon = primitives && primitives.IconChevronDownOutline14
    } catch {
      ChevronIcon = null
    }

    function FallbackChevron({ className }) {
      return React.createElement(
        'svg',
        {
          className,
          width: 14,
          height: 14,
          viewBox: '0 0 14 14',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement('path', { d: 'M3.5 5.25L7 8.75L10.5 5.25' })
      )
    }

    const Chevron = ChevronIcon || FallbackChevron

    const STYLES = `
      .moa-card { border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); border-radius:12px; list-style:none; margin-bottom:12px; }
      .moa-head { appearance:none; width:100%; font:inherit; color:inherit; text-align:left; cursor:pointer; background:0 0; border:0; border-radius:12px; display:flex; align-items:center; gap:12px; padding:14px 16px; }
      .moa-head:focus-visible { outline:2px solid var(--dsw-alias-label-primary); outline-offset:2px; }
      .moa-title { color:var(--dsw-alias-label-primary); font-size:15px; font-weight:600; line-height:1.4; }
      .moa-sub { color:var(--dsw-alias-label-secondary); font-size:13px; margin-top:2px; }
      .moa-chev { margin-left:auto; flex:none; color:var(--dsw-alias-label-tertiary); transition:transform .16s ease; }
      .moa-chev-open { transform:rotate(180deg); }
      .moa-body { border-top:1px solid var(--dsw-alias-border-l2); margin:0 16px; padding:12px 0 16px; display:flex; flex-direction:column; gap:12px; }
      .moa-field { display:flex; flex-direction:column; gap:6px; }
      .moa-label { font-size:13px; font-weight:500; color:var(--dsw-alias-label-primary); }
      .moa-hint { font-size:12px; color:var(--dsw-alias-label-secondary); }
      .moa-input { height:34px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); border-radius:8px; padding:0 12px; font-size:13px; }
      .moa-input:focus { outline:1px solid var(--dsw-alias-label-primary); }
      .moa-presets { display:flex; flex-direction:column; gap:8px; }
      .moa-preset-item { border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:10px 12px; background:var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.02)); }
      .moa-preset-header { font-size:13px; font-weight:600; color:var(--dsw-alias-label-primary); margin-bottom:4px; display:flex; align-items:center; justify-content:space-between; }
      .moa-foot { border-top:1px solid var(--dsw-alias-border-l2); display:flex; justify-content:flex-end; align-items:center; gap:8px; padding:12px 0 4px; }
      .moa-save { appearance:none; font:inherit; cursor:pointer; border:1px solid transparent; border-radius:8px; padding:6px 16px; font-size:13px; font-weight:500; background:var(--dsw-alias-label-primary); color:var(--dsw-alias-bg-layer-3); transition:opacity .15s; }
      .moa-save:hover { opacity:0.9; }
      .moa-status-text { font-size:12px; color:var(--dsw-alias-label-secondary); }
    `

    let stylesInjected = false
    function ensureStyles() {
      if (stylesInjected || typeof document === 'undefined') return
      stylesInjected = true
      const style = document.createElement('style')
      style.textContent = STYLES
      document.head.appendChild(style)
    }

    function MoACard(props) {
      ensureStyles()
      const t = props.t || ((k) => k)
      const [open, setOpen] = React.useState(false)
      const [status, setStatus] = React.useState('loading')
      const [presets, setPresets] = React.useState([])
      const [defaultPreset, setDefaultPreset] = React.useState('default')
      const [saveStatus, setSaveStatus] = React.useState('')

      React.useEffect(() => {
        let mounted = true
        fetch('/dsh-moa/presets', { cache: 'no-store' })
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json()
          })
          .then((data) => {
            if (!mounted) return
            if (data && data.ok) {
              setPresets(data.presets || [])
              setDefaultPreset(data.defaultPreset || 'default')
              setStatus('ready')
            } else {
              setStatus('unavailable')
            }
          })
          .catch(() => {
            if (mounted) setStatus('unavailable')
          })

        return () => {
          mounted = false
        }
      }, [])

      const handleSave = () => {
        setSaveStatus(t('loading'))
        fetch('/dsh-moa/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presets, default_preset: defaultPreset }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) {
              setSaveStatus(t('saved'))
              setTimeout(() => setSaveStatus(''), 2000)
            } else {
              setSaveStatus('Error saving')
            }
          })
          .catch((err) => {
            setSaveStatus(`Error: ${err.message || err}`)
          })
      }

      const isUnavailable = status === 'unavailable'

      return React.createElement(
        'li',
        { className: 'moa-card' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'moa-head',
            'aria-expanded': open,
            onClick: () => setOpen(!open),
          },
          React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'moa-title' }, t('title')),
            React.createElement('div', { className: 'moa-sub' }, t('description'))
          ),
          React.createElement(Chevron, {
            className: open ? 'moa-chev moa-chev-open' : 'moa-chev',
          })
        ),
        open &&
          React.createElement(
            'div',
            { className: 'moa-body' },
            isUnavailable
              ? React.createElement('div', { className: 'moa-hint' }, t('unavailable'))
              : React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    'div',
                    { className: 'moa-field' },
                    React.createElement('label', { className: 'moa-label' }, t('defaultPreset')),
                    React.createElement('input', {
                      className: 'moa-input',
                      value: defaultPreset,
                      onChange: (e) => setDefaultPreset(e.target.value),
                    })
                  ),
                  React.createElement(
                    'div',
                    { className: 'moa-field' },
                    React.createElement('span', { className: 'moa-label' }, t('presets')),
                    React.createElement(
                      'div',
                      { className: 'moa-presets' },
                      presets.map((preset, idx) => {
                        const refsStr = (preset.reference_models || [])
                          .map((m) => `${m.provider}:${m.model}`)
                          .join(', ')
                        const aggStr = preset.aggregator
                          ? `${preset.aggregator.provider}:${preset.aggregator.model}`
                          : 'default'
                        return React.createElement(
                          'div',
                          { key: preset.name || idx, className: 'moa-preset-item' },
                          React.createElement(
                            'div',
                            { className: 'moa-preset-header' },
                            preset.name,
                            React.createElement(
                              'span',
                              { className: 'moa-hint' },
                              `T: ${preset.reference_temperature ?? 0.6} / ${preset.aggregator_temperature ?? 0.4}`
                            )
                          ),
                          React.createElement(
                            'div',
                            { className: 'moa-hint' },
                            `${t('referenceModels')}: ${refsStr || '(none)'}`
                          ),
                          React.createElement(
                            'div',
                            { className: 'moa-hint' },
                            `${t('aggregator')}: ${aggStr}`
                          )
                        )
                      })
                    )
                  ),
                  React.createElement(
                    'div',
                    { className: 'moa-foot' },
                    saveStatus && React.createElement('span', { className: 'moa-status-text' }, saveStatus),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'moa-save',
                        onClick: handleSave,
                      },
                      t('save')
                    )
                  )
                )
          )
      )
    }

    exports.inject = ['slots', 'locale', 'sessions']
    exports.apply = function apply(ctx) {
      ctx.locale.register(NS, {
        en: {
          title: 'Mixture of Agents (MoA)',
          description: 'Run tasks with multiple parallel proposer models and a synthesizing judge model',
          slashMoa: 'Run task through Mixture of Agents (/moa <prompt>)',
          defaultPreset: 'Default Preset',
          presets: 'Configured Presets',
          referenceModels: 'Proposer Models (Advisors)',
          aggregator: 'Aggregator Model (Judge)',
          save: 'Save Changes',
          saved: 'Saved successfully',
          loading: 'Loading settings...',
          unavailable: 'MoA service unavailable',
        },
        ru: {
          title: 'Mixture of Agents (MoA)',
          description: 'Запуск задач через ансамбль параллельных моделей-советников и модель-судью',
          slashMoa: 'Запустить задачу через архитектуру Mixture of Agents (/moa <prompt>)',
          defaultPreset: 'Основной пресет',
          presets: 'Настроенные пресеты',
          referenceModels: 'Модели-кандидаты (советники)',
          aggregator: 'Ведущая модель (судья / синтезатор)',
          save: 'Сохранить',
          saved: 'Успешно сохранено',
          loading: 'Загрузка настроек...',
          unavailable: 'Служба MoA недоступна',
        },
      })

      const t = ctx.locale.bind(NS)

      // Register settings card
      if (ctx.slots && typeof ctx.slots.register === 'function') {
        try {
          ctx.slots.register(
            {
              name: 'settings.plugin.item',
              key: NS,
              order: 35,
              locale: NS,
              label: () => t('title'),
              inject: () => ({ ctx }),
            },
            MoACard
          )
        } catch (err) {
          console.warn('[dsh-moa] Failed to register settings slot:', err)
        }
      }

      // Register slash command in composer
      ctx.effect(() => {
        const triggers = ctx.get ? ctx.get('inputTriggers') : ctx.inputTriggers
        if (!triggers || typeof triggers.registerSource !== 'function') return () => {}

        const dispose = triggers.registerSource({
          trigger: '/',
          name: 'moa',
          order: 35,
          description: t('slashMoa'),
          candidates: (_session, req) => {
            if (req.position !== 'leading') return Promise.resolve([])
            const q = req.query.trim().toLowerCase()
            if (q !== '' && !'moa'.startsWith(q)) return Promise.resolve([])
            return Promise.resolve([
              {
                name: 'moa',
                description: t('slashMoa'),
              },
            ])
          },
          matchEnter: (_session, _line) => {
            // Let the line submit naturally to the agent session
            return Promise.resolve(undefined)
          },
        })

        return () => {
          if (typeof dispose === 'function') dispose()
        }
      }, 'dsh-moa: slash command trigger')
    }

    return module.exports
  },
})
