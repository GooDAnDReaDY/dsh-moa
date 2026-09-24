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
            { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)' } },
            React.createElement(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
              React.createElement('input', {
                type: 'checkbox',
                checked: Boolean(currentPreset.quorum_enabled),
                onChange: (e) => updateCurrentPreset((p) => ({ ...p, quorum_enabled: e.target.checked })),
                style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
              }),
              t('proposers.quorum_label')
            ),
            React.createElement(
              'div',
              { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
              t('proposers.quorum_hint')
            ),
            currentPreset.quorum_enabled && React.createElement(
              'div',
              { style: { marginLeft: 22, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
              React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('proposers.grace_label')),
              React.createElement('input', {
                type: 'number',
                className: 'moa-input',
                style: { width: 70, height: 28, padding: '0 6px', fontSize: 12 },
                min: 2,
                max: 60,
                value: currentPreset.grace_period_sec ?? 10,
                onChange: (e) => {
                  const val = parseInt(e.target.value, 10)
                  updateCurrentPreset((p) => ({ ...p, grace_period_sec: isNaN(val) ? 10 : val }))
                },
              })
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
              React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('proposers.timeout_label')),
              React.createElement('input', {
                type: 'number',
                className: 'moa-input',
                style: { width: 70, height: 28, padding: '0 6px', fontSize: 12 },
                min: 10,
                max: 300,
                value: currentPreset.reference_timeout_sec ?? 60,
                onChange: (e) => {
                  const val = parseInt(e.target.value, 10)
                  updateCurrentPreset((p) => ({ ...p, reference_timeout_sec: isNaN(val) ? 60 : val }))
                },
              })
            ),
            React.createElement(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 4 } },
              React.createElement('input', {
                type: 'checkbox',
                checked: Boolean(currentPreset.temperature_gradient_enabled),
                onChange: (e) => updateCurrentPreset((p) => ({ ...p, temperature_gradient_enabled: e.target.checked })),
                style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
              }),
              'Temperature Gradient Exploration (0.2 → 0.9 across candidates)'
            )
          ),
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
                React.createElement('input', {
                  type: 'number',
                  step: '0.1',
                  min: '0',
                  max: '2',
                  placeholder: 'Temp',
                  title: 'Candidate Temperature (leave empty for default/gradient)',
                  className: 'moa-input',
                  style: { width: 50, height: 32, fontSize: 12, padding: '0 4px', textAlign: 'center' },
                  value: (typeof ref.temperature === 'number' && ref.temperature >= 0) ? ref.temperature : '',
                  onChange: (e) => {
                    const raw = e.target.value
                    const parsedVal = raw === '' ? -1 : parseFloat(raw)
                    updateCurrentPreset((p) => {
                      const refs = [...(p.reference_models || [])]
                      refs[idx] = { ...refs[idx], temperature: isNaN(parsedVal) ? -1 : parsedVal }
                      return { ...p, reference_models: refs }
                    })
                  },
                }),
                React.createElement(
                  'select',
                  {
                    className: 'moa-select',
                    style: { width: 105, height: 32, fontSize: 12, padding: '0 6px' },
                    value: ref.role_persona || 'general',
                    title: t('proposers.role_label'),
                    onChange: (e) => {
                      const newRole = e.target.value
                      updateCurrentPreset((p) => {
                        const refs = [...(p.reference_models || [])]
                        refs[idx] = { ...refs[idx], role_persona: newRole }
                        return { ...p, reference_models: refs }
                      })
                    },
                  },
                  React.createElement('option', { value: 'general' }, t('proposers.role_general') || 'General'),
                  React.createElement('option', { value: 'minimalist' }, t('proposers.role_minimalist') || 'Minimalist'),
                  React.createElement('option', { value: 'robustness' }, t('proposers.role_robustness') || 'Robustness'),
                  React.createElement('option', { value: 'performance' }, t('proposers.role_performance') || 'Performance'),
                  React.createElement('option', { value: 'tester' }, t('proposers.role_tester') || 'Tester')
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

