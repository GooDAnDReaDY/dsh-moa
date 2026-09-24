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
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.curator_synthesis),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, curator_synthesis: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.curator_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.curator_hint')
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: currentPreset.stream_aggregator !== false,
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, stream_aggregator: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.stream_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.stream_hint')
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.blind_evaluation),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, blind_evaluation: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.blind_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.blind_hint')
              ),
              React.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 } },
                React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('aggregator.timeout_label')),
                React.createElement('input', {
                  type: 'number',
                  className: 'moa-input',
                  style: { width: 80, height: 28, padding: '0 6px', fontSize: 12 },
                  min: 30,
                  max: 600,
                  value: currentPreset.aggregator_timeout_sec ?? 180,
                  onChange: (e) => {
                    const val = parseInt(e.target.value, 10)
                    updateCurrentPreset((p) => ({ ...p, aggregator_timeout_sec: isNaN(val) ? 180 : val }))
                  },
                })
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.peer_critique_enabled),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, peer_critique_enabled: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.peer_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.peer_hint')
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.allow_candidate_override),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, allow_candidate_override: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.override_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.override_hint')
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.test_gate_enabled),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, test_gate_enabled: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.test_gate_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.test_gate_hint')
              ),
              Boolean(currentPreset.test_gate_enabled) &&
                React.createElement(
                  'div',
                  { style: { marginLeft: 22, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 } },
                  React.createElement('input', {
                    type: 'text',
                    className: 'moa-input',
                    style: { fontSize: 12, height: 28 },
                    placeholder: t('aggregator.test_cmd_placeholder'),
                    value: currentPreset.test_command || '',
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, test_command: e.target.value })),
                  }),
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('aggregator.test_timeout_label')),
                    React.createElement('input', {
                      type: 'number',
                      className: 'moa-input',
                      style: { width: 70, height: 26, fontSize: 12 },
                      min: 5,
                      max: 120,
                      value: currentPreset.test_gate_timeout_sec ?? 15,
                      onChange: (e) => {
                        const val = parseInt(e.target.value, 10)
                        updateCurrentPreset((p) => ({ ...p, test_gate_timeout_sec: isNaN(val) ? 15 : val }))
                      },
                    })
                  )
                ),
              /* Multi-Judge Panel & Consensus Voting */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.multi_judge_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, multi_judge_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  'Multi-Judge Panel & Consensus Voting'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  'Deploy multiple judge models to score candidates and determine winner via consensus voting.'
                ),
                currentPreset.multi_judge_enabled && React.createElement(
                  'div',
                  { style: { marginLeft: 22, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
                  React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, 'Voting Strategy:'),
                  React.createElement(
                    'select',
                    {
                      className: 'moa-select',
                      style: { width: 140, height: 28, fontSize: 12, padding: '0 6px' },
                      value: currentPreset.judge_voting_strategy || 'majority',
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, judge_voting_strategy: e.target.value })),
                    },
                    React.createElement('option', { value: 'majority' }, 'Majority Vote'),
                    React.createElement('option', { value: 'highest_score' }, 'Highest Score'),
                    React.createElement('option', { value: 'unanimous' }, 'Unanimous')
                  )
                )
              ),

              /* Composite Hybrid Synthesis (AST / Block Merge) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.composite_merge_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, composite_merge_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  'Composite Hybrid Synthesis (AST / Block Merge)'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  'Synthesize modular code blocks, types, and algorithms from multiple candidates into a unified composite.'
                )
              ),

              /* Cost Budget Guardrails & Auto-Fallback */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.budget_guard_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, budget_guard_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  'Cost Budget Guardrails & Auto-Fallback'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  'Cap maximum run cost; auto-trim candidate pool or abort to prevent accidental token spend.'
                ),
                currentPreset.budget_guard_enabled && React.createElement(
                  'div',
                  { style: { marginLeft: 22, display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 } },
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, 'Max USD ($):'),
                    React.createElement('input', {
                      type: 'number',
                      step: '0.01',
                      className: 'moa-input',
                      style: { width: 80, height: 28, padding: '0 6px', fontSize: 12 },
                      value: currentPreset.max_budget_usd ?? 0.1,
                      onChange: (e) => {
                        const val = parseFloat(e.target.value)
                        updateCurrentPreset((p) => ({ ...p, max_budget_usd: isNaN(val) ? 0 : val }))
                      },
                    })
                  ),
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, 'Action:'),
                    React.createElement(
                      'select',
                      {
                        className: 'moa-select',
                        style: { width: 100, height: 28, fontSize: 12, padding: '0 6px' },
                        value: currentPreset.budget_action || 'trim',
                        onChange: (e) => updateCurrentPreset((p) => ({ ...p, budget_action: e.target.value })),
                      },
                      React.createElement('option', { value: 'trim' }, 'Trim Pool'),
                      React.createElement('option', { value: 'abort' }, 'Abort')
                    )
                  )
                )
              ),

              /* Automated Benchmark & Post-Mortem Report */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.report_generation_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, report_generation_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  'Automated Benchmark & Post-Mortem Report'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  'Generate downloadable Markdown & JSON reports detailing candidate latency, agreement, test gate, and cost breakdown.'
                )
              ),

              /* Graceful Degradation & Local Fallback */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.local_fallback_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, local_fallback_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  'Graceful Degradation & Local Fallback'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  'Automatically fall back to local Ollama / MiniPC models when online candidate APIs fail.'
                )
              ),

              /* Fallback Judges Chain */
              React.createElement(
                'div',
                { style: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 } },
                React.createElement(
                  'div',
                  { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } },
                  t('aggregator.fallbacks_title')
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginTop: -4 } },
                  t('aggregator.fallbacks_desc')
                ),
                (Array.isArray(currentPreset.aggregator_fallbacks) ? currentPreset.aggregator_fallbacks : []).map((fb, fbIdx) =>
                  React.createElement(
                    'div',
                    { key: fbIdx, style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement('span', { className: 'moa-cand-badge' }, `Fallback #${fbIdx + 1}`),
                    React.createElement(
                      'div',
                      { style: { flex: 1 } },
                      React.createElement(SearchableModelPicker, {
                        value: fb,
                        onChange: (val) => {
                          updateCurrentPreset((p) => {
                            const list = [...(p.aggregator_fallbacks || [])]
                            list[fbIdx] = val
                            return { ...p, aggregator_fallbacks: list }
                          })
                        },
                        allModels,
                        t,
                      })
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'moa-btn moa-btn-danger moa-btn-sub',
                        onClick: () => {
                          updateCurrentPreset((p) => ({
                            ...p,
                            aggregator_fallbacks: (p.aggregator_fallbacks || []).filter((_, i) => i !== fbIdx),
                          }))
                        },
                      },
                      '✕'
                    )
                  )
                ),
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'moa-btn moa-btn-sub',
                      style: { marginTop: 4 },
                      onClick: () => {
                        updateCurrentPreset((p) => ({
                          ...p,
                          aggregator_fallbacks: [...(p.aggregator_fallbacks || []), { provider: 'opencode-go', model: 'deepseek-v4-flash' }],
                        }))
                      },
                    },
                    t('aggregator.add_fallback_btn')
                  )
                )
              )
            )
          )
        ),

