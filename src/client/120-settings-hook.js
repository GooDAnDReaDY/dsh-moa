    function useMoASettings(props) {
      const effectiveCtx = (props && props.ctx) || rootCtx
      // English is canonical; prefer the core-provided translator for the
      // active UI language (the slot declares locale: NS), fall back to en.
      const t = typeof props?.t === 'function' ? props.t : makeT(en, null)

      const scope = React.useMemo(() => {
        if (!effectiveCtx) return undefined
        const s = effectiveCtx.get ? effectiveCtx.get('settingsScope') : effectiveCtx.settingsScope
        return s && typeof s.bind === 'function' ? s.bind({ namespace: NS }) : undefined
      }, [effectiveCtx])

      const snapshot = React.useSyncExternalStore
        ? React.useSyncExternalStore(
            React.useMemo(() => (cb) => (scope ? scope.subscribe(cb) : () => {}), [scope]),
            React.useCallback(() => (scope ? scope.getSnapshot() : { status: 'unavailable' }), [scope]),
            React.useCallback(() => ({ status: 'loading' }), [])
          )
        : null

      const [status, setStatus] = React.useState('loading')
      const [presets, setPresets] = React.useState([])
      const [defaultPreset, setDefaultPreset] = React.useState('default')
      const [availableModels, setAvailableModels] = React.useState([])
      const [saveStatus, setSaveStatus] = React.useState('')
      const [updateState, setUpdateState] = React.useState({
        checking: false,
        updating: false,
        currentVersion: '0.2.16',
        latestVersion: undefined,
        updateAvailable: false,
        notice: null,
        error: null,
      })

      const checkUpdates = async () => {
        setUpdateState((prev) => ({ ...prev, checking: true, error: null, notice: null }))
        try {
          const res = await fetch('/api/dsh-moa/update', { cache: 'no-store' })
          const data = await res.json()
          if (data && data.currentVersion) {
            setUpdateState((prev) => ({
              ...prev,
              checking: false,
              currentVersion: data.currentVersion,
              latestVersion: data.latestVersion,
              updateAvailable: Boolean(data.updateAvailable),
              error: data.latestCheckFailed ? (t('updater.checkFailed') || 'Registry check failed') : null,
            }))
          } else {
            setUpdateState((prev) => ({ ...prev, checking: false, error: data.error || 'Check failed' }))
          }
        } catch (err) {
          setUpdateState((prev) => ({ ...prev, checking: false, error: String(err?.message || err) }))
        }
      }

      const runUpdate = async () => {
        setUpdateState((prev) => ({ ...prev, updating: true, error: null, notice: null }))
        try {
          const res = await fetch('/api/dsh-moa/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-dsh-plugin-update': '1' },
          })
          const data = await res.json()
          if (data && data.updated) {
            setUpdateState((prev) => ({
              ...prev,
              updating: false,
              updateAvailable: false,
              currentVersion: data.updatedVersion || data.latestVersion,
              notice: (t('updater.success') || 'Successfully updated to v{version}. Restart DSH to apply.').replace('{version}', data.updatedVersion || data.latestVersion),
            }))
          } else {
            setUpdateState((prev) => ({
              ...prev,
              updating: false,
              error: data.error || data.message || 'Update failed',
            }))
          }
        } catch (err) {
          setUpdateState((prev) => ({ ...prev, updating: false, error: String(err?.message || err) }))
        }
      }
      const [enabled, setEnabled] = React.useState(true)
      const [hostStatus, setHostStatus] = React.useState('connecting')
      const [stats, setStats] = React.useState({ totalRuns: null, avgCostUsd: null })
      const [leaderboard, setLeaderboard] = React.useState([])
      const [leaderboardPresetFilter, setLeaderboardPresetFilter] = React.useState('all')

      React.useEffect(() => {
        if (!scope || !snapshot) {
          setStatus('unavailable')
          return
        }
        const snapStatus = snapshot.status || 'unavailable'
        if (snapStatus === 'ready') {
          const val = snapshot.value || {}
          if (Array.isArray(val.presets)) setPresets(val.presets)
          if (val.default_preset) setDefaultPreset(val.default_preset)
          if (typeof val.enabled === 'boolean') setEnabled(val.enabled)
          setStatus('ready')
        } else if (snapStatus === 'unavailable') {
          setStatus('unavailable')
        }
      }, [scope, snapshot])

      const reload = React.useCallback(() => {
        if (!scope) setStatus('loading')

        fetch('/dsh-moa/status', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok) {
              setHostStatus(data.enabled === false ? 'disabled' : 'online')
            } else {
              setHostStatus('offline')
            }
          })
          .catch(() => {
            setHostStatus('offline')
          })

        const lbUrl = leaderboardPresetFilter !== 'all'
          ? `/dsh-moa/leaderboard?preset=${encodeURIComponent(leaderboardPresetFilter)}`
          : '/dsh-moa/leaderboard'
        fetch(lbUrl, { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && Array.isArray(data.models)) {
              setLeaderboard(data.models.slice(0, 10))
            }
          })
          .catch(() => {})

        fetch('/dsh-moa/history?limit=100', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && Array.isArray(data.runs)) {
              const runs = data.runs
              const withCost = runs.filter((run) => typeof run.totalCostUsd === 'number')
              const avgCostUsd = withCost.length > 0
                ? withCost.reduce((acc, run) => acc + run.totalCostUsd, 0) / withCost.length
                : null
              setStats({ totalRuns: data.total || runs.length, avgCostUsd })
            }
          })
          .catch((err) => {
            console.warn('[dsh-moa] History fetch failed:', err)
          })

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
            scope.set('enabled', enabled),
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
          body: JSON.stringify({ enabled, presets, default_preset: defaultPreset }),
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
        enabled,
        setEnabled,
        hostStatus,
        stats,
        leaderboard,
        leaderboardPresetFilter,
        setLeaderboardPresetFilter,
        handleSave,
        saveStatus,
        reload,
        updateState,
        checkUpdates,
        runUpdate,
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

