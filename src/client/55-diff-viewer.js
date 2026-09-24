    function CandidateDiffSection({ t, currentRefs = [] }) {
      const [fromCandidate, setFromCandidate] = React.useState('1')
      const [toCandidate, setToCandidate] = React.useState('curator-synthesis')
      const [selectedFile, setSelectedFile] = React.useState('')
      const [files, setFiles] = React.useState([])
      const [diff, setDiff] = React.useState([])
      const [fromSize, setFromSize] = React.useState(0)
      const [toSize, setToSize] = React.useState(0)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [hasFetched, setHasFetched] = React.useState(false)

      const candidateCount = Math.max(currentRefs.length || 0, 2)
      const candidateOptions = []
      for (let i = 1; i <= candidateCount; i++) {
        candidateOptions.push({
          value: String(i),
          label: (t('diff.candidate') || 'Candidate {num}').replace('{num}', String(i)),
        })
      }

      const loadDiff = React.useCallback((targetFile = selectedFile) => {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams()
        if (fromCandidate) params.set('from', fromCandidate)
        if (toCandidate) params.set('to', toCandidate)
        if (targetFile) params.set('file', targetFile)

        fetch('/dsh-moa/diff?' + params.toString(), { cache: 'no-store' })
          .then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status)
            return r.json()
          })
          .then((data) => {
            setLoading(false)
            setHasFetched(true)
            if (data && data.ok) {
              const fileList = Array.isArray(data.files) ? data.files : []
              setFiles(fileList)
              setDiff(Array.isArray(data.diff) ? data.diff : [])
              setFromSize(data.fromSize || 0)
              setToSize(data.toSize || 0)
              if (data.selectedFile && data.selectedFile !== targetFile) {
                setSelectedFile(data.selectedFile)
              }
            } else {
              setError(data?.error || 'Failed to load diff')
            }
          })
          .catch((err) => {
            setLoading(false)
            setHasFetched(true)
            setError(err.message || String(err))
          })
      }, [fromCandidate, toCandidate, selectedFile])

      React.useEffect(() => {
        loadDiff()
      }, [fromCandidate, toCandidate])

      const handleFileChange = (e) => {
        const nextFile = e.target.value
        setSelectedFile(nextFile)
        loadDiff(nextFile)
      }

      const adds = diff.filter((d) => d.type === 'added').length
      const dels = diff.filter((d) => d.type === 'removed').length

      return React.createElement(
        'div',
        { className: 'moa-section-card' },
        React.createElement('div', { className: 'moa-section-title' }, t('diff.title') || '🔍 Candidate Diff Viewer'),
        React.createElement('div', { className: 'moa-section-desc' }, t('diff.desc') || 'Visually inspect differences between candidate solutions and judge synthesis in the project workspace.'),

        React.createElement(
          'div',
          { className: 'moa-diff-container' },
          /* Controls bar */
          React.createElement(
            'div',
            { className: 'moa-diff-controls' },
            React.createElement(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
              t('diff.select_from') || 'Base:',
              React.createElement(
                'select',
                {
                  className: 'moa-diff-select',
                  value: fromCandidate,
                  onChange: (e) => setFromCandidate(e.target.value),
                },
                candidateOptions.map((opt) => React.createElement('option', { key: opt.value, value: opt.value }, opt.label)),
                React.createElement('option', { value: 'curator-synthesis' }, t('diff.curator') || 'Curator Synthesis')
              )
            ),
            React.createElement(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
              t('diff.select_to') || 'Compare with:',
              React.createElement(
                'select',
                {
                  className: 'moa-diff-select',
                  value: toCandidate,
                  onChange: (e) => setToCandidate(e.target.value),
                },
                React.createElement('option', { value: 'curator-synthesis' }, t('diff.curator') || 'Curator Synthesis'),
                candidateOptions.map((opt) => React.createElement('option', { key: opt.value, value: opt.value }, opt.label))
              )
            ),
            files.length > 0 && React.createElement(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
              t('diff.select_file') || 'File:',
              React.createElement(
                'select',
                {
                  className: 'moa-diff-select',
                  value: selectedFile || files[0] || '',
                  onChange: handleFileChange,
                },
                files.map((f) => React.createElement('option', { key: f, value: f }, f))
              )
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'moa-btn moa-btn-sub',
                onClick: () => loadDiff(),
                disabled: loading,
              },
              loading ? (t('diff.loading') || 'Loading...') : (t('diff.refresh') || 'Refresh Diff')
            ),
            diff.length > 0 && React.createElement(
              'div',
              { style: { fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' } },
              adds > 0 && React.createElement('span', { className: 'moa-diff-stat-add' }, `+${adds}`),
              dels > 0 && React.createElement('span', { className: 'moa-diff-stat-del' }, `-${dels}`),
              fromSize > 0 && toSize > 0 && React.createElement(
                'span',
                { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11 } },
                `(${fromSize}B → ${toSize}B)`
              )
            )
          ),

          /* Error state */
          error && React.createElement(
            'div',
            { className: 'moa-alert-err', style: { fontSize: 12, padding: '8px 12px' } },
            error
          ),

          /* Empty files state */
          !error && !loading && hasFetched && files.length === 0 && React.createElement(
            'div',
            { style: { padding: '16px 12px', textAlign: 'center', color: 'var(--dsw-alias-label-secondary)', fontSize: 13, background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8 } },
            t('diff.no_files') || 'No files found in candidate workspaces (.moa). Run a task with /moa to generate candidate code.'
          ),

          /* Identical content state */
          !error && !loading && files.length > 0 && diff.length > 0 && adds === 0 && dels === 0 && React.createElement(
            'div',
            { style: { padding: '12px', textAlign: 'center', color: 'var(--dsw-alias-state-success-primary)', fontSize: 12, background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8 } },
            t('diff.empty') || 'Selected files are identical (zero diff).'
          ),

          /* Diff lines display */
          !error && files.length > 0 && diff.length > 0 && (adds > 0 || dels > 0) && React.createElement(
            'div',
            { className: 'moa-diff-box' },
            diff.map((item, idx) => {
              const isAdd = item.type === 'added'
              const isDel = item.type === 'removed'
              const lineClass = isAdd ? 'moa-diff-line moa-diff-line-add' : isDel ? 'moa-diff-line moa-diff-line-del' : 'moa-diff-line moa-diff-line-same'
              const prefix = isAdd ? '+' : isDel ? '-' : ' '
              return React.createElement(
                'div',
                { key: idx, className: lineClass },
                React.createElement('span', { className: 'moa-diff-prefix' }, prefix),
                React.createElement('span', { className: 'moa-diff-content' }, item.line)
              )
            })
          )
        )
      )
    }
