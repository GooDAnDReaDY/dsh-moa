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
      .moa-section { display:flex; flex-direction:column; gap:16px; padding:4px 0; max-width:760px; }
      .moa-section-title { font-size:18px; font-weight:700; color:var(--dsw-alias-label-primary); }
      .moa-section-sub { font-size:13px; color:var(--dsw-alias-label-secondary); margin-top:2px; margin-bottom:10px; }
      .moa-card { border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); border-radius:12px; list-style:none; margin-bottom:12px; }
      .moa-head { appearance:none; width:100%; font:inherit; color:inherit; text-align:left; cursor:pointer; background:0 0; border:0; border-radius:12px; display:flex; align-items:center; gap:12px; padding:14px 16px; }
      .moa-head:focus-visible { outline:2px solid var(--dsw-alias-label-primary); outline-offset:2px; }
      .moa-title { color:var(--dsw-alias-label-primary); font-size:15px; font-weight:600; line-height:1.4; }
      .moa-sub { color:var(--dsw-alias-label-secondary); font-size:13px; margin-top:2px; }
      .moa-chev { margin-left:auto; flex:none; color:var(--dsw-alias-label-tertiary); transition:transform .16s ease; }
      .moa-chev-open { transform:rotate(180deg); }
      .moa-body { border-top:1px solid var(--dsw-alias-border-l2); margin:0 16px; padding:12px 0 16px; display:flex; flex-direction:column; gap:14px; }
      .moa-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px; }
      .moa-tab { appearance:none; font:inherit; padding:6px 14px; border-radius:8px; font-size:13px; font-weight:500; border:1px solid var(--dsw-alias-border-l2); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; }
      .moa-tab-active { background:var(--dsw-alias-label-primary); color:var(--dsw-alias-bg-layer-3); border-color:transparent; }
      .moa-box { border:1px solid var(--dsw-alias-border-l2); border-radius:10px; padding:14px 16px; background:var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.02)); display:flex; flex-direction:column; gap:12px; }
      .moa-box-title { font-size:14px; font-weight:600; color:var(--dsw-alias-label-primary); display:flex; align-items:center; justify-content:space-between; }
      .moa-field { display:flex; flex-direction:column; gap:6px; }
      .moa-label { font-size:13px; font-weight:500; color:var(--dsw-alias-label-primary); }
      .moa-hint { font-size:12px; color:var(--dsw-alias-label-secondary); }
      .moa-select { height:36px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); border-radius:8px; padding:0 10px; font-size:13px; }
      .moa-select:focus { outline:1px solid var(--dsw-alias-label-primary); }
      .moa-input { height:36px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); border-radius:8px; padding:0 12px; font-size:13px; }
      .moa-input:focus { outline:1px solid var(--dsw-alias-label-primary); }
      .moa-count-bar { display:flex; align-items:center; gap:8px; }
      .moa-count-btn { appearance:none; font:inherit; padding:4px 12px; border-radius:6px; border:1px solid var(--dsw-alias-border-l2); background:transparent; color:var(--dsw-alias-label-primary); font-size:12px; cursor:pointer; }
      .moa-count-btn-active { background:var(--dsw-alias-label-primary); color:var(--dsw-alias-bg-layer-3); border-color:transparent; font-weight:600; }
      .moa-refs-list { display:flex; flex-direction:column; gap:8px; }
      .moa-ref-row { display:flex; align-items:center; gap:8px; }
      .moa-ref-badge { font-size:12px; font-weight:600; color:var(--dsw-alias-label-secondary); width:85px; flex-shrink:0; }
      .moa-ref-select { flex:1; min-width:0; }
      .moa-btn-del { appearance:none; font:inherit; border:none; background:transparent; color:var(--dsw-alias-label-tertiary); cursor:pointer; padding:6px 10px; font-size:14px; border-radius:6px; }
      .moa-btn-del:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-3); }
      .moa-btn-add { appearance:none; font:inherit; border:1px dashed var(--dsw-alias-border-l2); background:transparent; color:var(--dsw-alias-label-primary); border-radius:8px; padding:8px 12px; font-size:13px; font-weight:500; cursor:pointer; text-align:center; transition:border-color .15s; }
      .moa-btn-add:hover { border-color:var(--dsw-alias-label-primary); }
      .moa-foot { border-top:1px solid var(--dsw-alias-border-l2); display:flex; justify-content:flex-end; align-items:center; gap:10px; padding:14px 0 4px; }
      .moa-save { appearance:none; font:inherit; cursor:pointer; border:1px solid transparent; border-radius:8px; padding:8px 20px; font-size:13px; font-weight:600; background:var(--dsw-alias-label-primary); color:var(--dsw-alias-bg-layer-3); transition:opacity .15s; }
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
      const [activeTab, setActiveTab] = React.useState(0)
      const currentPreset = presets[activeTab] || presets[0] || {
        name: 'default',
        reference_models: [],
        aggregator: { provider: '', model: '' },
      }

      // Deduplicated models list
      const modelOptions = React.useMemo(() => {
        const set = new Set()
        const list = []
        for (const m of availableModels) {
          const key = `${m.provider}:${m.model}`
          if (!set.has(key)) {
            set.add(key)
            list.push({ key, label: m.label || key, provider: m.provider, model: m.model })
          }
        }
        if (currentPreset?.aggregator) {
          const k = `${currentPreset.aggregator.provider}:${currentPreset.aggregator.model}`
          if (k !== ':' && !set.has(k)) {
            set.add(k)
            list.unshift({ key: k, label: k, provider: currentPreset.aggregator.provider, model: currentPreset.aggregator.model })
          }
        }
        for (const r of (currentPreset?.reference_models || [])) {
          const k = `${r.provider}:${r.model}`
          if (k !== ':' && !set.has(k)) {
            set.add(k)
            list.push({ key: k, label: k, provider: r.provider, model: r.model })
          }
        }
        return list
      }, [availableModels, currentPreset])

      const updateCurrentPreset = (modifier) => {
        setPresets((prev) => {
          const copy = [...prev]
          const cur = copy[activeTab] || copy[0]
          copy[activeTab] = modifier({ ...cur })
          return copy
        })
      }

      const setAggregatorModel = (key) => {
        const found = modelOptions.find((m) => m.key === key)
        if (found) {
          updateCurrentPreset((p) => ({
            ...p,
            aggregator: { provider: found.provider, model: found.model },
          }))
        } else {
          const [prov, ...rest] = key.split(':')
          updateCurrentPreset((p) => ({
            ...p,
            aggregator: { provider: prov || '', model: rest.join(':') || '' },
          }))
        }
      }

      const setReferenceModel = (idx, key) => {
        const found = modelOptions.find((m) => m.key === key)
        const prov = found ? found.provider : key.split(':')[0] || ''
        const mod = found ? found.model : key.split(':').slice(1).join(':') || ''

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
              const fallback = modelOptions[refs.length % modelOptions.length] || { provider: 'deepseek', model: 'deepseek-chat' }
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
          const fallback = modelOptions[refs.length % modelOptions.length] || { provider: 'openai', model: 'gpt-4o' }
          refs.push({ provider: fallback.provider, model: fallback.model })
          return { ...p, reference_models: refs }
        })
      }

      const aggKey = currentPreset.aggregator
        ? `${currentPreset.aggregator.provider}:${currentPreset.aggregator.model}`
        : ''

      const currentRefs = currentPreset.reference_models || []

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'div',
          { className: 'moa-tabs' },
          presets.map((pr, idx) =>
            React.createElement(
              'button',
              {
                key: pr.name || idx,
                type: 'button',
                className: activeTab === idx ? 'moa-tab moa-tab-active' : 'moa-tab',
                onClick: () => setActiveTab(idx),
              },
              pr.name + (pr.name === defaultPreset ? ` (${t('isDefault')})` : '')
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'moa-field' },
          React.createElement('label', { className: 'moa-label' }, t('defaultPreset')),
          React.createElement(
            'select',
            {
              className: 'moa-select',
              value: defaultPreset,
              onChange: (e) => setDefaultPreset(e.target.value),
            },
            presets.map((pr) =>
              React.createElement('option', { key: pr.name, value: pr.name }, pr.name)
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'moa-box' },
          React.createElement(
            'div',
            { className: 'moa-box-title' },
            React.createElement('span', null, t('aggregatorTitle')),
            React.createElement(
              'span',
              { className: 'moa-hint' },
              `T: ${currentPreset.aggregator_temperature ?? 0.4}`
            )
          ),
          React.createElement('div', { className: 'moa-hint' }, t('aggregatorDesc')),
          React.createElement(
            'select',
            {
              className: 'moa-select',
              value: aggKey,
              onChange: (e) => setAggregatorModel(e.target.value),
            },
            modelOptions.map((opt) =>
              React.createElement('option', { key: opt.key, value: opt.key }, opt.label)
            )
          )
        ),
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
            currentRefs.map((ref, idx) => {
              const refKey = `${ref.provider}:${ref.model}`
              return React.createElement(
                'div',
                { key: idx, className: 'moa-ref-row' },
                React.createElement('span', { className: 'moa-ref-badge' }, `${t('candidate')} #${idx + 1}:`),
                React.createElement(
                  'select',
                  {
                    className: 'moa-select moa-ref-select',
                    value: refKey,
                    onChange: (e) => setReferenceModel(idx, e.target.value),
                  },
                  modelOptions.map((opt) =>
                    React.createElement('option', { key: opt.key, value: opt.key }, opt.label)
                  )
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
            })
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn-add',
              onClick: addReference,
            },
            '+ ' + t('addCandidate')
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
          .catch((err) => {
            console.warn('[dsh-moa] Presets fetch failed:', err)
            if (mounted) setStatus('unavailable')
          })

        fetch('/dsh-moa/models', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (!mounted) return
            if (data && data.ok && Array.isArray(data.models)) {
              setAvailableModels(data.models)
            }
          })
          .catch(() => {})

        return () => {
          mounted = false
        }
      }, [])

      React.useEffect(() => {
        const cleanup = reload()
        return cleanup
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
              setTimeout(() => setSaveStatus(''), 2000)
            } else {
              setSaveStatus('Error saving')
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

    exports.inject = ['slots', 'locale', 'sessions']
    exports.apply = function apply(ctx) {
      ctx.locale.register(NS, {
        en: {
          title: 'Mixture of Agents (MoA)',
          description: 'Run tasks with multiple parallel proposer models and a synthesizing judge model',
          slashMoa: 'Run task through Mixture of Agents (/moa <prompt>)',
          defaultPreset: 'Default Preset (used on /moa without arguments)',
          isDefault: 'default',
          aggregatorTitle: 'Judge / Aggregator Model (who reviews and synthesizes)',
          aggregatorDesc: 'Evaluates candidate proposals, corrects hallucinations, and outputs the final unified solution.',
          proposersTitle: 'Candidate Models (Advisors)',
          proposersDesc: 'Generates independent candidate answers in parallel to provide diverse perspectives.',
          parallelCount: 'Parallel workers',
          candidate: 'Candidate',
          addCandidate: 'Add parallel model slot',
          remove: 'Remove',
          save: 'Save Changes',
          saved: 'Saved successfully',
          loading: 'Loading…',
          retry: 'Retry connection',
          unavailable: 'MoA service temporarily unavailable (reconnecting...)',
        },
        ru: {
          title: 'Mixture of Agents (MoA)',
          description: 'Запуск задач через ансамбль параллельных моделей-советников и модель-судью',
          slashMoa: 'Запустить задачу через архитектуру Mixture of Agents (/moa <prompt>)',
          defaultPreset: 'Основной пресет (при вызове /moa без параметров)',
          isDefault: 'основной',
          aggregatorTitle: 'Ведущая модель / Судья (кто проверяет и объединяет)',
          aggregatorDesc: 'Сопоставляет варианты кандидатов, устраняет ошибки и синтезирует итоговое решение.',
          proposersTitle: 'Модели-кандидаты (советники)',
          proposersDesc: 'Параллельно формируют независимые варианты решения одной задачи.',
          parallelCount: 'Параллельных моделей',
          candidate: 'Кандидат',
          addCandidate: 'Добавить модель в параллель',
          remove: 'Удалить',
          save: 'Сохранить',
          saved: 'Успешно сохранено',
          loading: 'Загрузка…',
          retry: 'Повторить подключение',
          unavailable: 'Служба MoA временно недоступна (переподключение...)',
        },
      })

      const t = ctx.locale.bind(NS)

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
