window.__ModuleLoader__.load({
  id: '@goodandready/dsh-moa',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    let React = require('react')

    const NS = 'dsh-moa'
    let localeRegistered = false

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
      .moa-section { display:flex; flex-direction:column; gap:16px; padding:4px 0; max-width:780px; }
      .moa-section-title { font-size:18px; font-weight:700; color:var(--dsw-alias-label-primary); }
      .moa-section-sub { font-size:13px; color:var(--dsw-alias-label-secondary); margin-top:2px; margin-bottom:6px; }
      .moa-card { border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); border-radius:12px; list-style:none; margin-bottom:12px; }
      .moa-head { appearance:none; width:100%; font:inherit; color:inherit; text-align:left; cursor:pointer; background:0 0; border:0; border-radius:12px; display:flex; align-items:center; gap:12px; padding:14px 16px; }
      .moa-head:focus-visible { outline:2px solid var(--dsw-alias-label-primary); outline-offset:2px; }
      .moa-title { color:var(--dsw-alias-label-primary); font-size:15px; font-weight:600; line-height:1.4; }
      .moa-sub { color:var(--dsw-alias-label-secondary); font-size:13px; margin-top:2px; }
      .moa-chev { margin-left:auto; flex:none; color:var(--dsw-alias-label-tertiary); transition:transform .16s ease; }
      .moa-chev-open { transform:rotate(180deg); }
      .moa-body { border-top:1px solid var(--dsw-alias-border-l2); margin:0 16px; padding:12px 0 16px; display:flex; flex-direction:column; gap:14px; }
      .moa-box { border:1px solid var(--dsw-alias-border-l2); border-radius:10px; padding:14px 16px; background:var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.02)); display:flex; flex-direction:column; gap:12px; }
      .moa-box-title { font-size:14px; font-weight:600; color:var(--dsw-alias-label-primary); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
      .moa-field { display:flex; flex-direction:column; gap:6px; }
      .moa-label { font-size:13px; font-weight:500; color:var(--dsw-alias-label-primary); }
      .moa-hint { font-size:12px; color:var(--dsw-alias-label-secondary); line-height:1.4; }
      .moa-select { height:36px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); border-radius:8px; padding:0 10px; font-size:13px; }
      .moa-select:focus { outline:1px solid var(--dsw-alias-label-primary); }
      .moa-count-bar { display:flex; align-items:center; gap:8px; }
      .moa-count-btn { appearance:none; font:inherit; padding:4px 12px; border-radius:6px; border:1px solid var(--dsw-alias-border-l2); background:transparent; color:var(--dsw-alias-label-primary); font-size:12px; cursor:pointer; }
      .moa-count-btn-active { background:var(--dsw-alias-label-primary); color:var(--dsw-alias-bg-layer-3); border-color:transparent; font-weight:600; }
      .moa-refs-list { display:flex; flex-direction:column; gap:10px; }
      .moa-ref-row { display:flex; align-items:center; gap:8px; }
      .moa-ref-badge { font-size:12px; font-weight:600; color:var(--dsw-alias-label-secondary); width:85px; flex-shrink:0; }
      .moa-ref-picker { flex:1; min-width:0; }
      .moa-btn-del { appearance:none; font:inherit; border:none; background:transparent; color:var(--dsw-alias-label-tertiary); cursor:pointer; padding:6px 10px; font-size:14px; border-radius:6px; }
      .moa-btn-del:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-3); }
      .moa-btn-add { appearance:none; font:inherit; border:1px dashed var(--dsw-alias-border-l2); background:transparent; color:var(--dsw-alias-label-primary); border-radius:8px; padding:8px 12px; font-size:13px; font-weight:500; cursor:pointer; text-align:center; transition:border-color .15s; }
      .moa-btn-add:hover { border-color:var(--dsw-alias-label-primary); }
      .moa-foot { border-top:1px solid var(--dsw-alias-border-l2); display:flex; justify-content:flex-end; align-items:center; gap:10px; padding:14px 0 4px; }
      .moa-save { appearance:none; font:inherit; cursor:pointer; border:1px solid transparent; border-radius:8px; padding:8px 20px; font-size:13px; font-weight:600; background:var(--dsw-alias-label-primary); color:var(--dsw-alias-bg-layer-3); transition:opacity .15s; }
      .moa-save:hover { opacity:0.9; }
      .moa-status-text { font-size:12px; color:var(--dsw-alias-label-secondary); }

      /* Preset Toolbar & Actions */
      .moa-preset-bar { display:flex; flex-direction:column; gap:8px; margin-bottom:4px; }
      .moa-preset-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .moa-btn-sub { appearance:none; font:inherit; padding:7px 12px; border-radius:8px; border:1px solid var(--dsw-alias-border-l2); background:transparent; color:var(--dsw-alias-label-primary); font-size:12px; font-weight:500; cursor:pointer; white-space:nowrap; }
      .moa-btn-sub:hover { border-color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-3); }
      .moa-btn-del-preset { appearance:none; font:inherit; padding:7px 12px; border-radius:8px; border:1px solid var(--dsw-alias-border-l2); background:transparent; color:#ef4444; font-size:12px; font-weight:500; cursor:pointer; white-space:nowrap; }
      .moa-btn-del-preset:hover { border-color:#ef4444; background:rgba(239,68,68,0.08); }
      .moa-new-preset-box { display:flex; align-items:center; gap:8px; padding:10px 12px; border:1px dashed var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary)); border-radius:8px; background:var(--dsw-alias-bg-layer-2); margin-top:4px; }
      .moa-new-input { flex:1; height:32px; padding:0 10px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); border-radius:6px; font-size:13px; outline:none; }
      .moa-new-input:focus { border-color:var(--dsw-alias-label-primary); }

      /* Temperature Sliders */
      .moa-temp-ctrl { display:flex; align-items:center; gap:12px; margin-top:2px; }
      .moa-temp-slider { flex:1; accent-color:var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary)); cursor:pointer; height:4px; }
      .moa-temp-input { width:62px; height:30px; text-align:center; padding:0 6px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); border-radius:6px; font-size:13px; font-weight:600; outline:none; }
      .moa-temp-input:focus { border-color:var(--dsw-alias-label-primary); }

      /* Searchable Model Picker */
      .moa-picker-container { position:relative; width:100%; }
      .moa-picker-btn { width:100%; min-height:36px; padding:5px 12px; background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); border-radius:8px; color:var(--dsw-alias-label-primary); display:flex; align-items:center; justify-content:space-between; cursor:pointer; font-size:13px; text-align:left; box-sizing:border-box; gap:8px; }
      .moa-picker-btn:hover { border-color:var(--dsw-alias-label-secondary); }
      .moa-picker-btn:focus-visible { outline:2px solid var(--dsw-alias-label-primary); outline-offset:1px; }
      .moa-picker-summary { display:flex; align-items:center; gap:8px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .moa-prov-chip { font-size:11px; font-weight:600; text-transform:uppercase; padding:2px 6px; border-radius:4px; background:var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.08)); color:var(--dsw-alias-label-secondary); flex-shrink:0; }
      .moa-model-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
      .moa-picker-popover { position:absolute; top:calc(100% + 4px); left:0; right:0; background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,0.4); z-index:1000; max-height:360px; display:flex; flex-direction:column; overflow:hidden; }
      .moa-picker-search-bar { padding:8px 10px; border-bottom:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); display:flex; flex-direction:column; gap:4px; }
      .moa-search-input { width:100%; height:32px; padding:0 10px; background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); border-radius:6px; color:var(--dsw-alias-label-primary); font-size:13px; outline:none; box-sizing:border-box; }
      .moa-search-input:focus { border-color:var(--dsw-alias-label-primary); }
      .moa-search-info { font-size:11px; color:var(--dsw-alias-label-tertiary); padding:0 2px; display:flex; justify-content:space-between; }
      .moa-picker-list { overflow-y:auto; max-height:280px; padding:6px; display:flex; flex-direction:column; gap:2px; }
      .moa-group-title { font-size:11px; font-weight:700; text-transform:uppercase; color:var(--dsw-alias-label-tertiary); padding:8px 8px 4px; }
      .moa-picker-item { display:flex; align-items:center; justify-content:space-between; padding:7px 10px; border-radius:6px; font-size:13px; color:var(--dsw-alias-label-primary); cursor:pointer; text-align:left; border:none; background:transparent; width:100%; gap:8px; }
      .moa-picker-item:hover, .moa-picker-item-selected { background:var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.06)); }
      .moa-picker-check { color:var(--dsw-alias-brand-primary, #10b981); font-weight:bold; font-size:14px; flex-shrink:0; }
      .moa-custom-opt { padding:8px 10px; border-top:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); font-size:12px; color:var(--dsw-alias-label-primary); cursor:pointer; display:flex; align-items:center; gap:6px; }
      .moa-custom-opt:hover { background:var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.06)); }
    `

    let stylesInjected = false
    function ensureStyles() {
      if (stylesInjected || typeof document === 'undefined') return
      stylesInjected = true
      const style = document.createElement('style')
      style.textContent = STYLES
      document.head.appendChild(style)
    }

    const PROVIDER_TITLES = {
      codex: 'ChatGPT Codex (Subscription)',
      claude: 'Claude (Anthropic Subscription)',
      grok: 'Grok (xAI Subscription)',
      antigravity: 'Antigravity (Google)',
      gemini: 'Google Gemini',
      commandcode: 'CommandCode Provider',
      'opencode-go': 'OpenCode-Go',
      'qwen-token-plan': 'Qwen (Token Plan)',
      groq: 'Groq Cloud',
      zai: 'Zhipu GLM (Zai)',
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
      availableModels,
      t,
    }) {
      const [open, setOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const rootRef = React.useRef(null)
      const inputRef = React.useRef(null)

      const selectedLabel = React.useMemo(() => {
        if (!provider && !model) return t('selectModel') || 'Выберите модель...'
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
        groups.sort((a, b) => a.title.localeCompare(b.title))
        return groups
      }, [filtered])

      React.useEffect(() => {
        if (!open) return
        const onDown = (e) => {
          if (rootRef.current && !rootRef.current.contains(e.target)) {
            setOpen(false)
          }
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
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
        const q = query.trim()
        if (!q) return
        const parts = q.split(':')
        if (parts.length >= 2) {
          onChange(parts[0].trim(), parts.slice(1).join(':').trim())
        } else {
          onChange(provider || 'custom', q)
        }
        setOpen(false)
        setQuery('')
      }

      return React.createElement(
        'div',
        { ref: rootRef, className: 'moa-picker-container' },
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
          React.createElement(Chevron, { className: open ? 'moa-chev moa-chev-open' : 'moa-chev' })
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
                placeholder: t('searchPlaceholder') || 'Поиск по названию или провайдеру...',
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
                  `${t('modelsFound') || 'Найдено'}: ${filtered.length} ${t('of') || 'из'} ${availableModels.length}`
                ),
                query &&
                  React.createElement(
                    'span',
                    { style: { cursor: 'pointer' }, onClick: () => setQuery('') },
                    t('clear') || 'Сбросить'
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
                  t('noModelsMatch') || 'Модели не найдены.'
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
                  `${t('useCustom') || 'Использовать'}: "${query.trim()}"`
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
    }) {
      const [selectedPresetName, setSelectedPresetName] = React.useState(defaultPreset || (presets[0] && presets[0].name) || 'default')
      const [isCreating, setIsCreating] = React.useState(false)
      const [newPresetName, setNewPresetName] = React.useState('')

      // Sync active preset if selected one is removed
      React.useEffect(() => {
        if (!presets.some((p) => p.name === selectedPresetName)) {
          setSelectedPresetName(defaultPreset || (presets[0] && presets[0].name) || 'default')
        }
      }, [presets, selectedPresetName, defaultPreset])

      const currentPreset = presets.find((p) => p.name === selectedPresetName) || presets[0] || {
        name: 'default',
        reference_models: [],
        aggregator: { provider: '', model: '' },
        aggregator_temperature: 0.4,
        reference_temperature: 0.6,
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
        updateCurrentPreset((p) => ({
          ...p,
          aggregator: { provider: prov, model: mod },
        }))
      }

      const setAggregatorTemp = (temp) => {
        const val = Math.round(Number(temp) * 100) / 100
        updateCurrentPreset((p) => ({ ...p, aggregator_temperature: val }))
      }

      const setReferenceTemp = (temp) => {
        const val = Math.round(Number(temp) * 100) / 100
        updateCurrentPreset((p) => ({ ...p, reference_temperature: val }))
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
          reference_models: currentPreset?.reference_models?.length ? structuredClone(currentPreset.reference_models) : [
            { provider: 'opencode-go', model: 'deepseek-v4-flash' },
            { provider: 'codex', model: 'gpt-5.6-sol' },
          ],
          aggregator: currentPreset?.aggregator?.provider ? structuredClone(currentPreset.aggregator) : {
            provider: 'antigravity',
            model: 'gemini-3-flash',
          },
          reference_temperature: currentPreset?.reference_temperature ?? 0.6,
          aggregator_temperature: currentPreset?.aggregator_temperature ?? 0.4,
          max_tokens: currentPreset?.max_tokens ?? 4096,
        }
        setPresets((prev) => [...prev, created])
        setSelectedPresetName(name)
        setIsCreating(false)
        setNewPresetName('')
      }

      const handleDeletePreset = () => {
        if (presets.length <= 1) return
        if (!confirm(`${t('confirmDeletePreset') || 'Удалить пресет'} "${currentPreset.name}"?`)) return
        const remaining = presets.filter((p) => p.name !== currentPreset.name)
        if (defaultPreset === currentPreset.name) {
          setDefaultPreset(remaining[0].name)
        }
        setPresets(remaining)
        setSelectedPresetName(remaining[0].name)
      }

      const currentRefs = currentPreset.reference_models || []
      const aggTemp = currentPreset.aggregator_temperature ?? 0.4
      const refTemp = currentPreset.reference_temperature ?? 0.6

      return React.createElement(
        React.Fragment,
        null,
        /* Preset Selector Toolbar (No top tab buttons!) */
        React.createElement(
          'div',
          { className: 'moa-preset-bar' },
          React.createElement(
            'div',
            { className: 'moa-field' },
            React.createElement('label', { className: 'moa-label' }, t('presetSelectLabel') || 'Текущий пресет для настройки:'),
            React.createElement(
              'div',
              { className: 'moa-preset-row' },
              React.createElement(
                'select',
                {
                  className: 'moa-select',
                  style: { flex: 1, minWidth: 200 },
                  value: isCreating ? '__new__' : currentPreset.name,
                  onChange: (e) => {
                    if (e.target.value === '__new__') {
                      setIsCreating(true)
                    } else {
                      setIsCreating(false)
                      setSelectedPresetName(e.target.value)
                    }
                  },
                },
                presets.map((pr) =>
                  React.createElement(
                    'option',
                    { key: pr.name, value: pr.name },
                    pr.name + (pr.name === defaultPreset ? ` ⭐ (${t('isDefault') || 'основной'})` : '')
                  )
                ),
                React.createElement('option', { disabled: true }, '──────────────────'),
                React.createElement(
                  'option',
                  { value: '__new__' },
                  '+ ' + (t('createNewPreset') || 'Создать новый пресет...')
                )
              ),
              currentPreset.name !== defaultPreset &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-btn-sub',
                    onClick: () => setDefaultPreset(currentPreset.name),
                    title: t('makeDefaultHint') || 'Использовать этот пресет при вызове /moa без аргументов',
                  },
                  '⭐ ' + (t('makeDefault') || 'Сделать основным')
                ),
              presets.length > 1 &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-btn-del-preset',
                    onClick: handleDeletePreset,
                    title: t('deletePreset') || 'Удалить пресет',
                  },
                  '🗑️ ' + (t('delete') || 'Удалить')
                )
            )
          ),
          isCreating &&
            React.createElement(
              'div',
              { className: 'moa-new-preset-box' },
              React.createElement('input', {
                type: 'text',
                className: 'moa-new-input',
                placeholder: t('newPresetPlaceholder') || 'Название нового пресета (например: fast-audit)',
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
                  className: 'moa-btn-sub',
                  onClick: handleCreatePreset,
                  style: { background: 'var(--dsw-alias-label-primary)', color: 'var(--dsw-alias-bg-layer-3)' },
                },
                t('create') || 'Создать'
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn-sub',
                  onClick: () => setIsCreating(false),
                },
                t('cancel') || 'Отмена'
              )
            )
        ),
        /* Aggregator / Judge Box with Temperature Slider */
        React.createElement(
          'div',
          { className: 'moa-box' },
          React.createElement(
            'div',
            { className: 'moa-box-title' },
            React.createElement('span', null, t('aggregatorTitle')),
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement('span', { className: 'moa-hint' }, `${t('temperature') || 'Температура'}:`),
              React.createElement('span', { style: { fontWeight: 600, fontSize: 13 } }, aggTemp)
            )
          ),
          React.createElement('div', { className: 'moa-hint' }, t('aggregatorDesc')),
          React.createElement(SearchableModelPicker, {
            provider: currentPreset.aggregator?.provider || '',
            model: currentPreset.aggregator?.model || '',
            onChange: setAggregatorModel,
            availableModels,
            t,
          }),
          React.createElement(
            'div',
            { className: 'moa-field', style: { marginTop: 4 } },
            React.createElement(
              'div',
              { className: 'moa-temp-ctrl' },
              React.createElement('input', {
                type: 'range',
                className: 'moa-temp-slider',
                min: '0',
                max: '2',
                step: '0.05',
                value: aggTemp,
                onChange: (e) => setAggregatorTemp(e.target.value),
              }),
              React.createElement('input', {
                type: 'number',
                className: 'moa-temp-input',
                min: '0',
                max: '2',
                step: '0.05',
                value: aggTemp,
                onChange: (e) => setAggregatorTemp(e.target.value),
              })
            ),
            React.createElement('div', { className: 'moa-hint' }, t('aggTempHint') || 'Рекомендуется 0.2 – 0.4 для точной проверки и синтеза без галлюцинаций.')
          ),
          React.createElement(
            'div',
            { className: 'moa-field', style: { marginTop: 4, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 8 } },
            React.createElement('label', { className: 'moa-label', style: { fontSize: 12 } }, t('judgeCriteriaLabel') || 'Критерии оценки судьи (опционально):'),
            React.createElement('textarea', {
              className: 'moa-textarea',
              rows: 2,
              style: {
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--dsw-alias-border-l2)',
                background: 'var(--dsw-alias-bg-layer-3)',
                color: 'var(--dsw-alias-label-primary)',
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
              },
              placeholder: t('judgeCriteriaPlaceholder') || 'например: Приоритет — производительность, чистый код, минимум зависимостей...',
              value: judgeCriteria,
              onChange: (e) => setJudgeCriteria(e.target.value),
            })
          )
        ),
        /* Proposers / Advisors Box with Temperature Slider */
        React.createElement(
          'div',
          { className: 'moa-box' },
          React.createElement(
            'div',
            { className: 'moa-box-title' },
            React.createElement('span', null, t('proposersTitle')),
            React.createElement(
              'div',
              { className: 'moa-count-bar' },
              React.createElement('span', { className: 'moa-hint' }, t('parallelCount') + ':'),
              [2, 3, 4, 5].map((cnt) =>
                React.createElement(
                  'button',
                  {
                    key: cnt,
                    type: 'button',
                    className: currentRefs.length === cnt ? 'moa-count-btn moa-count-btn-active' : 'moa-count-btn',
                    onClick: () => setReferenceCount(cnt),
                  },
                  cnt
                )
              )
            )
          ),
          React.createElement('div', { className: 'moa-hint' }, t('proposersDesc')),
          React.createElement(
            'div',
            { className: 'moa-refs-list' },
            currentRefs.map((ref, idx) =>
              React.createElement(
                'div',
                { key: idx, className: 'moa-ref-row' },
                React.createElement('span', { className: 'moa-ref-badge' }, `${t('candidate')} #${idx + 1}:`),
                React.createElement(
                  'div',
                  { className: 'moa-ref-picker' },
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
                      className: 'moa-btn-del',
                      title: t('remove'),
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
              className: 'moa-btn-add',
              onClick: addReference,
            },
            '+ ' + t('addCandidate')
          ),
          React.createElement(
            'div',
            { className: 'moa-field', style: { marginTop: 4, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 10 } },
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
              React.createElement('span', { className: 'moa-label', style: { fontSize: 12 } }, t('refTempLabel') || 'Температура кандидатов (разнообразие решений):'),
              React.createElement('span', { style: { fontWeight: 600, fontSize: 13 } }, refTemp)
            ),
            React.createElement(
              'div',
              { className: 'moa-temp-ctrl' },
              React.createElement('input', {
                type: 'range',
                className: 'moa-temp-slider',
                min: '0',
                max: '2',
                step: '0.05',
                value: refTemp,
                onChange: (e) => setReferenceTemp(e.target.value),
              }),
              React.createElement('input', {
                type: 'number',
                className: 'moa-temp-input',
                min: '0',
                max: '2',
                step: '0.05',
                value: refTemp,
                onChange: (e) => setReferenceTemp(e.target.value),
              })
            ),
            React.createElement('div', { className: 'moa-hint' }, t('refTempHint') || 'Рекомендуется 0.6 – 0.8 для получения независимых и креативных вариантов.')
          )
        ),
        /* Save Footer */
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
    }

    function useMoASettings(props) {
      const t = props.t || ((k) => k)
      const [status, setStatus] = React.useState('loading')
      const [presets, setPresets] = React.useState([])
      const [defaultPreset, setDefaultPreset] = React.useState('default')
      const [availableModels, setAvailableModels] = React.useState([])
      const [saveStatus, setSaveStatus] = React.useState('')

      const reload = React.useCallback(() => {
        setStatus('loading')

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
            } else {
              setStatus('unavailable')
            }
          })
          .catch((err) => {
            console.warn('[dsh-moa] Presets fetch failed:', err)
            setStatus('unavailable')
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
      }, [])

      React.useEffect(() => {
        reload()
      }, [reload])

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
              if (Array.isArray(res.presets)) setPresets(res.presets)
              if (res.defaultPreset) setDefaultPreset(res.defaultPreset)
              setTimeout(() => setSaveStatus(''), 2500)
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

    function MoASection(props) {
      ensureStyles()
      const state = useMoASettings(props)

      return React.createElement(
        'div',
        { className: 'moa-section' },
        React.createElement('div', { className: 'moa-section-title' }, state.t('title')),
        React.createElement('div', { className: 'moa-section-sub' }, state.t('description')),
        state.status === 'loading'
          ? React.createElement('div', { className: 'moa-hint' }, state.t('loading'))
          : state.status === 'unavailable'
            ? React.createElement(
                'div',
                { className: 'moa-field' },
                React.createElement('div', { className: 'moa-hint' }, state.t('unavailable')),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-count-btn',
                    style: { width: 'fit-content', marginTop: 8 },
                    onClick: state.reload,
                  },
                  state.t('retry')
                )
              )
            : React.createElement(MoAEditor, state)
      )
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
            React.createElement('div', { className: 'moa-title' }, state.t('title')),
            React.createElement('div', { className: 'moa-sub' }, state.t('description'))
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
              ? React.createElement('div', { className: 'moa-hint' }, state.t('loading'))
              : state.status === 'unavailable'
                ? React.createElement(
                    'div',
                    { className: 'moa-field' },
                    React.createElement('div', { className: 'moa-hint' }, state.t('unavailable')),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'moa-count-btn',
                        style: { width: 'fit-content', marginTop: 8 },
                        onClick: state.reload,
                      },
                      state.t('retry')
                    )
                  )
                : React.createElement(MoAEditor, state)
          )
      )
    }

    exports.inject = ['slots', 'locale', 'inputTriggers']
    exports.apply = function apply(ctx) {
      const en = {
        title: 'Mixture of Agents (MoA)',
        description: 'Run tasks with multiple parallel proposer models and a synthesizing judge model',
        slashMoa: 'Run task through Mixture of Agents (/moa <prompt>)',
        defaultPreset: 'Default Preset (used on /moa without arguments)',
        isDefault: 'default',
        presetSelectLabel: 'Active Preset to Configure:',
        createNewPreset: 'Create new preset...',
        makeDefault: 'Make Default',
        makeDefaultHint: 'Use this preset for /moa when no preset argument is given',
        deletePreset: 'Delete preset',
        delete: 'Delete',
        confirmDeletePreset: 'Are you sure you want to delete preset',
        newPresetPlaceholder: 'New preset name (e.g. fast-audit)',
        create: 'Create',
        cancel: 'Cancel',
        aggregatorTitle: 'Judge / Aggregator Model (who reviews and synthesizes)',
        aggregatorDesc: 'Evaluates candidate proposals, corrects hallucinations, and outputs the final unified solution.',
        temperature: 'Temperature',
        aggTempHint: 'Recommended 0.2 - 0.4 for rigorous verification and factual synthesis.',
        proposersTitle: 'Candidate Models (Advisors)',
        proposersDesc: 'Generates independent candidate answers in parallel to provide diverse perspectives.',
        refTempLabel: 'Candidates Temperature (solution diversity):',
        refTempHint: 'Recommended 0.6 - 0.8 for diverse creative hypotheses.',
        parallelCount: 'Parallel workers',
        candidate: 'Candidate',
        addCandidate: 'Add parallel model slot',
        remove: 'Remove',
        save: 'Save Changes',
        saved: 'Saved successfully',
        loading: 'Saving…',
        retry: 'Retry connection',
        unavailable: 'MoA service temporarily unavailable (reconnecting...)',
        searchPlaceholder: 'Search by model name or provider...',
        modelsFound: 'Found',
        of: 'of',
        clear: 'Clear',
        noModelsMatch: 'No models found matching query.',
        useCustom: 'Use custom',
        selectModel: 'Select model...',
        judgeCriteriaLabel: 'Custom Judge Evaluation Criteria (optional):',
        judgeCriteriaPlaceholder: 'e.g. Priority: performance, zero external dependencies, robust edge-case handling...',
      }

      const ru = {
        title: 'Mixture of Agents (MoA)',
        description: 'Запуск задач через ансамбль параллельных моделей-советников и модель-судью',
        slashMoa: 'Запустить задачу через архитектуру Mixture of Agents (/moa <prompt>)',
        defaultPreset: 'Основной пресет (при вызове /moa без параметров)',
        isDefault: 'основной',
        presetSelectLabel: 'Текущий пресет для настройки:',
        createNewPreset: 'Создать новый пресет...',
        makeDefault: 'Сделать основным',
        makeDefaultHint: 'Использовать этот пресет для /moa при вызове без параметров',
        deletePreset: 'Удалить пресет',
        delete: 'Удалить',
        confirmDeletePreset: 'Вы уверены, что хотите удалить пресет',
        newPresetPlaceholder: 'Название нового пресета (например: fast-audit)',
        create: 'Создать',
        cancel: 'Отмена',
        aggregatorTitle: 'Ведущая модель / Судья (кто проверяет и объединяет)',
        aggregatorDesc: 'Сопоставляет варианты кандидатов, устраняет ошибки и синтезирует итоговое решение.',
        temperature: 'Температура',
        aggTempHint: 'Рекомендуется 0.2 – 0.4 для строгой проверки и синтеза без выдумок.',
        proposersTitle: 'Модели-кандидаты (советники)',
        proposersDesc: 'Параллельно формируют независимые варианты решения одной задачи.',
        refTempLabel: 'Температура кандидатов (разнообразие решений):',
        refTempHint: 'Рекомендуется 0.6 – 0.8 для получения независимых и креативных вариантов.',
        parallelCount: 'Параллельных моделей',
        candidate: 'Кандидат',
        addCandidate: 'Добавить модель в параллель',
        remove: 'Удалить',
        save: 'Сохранить',
        saved: 'Успешно сохранено',
        loading: 'Сохранение…',
        retry: 'Повторить подключение',
        unavailable: 'Служба MoA временно недоступна (переподключение...)',
        searchPlaceholder: 'Поиск модели по названию или провайдеру...',
        modelsFound: 'Найдено',
        of: 'из',
        clear: 'Сбросить',
        noModelsMatch: 'Модели не найдены.',
        useCustom: 'Использовать кастомное',
        selectModel: 'Выберите модель...',
        judgeCriteriaLabel: 'Критерии оценки судьи (опционально):',
        judgeCriteriaPlaceholder: 'например: Приоритет — производительность, минимум зависимостей, обработка граничных случаев...',
      }

      const addLocale = (locale, dictionary) => {
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            return ctx.locale.register(NS, locale, dictionary)
          }
        } catch {
          // Если язык уже занят (например, dsh-russian-lang) или зарегистрирован ранее — уступаем без ошибки
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

      const t = (key) => {
        try {
          if (ctx.locale && typeof ctx.locale.bind === 'function') {
            return ctx.locale.bind(NS)(key) || key
          }
        } catch {}
        return key
      }

      if (ctx.slots) {
        const registerDirectSection = () => {
          try {
            ctx.slots.register(
              {
                name: 'settings.section',
                id: NS,
                order: 35,
                locale: NS,
                label: () => t('title'),
                inject: () => ({ ctx, t }),
              },
              MoASection
            )
          } catch (err) {
            console.warn('[dsh-moa] Failed to register settings.section:', err)
          }
        }

        const registerPluginCard = () => {
          try {
            ctx.slots.register(
              {
                name: 'settings.plugin.item',
                key: NS,
                order: 35,
                locale: NS,
                label: () => t('title'),
                inject: () => ({ ctx, t }),
              },
              MoACard
            )
          } catch (err) {
            console.warn('[dsh-moa] Failed to register settings.plugin.item:', err)
          }
        }

        if (typeof ctx.slots.inject === 'function') {
          ctx.slots.inject('settings.section', registerDirectSection)
          ctx.slots.inject('settings.plugin.item', registerPluginCard)
        } else {
          registerDirectSection()
          registerPluginCard()
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
