              /* Self-Learning Developer Preferences Metaprompt (#309) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.developer_preferences_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, developer_preferences_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.preferences_title') || '🧠 Developer Coding Principles & Preferences Metaprompt'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.preferences_desc') || 'Injects learned developer preferences (strict typing, functional immutability, error boundaries) to guide Judge synthesis.'
                )
              ),

              /* Adversarial White-Hat Security Fuzzing Gate (#302) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.security_gate_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, security_gate_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.security_gate_title') || '🛡️ Adversarial White-Hat Security Fuzzing Gate'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.security_gate_desc') || 'Red-team security auditor checks candidate proposals for SQLi, XSS, ReDoS, Command Injection and Path Traversal with blocking SECURITY_VETO.'
                )
              ),

              /* Chain-of-Verification (CoVe) Fact-Checking Gate (#314) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.cove_verification_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, cove_verification_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.cove_gate_title') || '🔍 Chain-of-Verification (CoVe) Fact-Checking Gate'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.cove_gate_desc') || 'Formulates API existence & method signature verification questions, disqualifying candidates that use hallucinated methods.'
                )
              ),

              /* Automated Runtime Memory & CPU Profiler Gate (#315) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.profiler_gate_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, profiler_gate_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.profiler_gate_title') || '⚡ Automated Runtime Memory & CPU Profiler Gate'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.profiler_gate_desc') || 'Runs isolated micro-benchmarks measuring execution latency, throughput (ops/sec), and heap memory usage.'
                )
              ),

              /* Runtime Mutation Testing Gate (#316) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.mutation_testing_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, mutation_testing_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.mutation_gate_title') || '🧬 Runtime Mutation Testing Gate for Candidate Tests'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.mutation_gate_desc') || 'Injects synthetic faults into candidate code to test test-suite robustness, eliminating tautological and weak tests.'
                )
              ),

              /* Hybrid Edge Privacy Gate (#306) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', cursor: 'pointer' } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.hybrid_edge_privacy_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, hybrid_edge_privacy_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.privacy_gate_title') || '🛡️ Hybrid Private Edge MoA (Local Edge Proposers + Cloud Judge)'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.privacy_gate_desc') || 'Scans and redacts proprietary secrets, local paths, and private network IPs before forwarding proposals to external cloud judges.'
                )
              ),

              /* Heterogeneous Speculative Decoding (#317) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', cursor: 'pointer' } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.speculative_draft_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, speculative_draft_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.speculative_gate_title') || '⚡ Heterogeneous Speculative Decoding (Local Draft + Cloud Verifier)'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.speculative_gate_desc') || 'Lightweight local edge model generates high-speed token drafts verified and completed in one fast pass by the cloud model.'
                )
              ),

              /* Pareto Frontier Slider (#307) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', cursor: 'pointer' } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.pareto_slider_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, pareto_slider_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.pareto_slider_title') || '📈 Cost vs Quality Pareto Frontier Slider'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.pareto_slider_desc') || 'Reactive balance from 100% free local edge models to ultra-rigorous flagship multi-judge consensus.'
                ),
                currentPreset.pareto_slider_enabled && React.createElement(
                  'div',
                  { style: { marginLeft: 22, marginTop: 4, display: 'flex', alignItems: 'center', gap: 10 } },
                  React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('aggregator.pareto_pos_label') || 'Frontier Position:'),
                  React.createElement('input', {
                    type: 'range',
                    min: 0,
                    max: 100,
                    step: 5,
                    value: currentPreset.pareto_slider_position ?? 50,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, pareto_slider_position: Number(e.target.value) })),
                    style: { cursor: 'pointer', flex: 1, maxWidth: 200 },
                  }),
                  React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, String(currentPreset.pareto_slider_position ?? 50) + '%')
                )
              ),

              /* Hard Token Budget Guard (#319) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', cursor: 'pointer' } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.hard_budget_guard_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, hard_budget_guard_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.hard_budget_title') || '🛡️ Hard Token Budget Guard with Auto-Scaling'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.hard_budget_desc') || 'Pre-calculates turn costs against a hard financial ceiling, automatically scaling down or halting execution.'
                ),
                currentPreset.hard_budget_guard_enabled && React.createElement(
                  'div',
                  { style: { marginLeft: 22, marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 } },
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('aggregator.hard_budget_limit_label') || 'Max Cost (USD):'),
                    React.createElement('input', {
                      type: 'number',
                      min: 0.001,
                      max: 10,
                      step: 0.005,
                      value: currentPreset.hard_budget_limit_usd ?? 0.02,
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, hard_budget_limit_usd: Number(e.target.value) })),
                      style: { width: 80, padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--dsw-alias-border-primary)' },
                    })
                  ),
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('aggregator.hard_budget_policy_label') || 'Policy:'),
                    React.createElement(
                      'select',
                      {
                        value: currentPreset.hard_budget_policy || 'auto_downgrade',
                        onChange: (e) => updateCurrentPreset((p) => ({ ...p, hard_budget_policy: e.target.value })),
                        style: { padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--dsw-alias-border-primary)' },
                      },
                      React.createElement('option', { value: 'auto_downgrade' }, t('aggregator.hard_budget_policy_downgrade') || 'Auto-Downgrade'),
                      React.createElement('option', { value: 'fail_closed' }, t('aggregator.hard_budget_policy_fail') || 'Fail-Closed')
                    )
                  )
                )
              ),

              /* Human Jury Battle Arena (#294), Block Mixer (#296), Decision Timeline (#320) */
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', { type: 'checkbox', checked: Boolean(currentPreset.blind_arena_enabled), onChange: (e) => updateCurrentPreset((p) => ({ ...p, blind_arena_enabled: e.target.checked, jury_mode: e.target.checked ? 'blind_human' : 'auto' })), style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' } }),
                  t('aggregator.arena_title') || '⚔️ Blind Battle Arena & Human Jury Mode'
                ),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } }, t('aggregator.arena_desc') || 'Anonymizes candidate models as Option A/B/C for blind human voting with local ELO leaderboard ranking.'),
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement('input', { type: 'checkbox', checked: currentPreset.block_mixer_enabled !== false, onChange: (e) => updateCurrentPreset((p) => ({ ...p, block_mixer_enabled: e.target.checked })), style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' } }),
                  t('aggregator.mixer_title') || '🧩 Interactive Drag-and-Drop Block Mixer'
                ),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } }, t('aggregator.mixer_desc') || 'Enables discrete AST/markdown block extraction and manual composition across candidates with judge reconciliation.'),
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement('input', { type: 'checkbox', checked: currentPreset.decision_timeline_enabled !== false, onChange: (e) => updateCurrentPreset((p) => ({ ...p, decision_timeline_enabled: e.target.checked })), style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' } }),
                  t('aggregator.timeline_title') || '⏳ Historical Consensus Decision Timeline & Time-Travel'
                ),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } }, t('aggregator.timeline_desc') || 'Captures granular phase snapshots across debate and synthesis stages with interactive rewind and branch forking.')
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
                renderSlotEditorList({
                  items: currentPreset.aggregator_fallbacks,
                  badgePrefix: 'Fallback',
                  onUpdate: (idx, prov, mod) => {
                    updateCurrentPreset((p) => {
                      const list = [...(p.aggregator_fallbacks || [])]
                      list[idx] = { provider: prov, model: mod }
                      return { ...p, aggregator_fallbacks: list }
                    })
                  },
                  onRemove: (idx) => {
                    updateCurrentPreset((p) => ({
                      ...p,
                      aggregator_fallbacks: (p.aggregator_fallbacks || []).filter((_, i) => i !== idx),
                    }))
                  },
                  onAdd: () => {
                    updateCurrentPreset((p) => ({
                      ...p,
                      aggregator_fallbacks: [...(p.aggregator_fallbacks || []), { provider: (availableModels[0] && availableModels[0].provider) || '', model: (availableModels[0] && availableModels[0].model) || '' }],
                    }))
                  },
                  addLabel: t('aggregator.add_fallback_btn'),
                  emptyWarning: null,
                  availableModels,
                  t,
                })
              )
            )
          )
        ),

