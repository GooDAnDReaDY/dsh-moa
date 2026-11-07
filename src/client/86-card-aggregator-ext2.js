              /* MoA Preset Regression Benchmark (#310) & PR Consensus Bot (#311) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.benchmark_suite_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, benchmark_suite_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.benchmark_title') || '📊 MoA Preset Regression Benchmark Suite'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.benchmark_desc') || 'Calibrates ensemble accuracy, latency, and cost against ground-truth coding puzzles vs single baseline.'
                ),
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.pr_review_bot_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, pr_review_bot_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.pr_review_title') || '🤖 PR & Webhook Consensus Reviewer Bot Mode'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.pr_review_desc') || 'Autonomous multi-model code review for Gitea/GitHub pull requests with de-duplicated blocker detection.'
                )
              ),

              /* Ecosystem Context (#321) & Consensus Knowledge Graph (#322) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: currentPreset.enable_ecosystem_context !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, enable_ecosystem_context: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.ecosystem_title') || '🌐 Context Lens & LLM Wiki Ecosystem Injection'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.ecosystem_desc') || 'Enriches candidate generation with AST symbol graphs and architectural invariants (graceful autonomous fallback).'
                ),
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: currentPreset.sync_with_memory_brain !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, sync_with_memory_brain: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.knowledge_title') || '🧠 Long-Term Consensus Knowledge Graph'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.knowledge_desc') || 'Persists consensus decisions to ~/.dsh/moa/knowledge.json and syncs with dsh-memory-brain to prevent recurring debates.'
                )
              ),

              /* Multi-Column Streaming (#295) & AST Heatmap (#297) */
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', { type: 'checkbox', checked: currentPreset.multi_column_stream_enabled !== false, onChange: (e) => updateCurrentPreset((p) => ({ ...p, multi_column_stream_enabled: e.target.checked })), style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' } }),
                  t('aggregator.multi_stream_title') || '⚡ Multi-Column Live Candidate Streaming'
                ),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } }, t('aggregator.multi_stream_desc') || 'Streams parallel candidate tokens in real-time split columns with TTFT and tok/s speed metrics.'),
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement('input', { type: 'checkbox', checked: currentPreset.ast_heatmap_enabled !== false, onChange: (e) => updateCurrentPreset((p) => ({ ...p, ast_heatmap_enabled: e.target.checked })), style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' } }),
                  t('aggregator.ast_heatmap_title') || '🌈 AST Consensus Heatmap in Code Diff'
                ),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } }, t('aggregator.ast_heatmap_desc') || 'Visualizes line-by-line consensus agreement across models with interactive contested block resolution.')
              ),

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

