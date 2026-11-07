    function InteractiveWorkbenchSection({ t, currentRefs = [] }) {
      const [historyRuns, setHistoryRuns] = React.useState([])
      const [selectedRunId, setSelectedRunId] = React.useState('')
      const [workbenchData, setWorkbenchData] = React.useState(null)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [selections, setSelections] = React.useState({})
      const [instructions, setInstructions] = React.useState('')
      const [assembling, setAssembling] = React.useState(false)
      const [assembleResult, setAssembleResult] = React.useState(null)
      const [assembleError, setAssembleError] = React.useState(null)
      const [promoting, setPromoting] = React.useState(false)
      const [promoted, setPromoted] = React.useState(false)

      React.useEffect(() => {
        fetch('/dsh-moa/history?limit=30', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && Array.isArray(data.runs)) {
              setHistoryRuns(data.runs)
              if (!selectedRunId && data.runs.length > 0) {
                const runWithFiles = data.runs.find((r) => r.candidates?.some((c) => c.files?.length > 0)) || data.runs[0]
                if (runWithFiles?.id) setSelectedRunId(runWithFiles.id)
              }
            }
          })
          .catch(() => {})
      }, [])

      React.useEffect(() => {
        if (!selectedRunId) return
        setLoading(true)
        setError(null)
        setAssembleResult(null)
        setAssembleError(null)
        setPromoted(false)

        fetch('/dsh-moa/runs/' + encodeURIComponent(selectedRunId) + '/workbench', { cache: 'no-store' })
          .then(async (r) => {
            if (!r.ok) {
              const errJson = await r.json().catch(() => ({}))
              throw new Error(errJson.error || ('HTTP ' + r.status))
            }
            return r.json()
          })
          .then((data) => {
            setWorkbenchData(data)
            const initial = {}
            if (data && data.fileScores && data.fileScores.byFile) {
              for (const [file, scores] of Object.entries(data.fileScores.byFile)) {
                if (Array.isArray(scores) && scores.length > 0) {
                  const sorted = [...scores].sort((a, b) => (b.score || 0) - (a.score || 0))
                  initial[file] = sorted[0].candidateIndex
                }
              }
            } else if (data && Array.isArray(data.candidates)) {
              for (const cand of data.candidates) {
                for (const f of (cand.files || [])) {
                  if (!initial[f.relativePath]) initial[f.relativePath] = cand.index
                }
              }
            }
            setSelections(initial)
          })
          .catch((err) => {
            setError(err?.message || String(err))
          })
          .finally(() => setLoading(false))
      }, [selectedRunId])

      const handleAssemble = () => {
        if (!selectedRunId || Object.keys(selections).length === 0) return
        setAssembling(true)
        setAssembleResult(null)
        setAssembleError(null)
        setPromoted(false)

        const selArray = Object.entries(selections).map(([file, candidateIndex]) => ({
          file,
          candidateIndex: Number(candidateIndex),
        }))

        fetch('/dsh-moa/runs/' + encodeURIComponent(selectedRunId) + '/workbench/assemble', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selections: selArray,
            instructions,
            autoPromote: false,
          }),
        })
          .then(async (r) => {
            const resJson = await r.json().catch(() => ({}))
            if (!r.ok || !resJson.ok) {
              throw new Error(resJson.error || ('HTTP ' + r.status))
            }
            return resJson
          })
          .then((data) => {
            setAssembleResult(data)
          })
          .catch((err) => {
            setAssembleError(err?.message || String(err))
          })
          .finally(() => setAssembling(false))
      }

      const handlePromote = () => {
        if (!selectedRunId) return
        setPromoting(true)
        fetch('/dsh-moa/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runId: selectedRunId,
            candidate: 'workbench-glue',
            force: true,
          }),
        })
          .then(async (r) => {
            const resJson = await r.json().catch(() => ({}))
            if (!r.ok || !resJson.ok) throw new Error(resJson.error || ('HTTP ' + r.status))
            setPromoted(true)
          })
          .catch((err) => {
            setAssembleError('Promotion failed: ' + (err?.message || String(err)))
          })
          .finally(() => setPromoting(false))
      }

      // Collect all files from byFile or candidates
      const allFiles = []
      if (workbenchData?.fileScores?.byFile) {
        for (const file of Object.keys(workbenchData.fileScores.byFile)) {
          allFiles.push(file)
        }
      } else if (Array.isArray(workbenchData?.candidates)) {
        const fileSet = new Set()
        for (const c of workbenchData.candidates) {
          for (const f of (c.files || [])) fileSet.add(f.relativePath)
        }
        allFiles.push(...Array.from(fileSet))
      }

      return React.createElement(
        'div',
        { className: 'moa-section-card', style: { marginTop: 12 } },
        React.createElement('div', { className: 'moa-section-title' }, t('workbench.title') || '🛠️ Interactive Synthesis Workbench'),
        React.createElement('div', { className: 'moa-section-desc' }, t('workbench.desc') || 'Inspect 1–10 file scores across candidate models, pick & mix desired files, harmonize with top-model glue, and execute judge re-audit.'),

        /* Run Selection Bar */
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' } }, t('workbench.select_run') || 'MoA Run:'),
          React.createElement(
            'select',
            {
              className: 'moa-select',
              style: { height: 28, fontSize: 12, padding: '0 8px', minWidth: 260, maxWidth: '100%' },
              value: selectedRunId,
              onChange: (e) => setSelectedRunId(e.target.value),
            },
            historyRuns.length === 0 && React.createElement('option', { value: '' }, t('workbench.no_runs') || 'No runs recorded'),
            historyRuns.map((r) => {
              const fileCount = (r.candidates || []).reduce((acc, c) => acc + (c.files?.length || 0), 0)
              const label = `${(r.prompt || '').slice(0, 36)}... [${fileCount} files, winner: ${r.winnerModel || 'none'}]`
              return React.createElement('option', { key: r.id, value: r.id }, label)
            })
          ),
          /* Companion Plugin Badge */
          React.createElement(
            'div',
            { style: { marginLeft: 'auto', fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', display: 'flex', alignItems: 'center', gap: 4 } },
            '🔗 Companion: ',
            React.createElement(
              'a',
              {
                href: 'https://github.com/goodandready/dsh-time-machine',
                target: '_blank',
                rel: 'noopener noreferrer',
                style: { color: 'var(--dsw-alias-state-brand-primary)', textDecoration: 'underline' },
              },
              'dsh-time-machine'
            )
          )
        ),

        loading && React.createElement('div', { style: { padding: '16px 0', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, '⏳ Loading workbench data...'),
        error && React.createElement('div', { style: { padding: '8px 12px', background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)', color: 'var(--dsw-alias-state-error-primary)', border: '1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent)', borderRadius: 6, fontSize: 12, marginTop: 8 } }, error),

        /* File Matrix */
        !loading && !error && allFiles.length === 0 && React.createElement(
          'div',
          { style: { padding: '14px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginTop: 8 } },
          t('workbench.empty_files') || 'No candidate files found for this run.'
        ),

        !loading && !error && allFiles.length > 0 && React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 } },
          allFiles.map((file) => {
            const fileScores = workbenchData?.fileScores?.byFile?.[file] || []
            const selectedCand = selections[file]

            return React.createElement(
              'div',
              {
                key: file,
                style: {
                  padding: '10px 12px',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  borderRadius: 8,
                  border: '1px solid var(--dsw-alias-border-l2)',
                },
              },
              /* File Title Bar */
              React.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
                React.createElement(
                  'span',
                  { style: { fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))' } },
                  '📄 ' + file
                ),
                React.createElement(
                  'span',
                  { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' } },
                  fileScores.length + ' candidate proposal(s)'
                )
              ),

              /* Candidate Choices for this file */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                fileScores.map((scoreItem) => {
                  const isChecked = selectedCand === scoreItem.candidateIndex
                  const scoreVal = scoreItem.score || 7
                  const scoreBg = scoreVal >= 8 ? 'var(--dsw-alias-state-success-primary)' : (scoreVal >= 5 ? 'var(--dsw-alias-state-warning-primary)' : 'var(--dsw-alias-state-error-primary)')

                  return React.createElement(
                    'label',
                    {
                      key: scoreItem.candidateIndex,
                      style: {
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        cursor: 'pointer',
                        padding: '6px 8px',
                        background: isChecked ? 'color-mix(in srgb, var(--dsw-alias-state-brand-primary) 8%, transparent)' : 'transparent',
                        borderRadius: 6,
                        border: isChecked ? '1px solid var(--dsw-alias-state-brand-primary)' : '1px solid transparent',
                      },
                    },
                    React.createElement('input', {
                      type: 'radio',
                      name: 'file-' + file,
                      checked: isChecked,
                      onChange: () => setSelections((prev) => ({ ...prev, [file]: scoreItem.candidateIndex })),
                      style: { marginTop: 3, accentColor: 'var(--dsw-alias-state-brand-primary)' },
                    }),
                    React.createElement(
                      'div',
                      { style: { flex: 1, fontSize: 12 } },
                      React.createElement(
                        'div',
                        { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                        React.createElement('span', { style: { fontWeight: 600 } }, scoreItem.candidateLabel || ('Candidate ' + scoreItem.candidateIndex)),
                        React.createElement(
                          'span',
                          {
                            style: {
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#fff',
                              background: scoreBg,
                              padding: '1px 6px',
                              borderRadius: 4,
                            },
                          },
                          'Score: ' + scoreVal + '/10'
                        )
                      ),
                      scoreItem.pros && React.createElement(
                        'div',
                        { style: { fontSize: 11, color: 'var(--dsw-alias-state-success-primary)', marginTop: 2 } },
                        '⭐ ' + (t('workbench.pros') || 'Pros:') + ' ' + scoreItem.pros
                      ),
                      scoreItem.cons && React.createElement(
                        'div',
                        { style: { fontSize: 11, color: 'var(--dsw-alias-state-error-primary)', marginTop: 1 } },
                        '⚠️ ' + (t('workbench.cons') || 'Cons:') + ' ' + scoreItem.cons
                      )
                    )
                  )
                })
              )
            )
          }),

          /* Harmonization Instructions Input */
          React.createElement(
            'div',
            { style: { marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 } },
            React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' } }, t('workbench.instructions_label') || 'Harmonization Instructions (Optional):'),
            React.createElement('input', {
              type: 'text',
              className: 'moa-input',
              style: { height: 32, fontSize: 12, padding: '0 8px' },
              placeholder: t('workbench.instructions_placeholder') || 'e.g. Ensure all imports match, unify TypeScript types, align function signatures...',
              value: instructions,
              onChange: (e) => setInstructions(e.target.value),
            })
          ),

          /* Action Button */
          React.createElement(
            'button',
            {
              className: 'moa-btn moa-btn-primary',
              style: { height: 36, fontSize: 13, fontWeight: 600, marginTop: 6 },
              disabled: assembling || Object.keys(selections).length === 0,
              onClick: handleAssemble,
            },
            assembling ? (t('workbench.assembling') || '⏳ Harmonizing files with Top Model...') : (t('workbench.assemble_btn') || '🚀 Harmonize & Assemble (Top-Model Glue)')
          ),

          assembleError && React.createElement(
            'div',
            { style: { padding: '8px 12px', background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)', color: 'var(--dsw-alias-state-error-primary)', border: '1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent)', borderRadius: 6, fontSize: 12, marginTop: 8 } },
            assembleError
          ),

          /* Harmonization Result Card */
          assembleResult && React.createElement(
            'div',
            {
              style: {
                marginTop: 10,
                padding: '12px',
                background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 40%, transparent)',
                borderRadius: 8,
              },
            },
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
              React.createElement('div', { style: { fontWeight: 700, fontSize: 13, color: 'var(--dsw-alias-state-success-primary)' } }, '✨ Harmonization Complete! Top Model: ' + (assembleResult.topModel || 'Master')),
              React.createElement(
                'span',
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    background: assembleResult.judgeAudit?.passed ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)',
                    padding: '2px 8px',
                    borderRadius: 4,
                  },
                },
                'Judge: ' + (assembleResult.judgeAudit?.rawVerdict || (assembleResult.judgeAudit?.passed ? 'PASSED' : 'FAILED')) + ' (' + (assembleResult.judgeAudit?.score || 8) + '/10)'
              )
            ),

            /* Audit notes */
            assembleResult.judgeAudit?.notes && React.createElement(
              'div',
              { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginBottom: 8, background: 'var(--dsw-alias-bg-layer-2)', padding: '6px 8px', borderRadius: 4 } },
              assembleResult.judgeAudit.notes
            ),

            /* Glued files */
            React.createElement(
              'div',
              { style: { fontSize: 11, color: 'var(--dsw-alias-label-primary)', marginBottom: 8 } },
              'Glued Files: ' + (assembleResult.gluedFiles || []).map((f) => `${f.relativePath} (${f.size}B)`).join(', ')
            ),

            /* Promotion Button */
            !promoted && React.createElement(
              'button',
              {
                className: 'moa-btn moa-btn-success',
                style: { height: 32, fontSize: 12, fontWeight: 600 },
                disabled: promoting,
                onClick: handlePromote,
              },
              promoting ? '⏳ Promoting to workspace...' : (t('workbench.promote_btn') || 'Promote Harmonized Files to Workspace')
            ),

            promoted && React.createElement(
              'div',
              { style: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-state-success-primary)', marginTop: 4 } },
              t('workbench.promoted_ok') || '✅ Harmonized deliverable promoted to workspace root!'
            )
          )
        )
      )
    }
