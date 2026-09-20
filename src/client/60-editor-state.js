    function MoAEditor({
      t,
      presets,
      setPresets,
      defaultPreset,
      setDefaultPreset,
      availableModels,
      enabled,
      setEnabled,
      hostStatus,
      stats,
      leaderboard = [],
      leaderboardPresetFilter = 'all',
      setLeaderboardPresetFilter = () => {},
      handleSave,
      saveStatus,
      reload,
      updateState,
      checkUpdates,
      runUpdate,
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
      const hostStatusBadge = hostStatus === 'online'
        ? React.createElement('span', { className: 'moa-badge moa-badge-ok' }, '🟢 ' + t('badge.online'))
        : hostStatus === 'disabled'
          ? React.createElement('span', { className: 'moa-badge moa-badge-warn' }, '⏸ ' + t('badge.disabled'))
          : React.createElement('span', { className: 'moa-badge moa-badge-warn' }, '🔴 ' + t('badge.offline'))

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
                hostStatusBadge,
                React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.preset', { name: currentPreset.name })),
              React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.models', { count: availableModels.length })),
              React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.candidates', { count: currentRefs.length }))
            )
          ),
          React.createElement('div', { className: 'moa-page-sub' }, t('header.sub'))
        ),

