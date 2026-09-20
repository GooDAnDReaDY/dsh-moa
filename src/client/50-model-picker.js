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

