// Plugin Settings Card (settings.plugin.item).
//
// Aligned with dsh-clinebot design language:
// - Header with real-time status chips (Host online, active preset, model counts)
// - Clean section cards (.moa-section-card) using native DSH design tokens (--dsw-alias-*)
// - Segmented preset selectors and count pills
// - Refined temperature sliders and searchable model picker
// - Statistics & telemetry summary grid
// - Robust error boundary and settingsScope reactivity

window.__ModuleLoader__.load({
  id: '@goodandready/dsh-moa',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')
    const NS = 'dsh-moa'
    const TITLE = 'Mixture of Agents (MoA)'
    const SUBTITLE = 'Ensemble parallel candidate generation with judge synthesis via /moa.'

    let rootCtx = null

    const en = {
      title: 'Mixture of Agents (MoA)',
      description: 'Ensemble model orchestration: parallel candidate proposals + judge synthesis via /moa <prompt>.',
      'header.title': 'Mixture of Agents (MoA) Orchestration',
      'header.sub': 'Parallel generation by candidate proposers with final evaluation and code promotion by a leading aggregator/judge. Returns to your session model automatically.',
      'badge.online': 'MoA Active',
      'badge.offline': 'Host Unreachable',
      'badge.preset': 'Preset: {name}',
      'badge.models': '{count} models available',
      'badge.candidates': '{count} proposers',
      'presets.title': '📋 Preset Management',
      'presets.desc': 'Select active preset or create custom configurations for specific tasks (e.g. code review, math, quick triage).',
      'presets.active_badge': 'Active Default',
      'presets.set_default': 'Set as Default',
      'presets.new_btn': '+ New Preset',
      'presets.del_btn': 'Delete',
      'presets.del_confirm': 'Are you sure you want to delete preset "{name}"?',
      'presets.create': 'Create',
      'presets.cancel': 'Cancel',
      'presets.name_placeholder': 'New preset name (e.g. fast-audit)',
      'aggregator.title': '⚖️ Leading Model / Judge (Synthesis & Audit)',
      'aggregator.desc': 'Compares candidate proposals, resolves discrepancies, filters hallucination, and synthesizes final solution.',
      'aggregator.temp_label': 'Judge Temperature',
      'aggregator.temp_hint': 'Recommended: 0.2 – 0.4 for strict validation and deterministic synthesis.',
      'aggregator.criteria_label': 'Judge Evaluation Criteria (Optional):',
      'aggregator.criteria_placeholder': 'e.g. Priority: performance, zero external dependencies, robust edge-case handling...',
      'aggregator.questions_label': 'Ask clarifying questions on broad tasks (Questionnaire)',
      'aggregator.questions_hint': 'When enabled: for short/vague prompts, the judge synthesizes a 2-4 question checklist before code generation.',
      'proposers.title': '👥 Candidate Models (Proposers)',
      'proposers.desc': 'Generate independent solutions in parallel to maximize diversity and solution space coverage.',
      'proposers.parallel_count': 'Parallel Proposers',
      'proposers.candidate': 'Candidate',
      'proposers.add_btn': '+ Add Candidate Model',
      'proposers.temp_label': 'Candidates Temperature',
      'proposers.temp_hint': 'Recommended: 0.6 – 0.8 for creative, independent solution exploration.',
      'stats.title': '📈 MoA Analytics & Telemetry',
      'stats.desc': 'Session telemetry, historical runs, and model win-rate tracking.',
      'stats.total_runs': 'Total Runs',
      'stats.avg_cost': 'Avg Run Cost',
      'stats.active_models': 'Configured Models',
      'stats.preset_count': 'Total Presets',
      'picker.select': 'Select model…',
      'picker.search_placeholder': 'Search model by name or provider…',
      'picker.found': 'Found',
      'picker.of': 'of',
      'picker.clear': 'Clear',
      'picker.none': 'No matching models found.',
      'picker.custom': 'Use custom: ',
      'actions.save': 'Save Configuration',
      'actions.saving': 'Saving…',
      'actions.saved': 'Configuration saved successfully!',
      'actions.retry': 'Retry Connection',
      'slash.desc': 'Run turn with Mixture of Agents ensemble synthesis (/moa [preset] <prompt>)',
    }

    const ru = {
      title: 'Mixture of Agents (MoA)',
      description: 'Ансамбль моделей: параллельная генерация советниками и синтез ведущим судьей через /moa <prompt>.',
      'header.title': 'Оркестрация Mixture of Agents (MoA)',
      'header.sub': 'Параллельная генерация вариантов советниками с оценкой и продвижением лучшего кода судьей. Модель сессии восстанавливается автоматически.',
      'badge.online': 'MoA Активен',
      'badge.offline': 'Хост недоступен',
      'badge.preset': 'Пресет: {name}',
      'badge.models': '{count} моделей доступно',
      'badge.candidates': '{count} советников',
      'presets.title': '📋 Управление пресетами',
      'presets.desc': 'Выберите активный пресет или создайте специализированную конфигурацию (например: для код-ревью, математики или быстрого скрипта).',
      'presets.active_badge': 'По умолчанию',
      'presets.set_default': 'Сделать по умолчанию',
      'presets.new_btn': '+ Создать пресет',
      'presets.del_btn': 'Удалить',
      'presets.del_confirm': 'Вы уверены, что хотите удалить пресет "{name}"?',
      'presets.create': 'Создать',
      'presets.cancel': 'Отмена',
      'presets.name_placeholder': 'Название нового пресета (например: fast-audit)',
      'aggregator.title': '⚖️ Ведущая модель / Судья (Синтез и аудит)',
      'aggregator.desc': 'Сопоставляет варианты кандидатов, устраняет ошибки, отбирает лучший код и синтезирует итоговое решение.',
      'aggregator.temp_label': 'Температура судьи',
      'aggregator.temp_hint': 'Рекомендуется 0.2 – 0.4 для строгой проверки и синтеза без выдумок.',
      'aggregator.criteria_label': 'Критерии оценки судьи (опционально):',
      'aggregator.criteria_placeholder': 'например: Приоритет — производительность, чистый код, минимум зависимостей, тесты...',
      'aggregator.questions_label': 'Спрашивать уточняющие вопросы при неясных задачах (Опросник)',
      'aggregator.questions_hint': 'Если включено: при коротких задачах судья сформирует опросник. Если выключено: MoA сразу переходит к генерации решения.',
      'proposers.title': '👥 Модели-кандидаты (Советники)',
      'proposers.desc': 'Параллельно формируют независимые варианты решения одной задачи.',
      'proposers.parallel_count': 'Параллельных моделей',
      'proposers.candidate': 'Кандидат',
      'proposers.add_btn': '+ Добавить модель в параллель',
      'proposers.temp_label': 'Температура кандидатов',
      'proposers.temp_hint': 'Рекомендуется 0.6 – 0.8 для получения независимых и разнообразных вариантов.',
      'stats.title': '📈 Аналитика и телеметрия MoA',
      'stats.desc': 'Мониторинг запусков, статистика побед моделей и оценка расхода токенов.',
      'stats.total_runs': 'Всего запусков MoA',
      'stats.avg_cost': 'Средняя стоимость',
      'stats.active_models': 'Настроено моделей',
      'stats.preset_count': 'Всего пресетов',
      'picker.select': 'Выберите модель…',
      'picker.search_placeholder': 'Поиск модели по названию или провайдеру…',
      'picker.found': 'Найдено',
      'picker.of': 'из',
      'picker.clear': 'Сбросить',
      'picker.none': 'Модели не найдены.',
      'picker.custom': 'Использовать: ',
      'actions.save': 'Сохранить настройки',
      'actions.saving': 'Сохранение…',
      'actions.saved': 'Настройки успешно сохранены!',
      'actions.retry': 'Повторить подключение',
      'slash.desc': 'Запуск ансамбля Mixture of Agents (/moa [preset] <prompt>)',
    }

    function makeT(dict, fallback) {
      return function t(key, vars) {
        let val = (dict && dict[key]) || (fallback && fallback[key]) || key
        if (vars && typeof val === 'string') {
          for (const k of Object.keys(vars)) {
            val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]))
          }
        }
        return val
      }
    }

    function FallbackChevron({ className, style }) {
      return React.createElement(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 14 14',
          fill: 'none',
          'aria-hidden': true,
          className,
          style,
        },
        React.createElement('path', {
          d: 'M3.5 5.25L7 8.75L10.5 5.25',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      )
    }
    const Chevron = FallbackChevron

    const STYLES = `
/* dsh-moa modern clinebot-aligned styling */
.moa-page{display:flex;flex-direction:column;gap:18px;padding:4px 0 24px;max-width:960px}
.moa-header{display:flex;flex-direction:column;gap:8px;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.moa-page-title{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.moa-page-sub{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5}

.moa-badge-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:2px}
.moa-badge{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:5px;font-weight:500}
.moa-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:rgba(16,185,129,0.08)}
.moa-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:rgba(245,158,11,0.08)}
.moa-badge-brand{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}

.moa-section-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.moa-section-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.moa-section-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-6px;line-height:1.4}

.moa-grid-2{display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px}
.moa-stat-box{padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:4px}
.moa-stat-val{font-size:18px;font-weight:700;color:var(--dsw-alias-label-primary)}
.moa-stat-lbl{font-size:12px;color:var(--dsw-alias-label-secondary)}

.moa-input{height:36px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;width:100%;box-sizing:border-box}
.moa-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))}
.moa-textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;resize:vertical;outline:none;line-height:1.4}
.moa-textarea:focus{border-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))}

.moa-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 14px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}
.moa-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-1));border-color:var(--dsw-alias-label-secondary)}
.moa-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.moa-btn-primary:hover:not(:disabled){background:var(--dsw-alias-label-primary) !important;color:var(--dsw-alias-bg-layer-3) !important;opacity:0.9}
.moa-btn-danger{color:var(--dsw-alias-state-error-primary, #ef4444);border-color:rgba(239,68,68,0.3)}
.moa-btn-danger:hover:not(:disabled){background:rgba(239,68,68,0.12) !important;border-color:rgba(239,68,68,0.5)}
.moa-btn-sub{padding:5px 12px;font-size:12px;border-radius:6px}

/* Segmented Buttons */
.moa-seg-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.moa-seg-btn{appearance:none;font:inherit;padding:6px 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s ease}
.moa-seg-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-secondary)}
.moa-seg-btn-active{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent;font-weight:600}
.moa-seg-btn-active:hover{background:var(--dsw-alias-label-primary) !important;color:var(--dsw-alias-bg-layer-3) !important}

/* Sliders */
.moa-slider-row{display:flex;align-items:center;gap:14px}
.moa-slider{flex:1;accent-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary));cursor:pointer;height:6px}
.moa-slider-badge{min-width:48px;height:30px;padding:0 8px;display:flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:6px;font-size:13px;font-weight:700;color:var(--dsw-alias-label-primary)}

/* Candidate Rows */
.moa-cand-list{display:flex;flex-direction:column;gap:10px}
.moa-cand-row{display:flex;align-items:center;gap:10px}
.moa-cand-badge{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);min-width:92px;flex-shrink:0}
.moa-cand-picker{flex:1;min-width:0}

/* Searchable Model Picker */
.moa-picker-container{position:relative;width:100%}
.moa-picker-btn{width:100%;min-height:38px;padding:6px 12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:13px;text-align:left;box-sizing:border-box;gap:8px}
.moa-picker-btn:hover{border-color:var(--dsw-alias-label-secondary)}
.moa-picker-summary{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.moa-prov-chip{font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.08));color:var(--dsw-alias-label-secondary);flex-shrink:0}
.moa-model-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.moa-picker-popover{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,0.45);z-index:1000;max-height:360px;display:flex;flex-direction:column;overflow:hidden}
.moa-picker-search-bar{padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:4px}
.moa-search-input{width:100%;height:32px;padding:0 10px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:13px;outline:none;box-sizing:border-box}
.moa-search-input:focus{border-color:var(--dsw-alias-label-primary)}
.moa-search-info{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:0 2px;display:flex;justify-content:space-between}
.moa-picker-list{overflow-y:auto;max-height:280px;padding:6px;display:flex;flex-direction:column;gap:2px}
.moa-group-title{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:8px 8px 4px}
.moa-picker-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:6px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;border:none;background:transparent;width:100%;gap:8px}
.moa-picker-item:hover, .moa-picker-item-selected{background:var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.06))}
.moa-picker-check{color:var(--dsw-alias-state-success-primary, #10b981);font-weight:bold;font-size:14px;flex-shrink:0}
.moa-custom-opt{padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);font-size:12px;color:var(--dsw-alias-label-primary);cursor:pointer;display:flex;align-items:center;gap:6px}

/* Alerts & Collapsible Card */
.moa-alert-ok{padding:10px 14px;border-radius:8px;background:rgba(16,185,129,0.1);color:var(--dsw-alias-state-success-primary);font-size:13px;font-weight:500}
.moa-alert-err{padding:10px 14px;border-radius:8px;background:rgba(239,68,68,0.1);color:var(--dsw-alias-state-error-primary);font-size:13px;font-weight:500}
.moa-card{list-style:none;margin:0;padding:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;overflow:hidden;transition:border-color .15s ease}
.moa-head{width:100%;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:transparent;border:none;color:inherit;cursor:pointer;text-align:left}
.moa-head:hover{background:var(--dsw-alias-bg-layer-2)}
.moa-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.moa-sub{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.moa-chev{transition:transform .2s ease;color:var(--dsw-alias-label-secondary)}
.moa-chev-open{transform:rotate(180deg)}
.moa-body{padding:0 18px 20px;border-top:1px solid var(--dsw-alias-border-l2)}
`

    let stylesInjected = false
    function ensureStyles() {
      if (stylesInjected || typeof document === 'undefined') return
      stylesInjected = true
      const style = document.createElement('style')
      style.id = 'dsh-moa-full-css'
      if (style.dataset) {
        style.dataset.dshPlugin = NS
      } else if (typeof style.setAttribute === 'function') {
        style.setAttribute('data-dsh-plugin', NS)
      }
      style.textContent = STYLES
      document.head.appendChild(style)
    }

    const PROVIDER_TITLES = {
      codex: 'ChatGPT Codex',
      claude: 'Claude (Anthropic)',
      grok: 'Grok (xAI)',
      antigravity: 'Antigravity (Google)',
      gemini: 'Google Gemini',
      commandcode: 'CommandCode Provider',
      'opencode-go': 'OpenCode-Go',
      'qwen-token-plan': 'Qwen (Token Plan)',
      groq: 'Groq Cloud',
      zai: 'Zhipu GLM',
      ollama: 'Ollama (Local / Cloud)',
      'kimi-coding': 'Kimi Coding',
      minimax: 'MiniMax',
      'xiaomi-token-plan-sgp': 'Xiaomi Token Plan',
      'deepseek-official': 'DeepSeek Official',
    }

    function SearchableModelPicker({
      provider,
      model,
      onChange,
      availableModels = [],
      t,
    }) {
      const [open, setOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const rootRef = React.useRef(null)
      const inputRef = React.useRef(null)

      const selectedLabel = React.useMemo(() => {
        if (!provider && !model) return t('picker.select')
        const found = availableModels.find((m) => m.provider === provider && m.model === model)
        return found ? (found.label || `${provider}: ${found.model}`) : `${provider}:${model}`
      }, [availableModels, provider, model, t])

      const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return availableModels
        return availableModels.filter((m) => {
          const prov = (m.provider || '').toLowerCase()
          const mod = (m.model || '').toLowerCase()
          const lbl = (m.label || '').toLowerCase()
          return prov.includes(q) || mod.includes(q) || lbl.includes(q)
        })
      }, [availableModels, query])

      const grouped = React.useMemo(() => {
        const map = new Map()
        for (const m of filtered) {
          const p = m.provider || 'other'
          if (!map.has(p)) map.set(p, [])
          map.get(p).push(m)
        }
        const groups = []
        for (const [prov, items] of map.entries()) {
          const title = PROVIDER_TITLES[prov] || prov.toUpperCase()
          groups.push({ provider: prov, title, items })
        }
        return groups
      }, [filtered])

      React.useEffect(() => {
        if (!open) return
        const handleClickOutside = (e) => {
          if (rootRef.current && !rootRef.current.contains(e.target)) {
            setOpen(false)
          }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }, [open])

      React.useEffect(() => {
        if (open && inputRef.current) {
          inputRef.current.focus()
        }
      }, [open])

      const handleSelect = (item) => {
        onChange(item.provider, item.model)
        setOpen(false)
        setQuery('')
      }

      const handleCustom = () => {
        const trimmed = query.trim()
        if (!trimmed) return
        let prov = provider || 'custom'
        let mod = trimmed
        if (trimmed.includes(':')) {
          const [p, ...rest] = trimmed.split(':')
          prov = p.trim()
          mod = rest.join(':').trim()
        }
        onChange(prov, mod)
        setOpen(false)
        setQuery('')
      }

      return React.createElement(
        'div',
        { className: 'moa-picker-container', ref: rootRef },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'moa-picker-btn',
            onClick: () => setOpen(!open),
          },
          React.createElement(
            'div',
            { className: 'moa-picker-summary' },
            provider && React.createElement('span', { className: 'moa-prov-chip' }, provider),
            React.createElement('span', { className: 'moa-model-name' }, selectedLabel)
          ),
          React.createElement(Chevron, { style: { transform: open ? 'rotate(180deg)' : 'none' } })
        ),
        open &&
          React.createElement(
            'div',
            { className: 'moa-picker-popover' },
            React.createElement(
              'div',
              { className: 'moa-picker-search-bar' },
              React.createElement('input', {
                ref: inputRef,
                type: 'text',
                className: 'moa-search-input',
                placeholder: t('picker.search_placeholder'),
                value: query,
                onChange: (e) => setQuery(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Escape') setOpen(false)
                  if (e.key === 'Enter' && query.trim()) handleCustom()
                },
              }),
              React.createElement(
                'div',
                { className: 'moa-search-info' },
                React.createElement(
                  'span',
                  null,
                  `${t('picker.found')}: ${filtered.length} ${t('picker.of')} ${availableModels.length}`
                ),
                query &&
                  React.createElement(
                    'span',
                    { style: { cursor: 'pointer', textDecoration: 'underline' }, onClick: () => setQuery('') },
                    t('picker.clear')
                  )
              )
            ),
            React.createElement(
              'div',
              { className: 'moa-picker-list' },
              grouped.map((g) =>
                React.createElement(
                  React.Fragment,
                  { key: g.provider },
                  React.createElement('div', { className: 'moa-group-title' }, g.title),
                  g.items.map((item) => {
                    const isCur = item.provider === provider && item.model === model
                    return React.createElement(
                      'button',
                      {
                        key: `${item.provider}:${item.model}`,
                        type: 'button',
                        className: isCur ? 'moa-picker-item moa-picker-item-selected' : 'moa-picker-item',
                        onClick: () => handleSelect(item),
                      },
                      React.createElement(
                        'div',
                        { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
                        React.createElement('span', { className: 'moa-prov-chip' }, item.provider),
                        React.createElement('span', { className: 'moa-model-name' }, item.label || item.model)
                      ),
                      isCur && React.createElement('span', { className: 'moa-picker-check' }, '✓')
                    )
                  })
                )
              ),
              filtered.length === 0 &&
                React.createElement(
                  'div',
                  { style: { padding: '12px 10px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } },
                  t('picker.none')
                )
            ),
            query.trim() &&
              React.createElement(
                'div',
                { className: 'moa-custom-opt', onClick: handleCustom },
                React.createElement('span', null, '➕'),
                React.createElement(
                  'span',
                  null,
                  `${t('picker.custom')}"${query.trim()}"`
                )
              )
          )
      )
    }

    function MoAEditor({
      t,
      presets,
      setPresets,
      defaultPreset,
      setDefaultPreset,
      availableModels,
      handleSave,
      saveStatus,
      reload,
    }) {
      const [selectedPresetName, setSelectedPresetName] = React.useState(defaultPreset || (presets[0] && presets[0].name) || 'default')
      const [isCreating, setIsCreating] = React.useState(false)
      const [newPresetName, setNewPresetName] = React.useState('')

      React.useEffect(() => {
        if (!presets.some((p) => p.name === selectedPresetName)) {
          setSelectedPresetName(defaultPreset || (presets[0] && presets[0].name) || 'default')
        }
      }, [presets, selectedPresetName, defaultPreset])

      const currentPreset = presets.find((p) => p.name === selectedPresetName) || presets[0] || {
        name: 'default',
        reference_models: [],
        aggregator: { provider: 'codex', model: 'gpt-5.6-sol' },
        aggregator_temperature: 0.4,
        reference_temperature: 0.6,
        judge_criteria: '',
        ask_clarifying_questions: true,
      }

      const updateCurrentPreset = (modifier) => {
        setPresets((prev) => {
          const copy = structuredClone(prev || [])
          const idx = copy.findIndex((p) => p.name === currentPreset.name)
          if (idx !== -1) {
            copy[idx] = modifier(copy[idx])
          }
          return copy
        })
      }

      const setAggregatorModel = (prov, mod) => {
        updateCurrentPreset((p) => ({ ...p, aggregator: { provider: prov, model: mod } }))
      }

      const setAggregatorTemp = (temp) => {
        const val = Math.round(Number(temp) * 100) / 100
        updateCurrentPreset((p) => ({ ...p, aggregator_temperature: val }))
      }

      const setReferenceTemp = (temp) => {
        const val = Math.round(Number(temp) * 100) / 100
        updateCurrentPreset((p) => ({ ...p, reference_temperature: val }))
      }

      const setJudgeCriteria = (criteria) => {
        updateCurrentPreset((p) => ({ ...p, judge_criteria: criteria }))
      }

      const setReferenceModel = (idx, prov, mod) => {
        updateCurrentPreset((p) => {
          const refs = [...(p.reference_models || [])]
          refs[idx] = { provider: prov, model: mod }
          return { ...p, reference_models: refs }
        })
      }

      const setReferenceCount = (targetCount) => {
        updateCurrentPreset((p) => {
          let refs = [...(p.reference_models || [])]
          if (refs.length > targetCount) {
            refs = refs.slice(0, targetCount)
          } else {
            while (refs.length < targetCount) {
              const fallback = availableModels[refs.length % (availableModels.length || 1)] || {
                provider: 'opencode-go',
                model: 'deepseek-v4-flash',
              }
              refs.push({ provider: fallback.provider, model: fallback.model })
            }
          }
          return { ...p, reference_models: refs }
        })
      }

      const removeReference = (idx) => {
        updateCurrentPreset((p) => {
          const refs = [...(p.reference_models || [])]
          refs.splice(idx, 1)
          return { ...p, reference_models: refs }
        })
      }

      const addReference = () => {
        updateCurrentPreset((p) => {
          const refs = [...(p.reference_models || [])]
          const fallback = availableModels[refs.length % (availableModels.length || 1)] || {
            provider: 'opencode-go',
            model: 'deepseek-v4-flash',
          }
          refs.push({ provider: fallback.provider, model: fallback.model })
          return { ...p, reference_models: refs }
        })
      }

      const handleCreatePreset = () => {
        const name = newPresetName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
        if (!name) return
        if (presets.some((p) => p.name === name)) {
          setSelectedPresetName(name)
          setIsCreating(false)
          setNewPresetName('')
          return
        }
        const created = {
          name,
          enabled: true,
          ask_clarifying_questions: true,
          reference_models: currentPreset?.reference_models?.length ? structuredClone(currentPreset.reference_models) : [
            { provider: 'opencode-go', model: 'deepseek-v4-flash' },
            { provider: 'codex', model: 'gpt-5.6-sol' },
          ],
          aggregator: currentPreset?.aggregator?.provider ? structuredClone(currentPreset.aggregator) : {
            provider: 'codex',
            model: 'gpt-5.6-sol',
          },
          reference_temperature: 0.6,
          aggregator_temperature: 0.4,
          max_tokens: 4096,
          judge_criteria: '',
        }
        setPresets((prev) => [...(prev || []), created])
        setSelectedPresetName(name)
        setIsCreating(false)
        setNewPresetName('')
      }

      const handleDeletePreset = (nameToDelete) => {
        if (presets.length <= 1) return
        if (typeof window !== 'undefined' && window.confirm) {
          if (!window.confirm(t('presets.del_confirm', { name: nameToDelete }))) return
        }
        setPresets((prev) => prev.filter((p) => p.name !== nameToDelete))
        if (defaultPreset === nameToDelete) {
          const nextDefault = presets.find((p) => p.name !== nameToDelete)?.name || 'default'
          setDefaultPreset(nextDefault)
        }
      }

      const aggTemp = currentPreset.aggregator_temperature !== undefined ? currentPreset.aggregator_temperature : 0.4
      const refTemp = currentPreset.reference_temperature !== undefined ? currentPreset.reference_temperature : 0.6
      const currentRefs = currentPreset.reference_models || []
      const judgeCriteria = currentPreset.judge_criteria || ''
      const isDefault = defaultPreset === currentPreset.name

      return React.createElement(
        'div',
        { className: 'moa-page' },

        /* ── HEADER WITH LIVE STATUS CHIPS ── */
        React.createElement(
          'div',
          { className: 'moa-header' },
          React.createElement(
            'div',
            { className: 'moa-page-title' },
            React.createElement('span', null, '🧠 ' + t('header.title')),
            React.createElement(
              'div',
              { className: 'moa-badge-row' },
              React.createElement('span', { className: 'moa-badge moa-badge-ok' }, '🟢 ' + t('badge.online')),
              React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.preset', { name: currentPreset.name })),
              React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.models', { count: availableModels.length })),
              React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.candidates', { count: currentRefs.length }))
            )
          ),
          React.createElement('div', { className: 'moa-page-sub' }, t('header.sub'))
        ),

        /* ── SECTION 1: PRESET MANAGEMENT ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { className: 'moa-section-title' },
            React.createElement('span', null, t('presets.title')),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              !isDefault &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-btn moa-btn-sub',
                    onClick: () => setDefaultPreset(currentPreset.name),
                  },
                  '★ ' + t('presets.set_default')
                ),
              isDefault &&
                React.createElement('span', { className: 'moa-badge moa-badge-ok' }, '✓ ' + t('presets.active_badge')),
              !isCreating &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-btn moa-btn-sub',
                    onClick: () => setIsCreating(true),
                  },
                  t('presets.new_btn')
                )
            )
          ),
          React.createElement('div', { className: 'moa-section-desc' }, t('presets.desc')),
          React.createElement(
            'div',
            { className: 'moa-seg-group' },
            presets.map((p) => {
              const isCur = p.name === selectedPresetName
              return React.createElement(
                'button',
                {
                  key: p.name,
                  type: 'button',
                  className: isCur ? 'moa-seg-btn moa-seg-btn-active' : 'moa-seg-btn',
                  onClick: () => setSelectedPresetName(p.name),
                },
                p.name === defaultPreset ? `★ ${p.name}` : p.name
              )
            }),
            presets.length > 1 &&
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn moa-btn-danger moa-btn-sub',
                  onClick: () => handleDeletePreset(currentPreset.name),
                  title: t('presets.del_btn'),
                },
                '🗑 ' + t('presets.del_btn')
              )
          ),
          isCreating &&
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 } },
              React.createElement('input', {
                type: 'text',
                className: 'moa-input',
                style: { maxWidth: 320 },
                placeholder: t('presets.name_placeholder'),
                value: newPresetName,
                onChange: (e) => setNewPresetName(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') handleCreatePreset()
                  if (e.key === 'Escape') setIsCreating(false)
                },
              }),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn moa-btn-primary',
                  onClick: handleCreatePreset,
                },
                t('presets.create')
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn',
                  onClick: () => setIsCreating(false),
                },
                t('presets.cancel')
              )
            )
        ),

        /* ── SECTION 2: AGGREGATOR / JUDGE ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { className: 'moa-section-title' },
            React.createElement('span', null, t('aggregator.title')),
            React.createElement('span', { className: 'moa-badge moa-badge-brand' }, `Temp: ${aggTemp}`)
          ),
          React.createElement('div', { className: 'moa-section-desc' }, t('aggregator.desc')),
          React.createElement(SearchableModelPicker, {
            provider: currentPreset.aggregator?.provider || '',
            model: currentPreset.aggregator?.model || '',
            onChange: setAggregatorModel,
            availableModels,
            t,
          }),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 } },
            React.createElement(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 } },
              React.createElement('span', null, t('aggregator.temp_label')),
              React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } }, t('aggregator.temp_hint'))
            ),
            React.createElement(
              'div',
              { className: 'moa-slider-row' },
              React.createElement('input', {
                type: 'range',
                className: 'moa-slider',
                min: '0',
                max: '2',
                step: '0.05',
                value: aggTemp,
                onChange: (e) => setAggregatorTemp(e.target.value),
              }),
              React.createElement('div', { className: 'moa-slider-badge' }, aggTemp)
            )
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 10 } },
            React.createElement('label', { style: { fontSize: 13, fontWeight: 500 } }, t('aggregator.criteria_label')),
            React.createElement('textarea', {
              className: 'moa-textarea',
              rows: 2,
              placeholder: t('aggregator.criteria_placeholder'),
              value: judgeCriteria,
              onChange: (e) => setJudgeCriteria(e.target.value),
            }),
            React.createElement(
              'div',
              { style: { marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 } },
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: currentPreset.ask_clarifying_questions !== false,
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, ask_clarifying_questions: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.questions_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.questions_hint')
              )
            )
          )
        ),

        /* ── SECTION 3: CANDIDATE PROPOSERS ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { className: 'moa-section-title' },
            React.createElement('span', null, t('proposers.title')),
            React.createElement(
              'div',
              { className: 'moa-seg-group' },
              React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('proposers.parallel_count') + ':'),
              [2, 3, 4, 5].map((cnt) =>
                React.createElement(
                  'button',
                  {
                    key: cnt,
                    type: 'button',
                    className: currentRefs.length === cnt ? 'moa-seg-btn moa-seg-btn-active moa-btn-sub' : 'moa-seg-btn moa-btn-sub',
                    onClick: () => setReferenceCount(cnt),
                  },
                  cnt
                )
              )
            )
          ),
          React.createElement('div', { className: 'moa-section-desc' }, t('proposers.desc')),
          React.createElement(
            'div',
            { className: 'moa-cand-list' },
            currentRefs.map((ref, idx) =>
              React.createElement(
                'div',
                { key: idx, className: 'moa-cand-row' },
                React.createElement('span', { className: 'moa-cand-badge' }, `${t('proposers.candidate')} #${idx + 1}`),
                React.createElement(
                  'div',
                  { className: 'moa-cand-picker' },
                  React.createElement(SearchableModelPicker, {
                    provider: ref.provider || '',
                    model: ref.model || '',
                    onChange: (p, m) => setReferenceModel(idx, p, m),
                    availableModels,
                    t,
                  })
                ),
                currentRefs.length > 1 &&
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'moa-btn moa-btn-danger moa-btn-sub',
                      title: 'Remove',
                      onClick: () => removeReference(idx),
                    },
                    '✕'
                  )
              )
            )
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn',
              style: { alignSelf: 'flex-start' },
              onClick: addReference,
            },
            t('proposers.add_btn')
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 10 } },
            React.createElement(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 } },
              React.createElement('span', null, t('proposers.temp_label')),
              React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } }, t('proposers.temp_hint'))
            ),
            React.createElement(
              'div',
              { className: 'moa-slider-row' },
              React.createElement('input', {
                type: 'range',
                className: 'moa-slider',
                min: '0',
                max: '2',
                step: '0.05',
                value: refTemp,
                onChange: (e) => setReferenceTemp(e.target.value),
              }),
              React.createElement('div', { className: 'moa-slider-badge' }, refTemp)
            )
          )
        ),

        /* ── SECTION 4: TELEMETRY & STATS SUMMARY ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement('div', { className: 'moa-section-title' }, t('stats.title')),
          React.createElement('div', { className: 'moa-section-desc' }, t('stats.desc')),
          React.createElement(
            'div',
            { className: 'moa-grid-2' },
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, String(presets.length)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.preset_count'))
            ),
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, String(currentRefs.length)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.active_models'))
            ),
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, String(availableModels.length)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('badge.models', { count: availableModels.length }))
            )
          )
        ),

        /* ── FOOTER ACTIONS & SAVE ── */
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 } },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn moa-btn-primary',
              style: { padding: '10px 24px', fontSize: 14, fontWeight: 600 },
              onClick: handleSave,
            },
            saveStatus === t('actions.saving') ? t('actions.saving') : t('actions.save')
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn',
              onClick: reload,
            },
            t('actions.retry')
          ),
          saveStatus &&
            React.createElement(
              'span',
              {
                className: saveStatus.startsWith('Error') ? 'moa-alert-err' : 'moa-alert-ok',
              },
              saveStatus
            )
        )
      )
    }

    function useMoASettings(props) {
      const effectiveCtx = (props && props.ctx) || rootCtx
      const t = makeT(ru, en)

      const scope = React.useMemo(() => {
        if (!effectiveCtx) return undefined
        const s = effectiveCtx.get ? effectiveCtx.get('settingsScope') : effectiveCtx.settingsScope
        return s && typeof s.bind === 'function' ? s.bind({ namespace: NS }) : undefined
      }, [effectiveCtx])

      const snapshot = React.useSyncExternalStore
        ? React.useSyncExternalStore(
            React.useMemo(() => (cb) => (scope ? scope.subscribe(cb) : () => {}), [scope]),
            React.useCallback(() => (scope ? scope.getSnapshot() : { status: 'ready' }), [scope]),
            React.useCallback(() => ({ status: 'loading' }), [])
          )
        : null

      const [status, setStatus] = React.useState('loading')
      const [presets, setPresets] = React.useState([])
      const [defaultPreset, setDefaultPreset] = React.useState('default')
      const [availableModels, setAvailableModels] = React.useState([])
      const [saveStatus, setSaveStatus] = React.useState('')

      React.useEffect(() => {
        if (!scope || !snapshot) return
        const snapStatus = snapshot.status || 'ready'
        if (snapStatus === 'ready') {
          const val = snapshot.value || {}
          if (Array.isArray(val.presets)) setPresets(val.presets)
          if (val.default_preset) setDefaultPreset(val.default_preset)
          setStatus('ready')
        } else if (snapStatus === 'unavailable') {
          setStatus('unavailable')
        }
      }, [scope, snapshot])

      const reload = React.useCallback(() => {
        if (!scope) setStatus('loading')

        fetch('/dsh-moa/presets', { cache: 'no-store' })
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json()
          })
          .then((data) => {
            if (data && data.ok) {
              setPresets(data.presets || [])
              setDefaultPreset(data.defaultPreset || 'default')
              setStatus('ready')
            } else if (!scope) {
              setStatus('unavailable')
            }
          })
          .catch((err) => {
            console.warn('[dsh-moa] Presets fetch failed:', err)
            if (!scope) setStatus('unavailable')
          })

        fetch('/dsh-moa/models', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && Array.isArray(data.models)) {
              setAvailableModels(data.models)
            }
          })
          .catch((err) => {
            console.warn('[dsh-moa] Models fetch failed:', err)
          })
      }, [scope])

      React.useEffect(() => {
        reload()
      }, [reload])

      const handleSave = () => {
        setSaveStatus(t('actions.saving'))

        if (scope && typeof scope.set === 'function') {
          Promise.all([
            scope.set('presets', presets),
            scope.set('default_preset', defaultPreset),
          ])
            .then(() => {
              setSaveStatus(t('actions.saved'))
              setTimeout(() => setSaveStatus(''), 3000)
            })
            .catch((err) => {
              console.warn('[dsh-moa] scope.set failed, trying REST fallback:', err)
              doRestSave()
            })
          return
        }

        doRestSave()
      }

      const doRestSave = () => {
        fetch('/dsh-moa/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presets, default_preset: defaultPreset }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) {
              setSaveStatus(t('actions.saved'))
              if (Array.isArray(res.presets)) setPresets(res.presets)
              if (res.defaultPreset) setDefaultPreset(res.defaultPreset)
              setTimeout(() => setSaveStatus(''), 3000)
            } else {
              setSaveStatus('Error saving: ' + (res?.error || 'failed'))
            }
          })
          .catch((err) => {
            setSaveStatus(`Error: ${err.message || err}`)
          })
      }

      return {
        t,
        status,
        presets,
        setPresets,
        defaultPreset,
        setDefaultPreset,
        availableModels,
        handleSave,
        saveStatus,
        reload,
      }
    }

    class MoAErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error }
      }
      componentDidCatch(error, errorInfo) {
        console.error('[dsh-moa] MoAErrorBoundary caught error:', error, errorInfo)
      }
      render() {
        if (this.state.hasError) {
          return React.createElement(
            'div',
            {
              className: 'moa-alert-err',
              style: { margin: '12px 0', padding: '14px', borderRadius: '8px' },
            },
            React.createElement('div', { style: { fontWeight: 600, marginBottom: '6px' } }, '⚠️ MoA UI Error:'),
            React.createElement('div', { style: { fontSize: '12px', wordBreak: 'break-all' } }, String(this.state.error?.message || this.state.error)),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'moa-btn',
                style: { marginTop: '10px', fontSize: '12px', padding: '4px 10px' },
                onClick: () => this.setState({ hasError: false, error: null }),
              },
              'Retry'
            )
          )
        }
        return this.props.children
      }
    }

    function MoACard(props) {
      ensureStyles()
      const state = useMoASettings(props)
      const [open, setOpen] = React.useState(false)

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
            React.createElement('div', { className: 'moa-title' }, '🧠 ' + (state.t('title') || TITLE)),
            React.createElement('div', { className: 'moa-sub' }, state.t('description') || SUBTITLE)
          ),
          React.createElement(Chevron, {
            className: open ? 'moa-chev moa-chev-open' : 'moa-chev',
          })
        ),
        open &&
          React.createElement(
            'div',
            { className: 'moa-body' },
            state.status === 'loading'
              ? React.createElement('div', { style: { padding: '16px 0', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, 'Loading MoA settings…')
              : state.status === 'unavailable'
                ? React.createElement(
                    'div',
                    { style: { padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 } },
                    React.createElement('div', { className: 'moa-alert-err' }, 'MoA service temporarily unavailable'),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'moa-btn',
                        style: { width: 'fit-content' },
                        onClick: state.reload,
                      },
                      state.t('actions.retry')
                    )
                  )
                : React.createElement(MoAEditor, state)
          )
      )
    }

    exports.inject = ['slots', 'locale', 'inputTriggers', 'settingsScope']
    exports.apply = function apply(ctx) {
      rootCtx = ctx

      const addLocale = (locale, dictionary) => {
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            return ctx.locale.register(NS, locale, dictionary)
          }
        } catch {
          return () => {}
        }
        return () => {}
      }

      if (typeof ctx.effect === 'function') {
        ctx.effect(() => {
          const undo = [addLocale('en', en), addLocale('ru', ru)]
          return () => {
            for (const off of undo) {
              if (typeof off === 'function') {
                try { off() } catch {}
              }
            }
          }
        }, 'dsh-moa: dictionaries')
      } else {
        addLocale('en', en)
        addLocale('ru', ru)
      }

      if (ctx.slots) {
        const registerCard = () => {
          try {
            ctx.slots.register(
              {
                name: 'settings.plugin.item',
                key: NS,
                order: 35,
                locale: NS,
                inject: () => ({ ctx }),
              },
              (props) => React.createElement(MoAErrorBoundary, null, React.createElement(MoACard, props))
            )
          } catch (err) {
            console.warn('[dsh-moa] Failed to register settings.plugin.item:', err)
          }
        }

        if (typeof ctx.slots.inject === 'function') {
          ctx.slots.inject('settings.plugin.item', registerCard)
        } else {
          registerCard()
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
          description: ru['slash.desc'] || en['slash.desc'],
          candidates: (_session, req) => {
            if (req.position !== 'leading') return Promise.resolve([])
            const q = req.query.trim().toLowerCase()
            if (q !== '' && !'moa'.startsWith(q)) return Promise.resolve([])
            return Promise.resolve([
              {
                name: 'moa',
                description: ru['slash.desc'] || en['slash.desc'],
              },
            ])
          },
          onPick: ({ candidate }) => ({
            text: '/' + candidate.name + ' ',
          }),
          matchSpace: (_session, token) => {
            if (token === '/moa') return { text: '/moa ' }
            return undefined
          },
          matchEnter: (_session, _line) => {
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

