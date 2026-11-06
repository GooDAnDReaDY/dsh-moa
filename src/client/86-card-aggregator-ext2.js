              /* Multi-Turn Context & Diff Pruning (#176) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: currentPreset.multi_turn_enabled !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, multi_turn_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.multi_turn_title') || 'Multi-Turn Context & Diff Pruning'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.multi_turn_desc') || 'Retain conversation context across turns while pruning duplicate code blocks.'
                )
              ),

              /* Context Pruning (#305) & Semantic Caching (#318) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: currentPreset.context_pruning_enabled !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, context_pruning_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.context_pruning_title') || '✂️ Cross-Candidate Context Pruning (Diff-Only Judge Context)'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.context_pruning_desc') || 'Replaces unchanged base project files with compact unified diffs (---/+++ hunks) in the Judge prompt, slashing prompt tokens by up to 85%.'
                ),
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 4 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.semantic_cache_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, semantic_cache_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.semantic_cache_title') || '⚡ Semantic Caching for Candidate Generations'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.semantic_cache_desc') || 'Persists intermediate candidate outputs locally by deterministic SHA-256 fingerprint, eliminating duplicate API costs on retry or repeat requests.'
                )
              ),

              /* Self-Consistency Temperature Sampling (#301) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.self_consistency_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, self_consistency_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.self_consistency_title') || '🎲 Self-Consistency Temperature Sampling (Single-Model Diversity)'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.self_consistency_desc') || 'Expands a single reference model into multiple parallel samples with varied temperatures and personas, bringing MoA benefits to single-model setups.'
                ),
                currentPreset.self_consistency_enabled && React.createElement(
                  'div',
                  { style: { marginLeft: 22, marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 } },
                  React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, (t('aggregator.self_consistency_samples') || 'Samples:') + ' ' + (currentPreset.self_consistency_samples || 3)),
                  React.createElement('input', {
                    type: 'range',
                    min: 2,
                    max: 5,
                    value: currentPreset.self_consistency_samples || 3,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, self_consistency_samples: Number(e.target.value) })),
                    style: { width: 100, accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))' },
                  })
                )
              ),

              /* Dynamic Consensus Threshold & Multi-Judge Escalation (#300) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'div',
                  { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } },
                  t('aggregator.escalation_title') || '⚖️ Dynamic Consensus Threshold & Judge Escalation'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
                  t('aggregator.escalation_desc') || 'Detects divergence across candidates. When consensus is weak, automatically upgrades to a senior flagship judge or convenes a 3-judge panel.'
                ),
                React.createElement(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
                  React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('aggregator.escalation_policy') || 'Escalation Policy:'),
                  React.createElement(
                    'select',
                    {
                      value: currentPreset.escalation_policy || 'single',
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, escalation_policy: e.target.value })),
                      style: {
                        padding: '4px 8px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid var(--dsw-alias-border-l2)',
                        background: 'var(--dsw-alias-bg-layer-1)',
                        color: 'var(--dsw-alias-label-primary)',
                      },
                    },
                    React.createElement('option', { value: 'single' }, t('aggregator.escalation_policy_single') || 'Standard Single Judge (No Escalation)'),
                    React.createElement('option', { value: 'auto_upgrade' }, t('aggregator.escalation_policy_upgrade') || 'Auto-Upgrade to Senior Judge on Divergence'),
                    React.createElement('option', { value: 'council_majority' }, t('aggregator.escalation_policy_council') || 'Convene 3-Judge Majority Council on Divergence')
                  )
                ),
                currentPreset.escalation_policy && currentPreset.escalation_policy !== 'single' && React.createElement(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 } },
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 12 } },
                    React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, (t('aggregator.escalation_threshold') || 'Divergence Threshold:') + ' ' + Math.round(((currentPreset.escalation_disagreement_threshold ?? 0.40) * 100)) + '%'),
                    React.createElement('input', {
                      type: 'range',
                      min: 10,
                      max: 90,
                      value: Math.round(((currentPreset.escalation_disagreement_threshold ?? 0.40) * 100)),
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, escalation_disagreement_threshold: Number(e.target.value) / 100 })),
                      style: { width: 120, accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))' },
                    })
                  ),
                  currentPreset.escalation_policy === 'auto_upgrade' && React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('aggregator.escalation_judge_label') || 'Senior Judge:'),
                    React.createElement(
                      'div',
                      { style: { flex: 1, maxWidth: 300 } },
                      React.createElement(SearchableModelPicker, {
                        provider: currentPreset.escalation_judge?.provider || '',
                        model: currentPreset.escalation_judge?.model || '',
                        onChange: (prov, mod) => {
                          updateCurrentPreset((p) => ({
                            ...p,
                            escalation_judge: { provider: prov, model: mod },
                          }))
                        },
                        availableModels,
                        t,
                      })
                    )
                  )
                )
              ),

              /* Stack-Aware Dynamic Persona Evolution (#308) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.stack_aware_personas_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, stack_aware_personas_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.stack_personas_title') || '📦 Stack-Aware Dynamic Persona Evolution (Project Manifests)'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.stack_personas_desc') || 'Scans project manifests (package.json, Cargo.toml, pyproject.toml, go.mod) and assigns specialized engineering roles to candidate slots.'
                )
              ),

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

