              /* Interactive Workbench & File Scoring (#251) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.interactive_workbench_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, interactive_workbench_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.workbench_title') || '🛠️ Interactive Workbench (1-10 File Scoring & Top-Model Glue)'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.workbench_desc') || 'Judge scores each candidate file (1–10). Mix and match candidate files in the UI; the top model harmonizes them into a unified project followed by judge re-audit.'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', marginLeft: 22, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 } },
                  '🔗 ' + (t('aggregator.workbench_companion') || 'Companion Plugin:'),
                  React.createElement(
                    'a',
                    {
                      href: 'https://github.com/goodandready/dsh-time-machine',
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      style: { color: 'var(--dsw-alias-state-brand-primary)', textDecoration: 'underline' },
                    },
                    'dsh-time-machine'
                  ),
                  '(' + (t('aggregator.workbench_companion_note') || 'safe shadow Git checkpoints before file promotion') + ')'
                )
              ),

              /* AST-Level Composite Merge (#248) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.ast_composite_merge_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, ast_composite_merge_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" },
                  }),
                  t("aggregator.ast_merge_title") || "🌳 AST-Level Composite Merge (Semantic Tree Synthesis)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.ast_merge_desc") || "Merge imports, type signatures, JSDoc, and function bodies at the AST declaration level without duplicate import collisions."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 6 } },
                  "🔗 Companion Plugin:",
                  React.createElement(
                    "a",
                    { href: "https://github.com/GooDAnDReaDY/dsh-context-lens", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" } },
                    "@goodandready/dsh-context-lens"
                  )
                )
              ),

              /* Speculative MoA (#247) & Adversarial TDD Loop (#246) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.speculative_moa_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, speculative_moa_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" },
                  }),
                  t("aggregator.speculative_moa_title") || "⚡ Speculative MoA (Fast Draft + Multi-Auditor Diffs)"
                ),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 4 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.adversarial_tdd_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, adversarial_tdd_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" },
                  }),
                  t("aggregator.adversarial_tdd_title") || "🛡️ Adversarial TDD Loop (Auto-Generated Red-Team Unit Tests)"
                )
              ),

              /* Multimodal Visual MoA Consensus (#250) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.visual_moa_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, visual_moa_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" },
                  }),
                  t("aggregator.visual_moa_title") || "👁️ Multimodal Visual MoA Consensus"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.visual_moa_desc") || "Render UI candidates in Live Canvas and evaluate visual layout fidelity via Vision Bridge VLM."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
                  "🔗 Companion Plugins:",
                  React.createElement(
                    "a",
                    { href: "https://github.com/GooDAnDReaDY/dsh-vision-bridge", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" } },
                    "@goodandready/dsh-vision-bridge"
                  ),
                  "/",
                  React.createElement(
                    "a",
                    { href: "https://github.com/GooDAnDReaDY/dsh-live-canvas", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" } },
                    "@goodandready/dsh-live-canvas"
                  )
                )
              ),

              /* Quota-Aware Provider Balancing (#253) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.quota_aware_balancing_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, quota_aware_balancing_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" },
                  }),
                  t("aggregator.quota_balancing_title") || "⚖️ Quota-Aware Provider Balancing"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.quota_balancing_desc") || "Automatically substitute low-quota candidate models in Layer 1 to preserve rate limits for the final aggregator."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
                  "🔗 Companion Plugins:",
                  React.createElement(
                    "a",
                    { href: "https://github.com/GooDAnDReaDY/dsh-key-limits", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" } },
                    "@goodandready/dsh-key-limits"
                  ),
                  "/",
                  React.createElement(
                    "a",
                    { href: "https://github.com/GooDAnDReaDY/dsh-subscriptions", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" } },
                    "@goodandready/dsh-subscriptions"
                  )
                )
              ),

              /* Self-Healing Post-Promotion Build Loop (#252) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.self_healing_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, self_healing_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" },
                  }),
                  t("aggregator.self_healing_title") || "🩺 Self-Healing Post-Promotion Build Loop"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.self_healing_desc") || "Verify promoted files with a test command, request hotfix patches from the aggregator on failure, or auto-rollback to the Time Machine checkpoint."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 6 } },
                  "🔗 Companion Plugin:",
                  React.createElement(
                    "a",
                    { href: "https://github.com/GooDAnDReaDY/dsh-time-machine", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" } },
                    "@goodandready/dsh-time-machine"
                  )
                )
              ),

              /* Graceful Degradation & Local Fallback (#175, #176) */
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
                  t('aggregator.local_fallback_title') || 'Graceful Degradation & Local Fallback'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.local_fallback_desc') || 'Automatically fall back to local Ollama / MiniPC models when online candidate APIs fail.'
                ),
                currentPreset.local_fallback_enabled && React.createElement(
                  'div',
                  { style: { marginLeft: 22, marginTop: 4 } },
                  renderSlotEditorList({
                    items: currentPreset.local_fallback_models,
                    badgePrefix: 'Local',
                    onUpdate: (idx, prov, mod) => {
                      updateCurrentPreset((p) => {
                        const list = [...(p.local_fallback_models || [])]
                        list[idx] = { provider: prov, model: mod }
                        return { ...p, local_fallback_models: list }
                      })
                    },
                    onRemove: (idx) => {
                      updateCurrentPreset((p) => ({
                        ...p,
                        local_fallback_models: (p.local_fallback_models || []).filter((_, i) => i !== idx),
                      }))
                    },
                    onAdd: () => {
                      updateCurrentPreset((p) => ({
                        ...p,
                        local_fallback_models: [...(p.local_fallback_models || []), { provider: 'ollama', model: '' }],
                      }))
                    },
                    addLabel: t('aggregator.add_local_btn') || '+ Add Local Model',
                    emptyWarning: (!currentPreset.local_fallback_models || currentPreset.local_fallback_models.length === 0)
                      ? (t('aggregator.local_models_empty') || 'Configure at least one local fallback model (e.g. Ollama).')
                      : null,
                    availableModels,
                    t,
                  })
                )
              ),

              /* Smart Prompt Routing (#176) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.smart_routing_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, smart_routing_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('config.smart_routing_title') || 'Smart Prompt Routing'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('config.smart_routing_desc') || 'Analyze task complexity and automatically select the optimal preset.'
                ),
                currentPreset.smart_routing_enabled && React.createElement(
                  'div',
                  { style: { marginLeft: 22, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 } },
                  React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('config.smart_routing_model') || 'Routing Model:'),
                  React.createElement(
                    'div',
                    { style: { flex: 1, maxWidth: 320 } },
                    React.createElement(SearchableModelPicker, {
                      provider: currentPreset.smart_routing_model?.provider || '',
                      model: currentPreset.smart_routing_model?.model || '',
                      onChange: (prov, mod) => {
                        updateCurrentPreset((p) => ({
                          ...p,
                          smart_routing_model: { provider: prov, model: mod },
                        }))
                      },
                      availableModels,
                      t,
                    })
                  )
                )
              ),

              /* Pre-Judge Local Syntax Gate (#303) & Early Semantic Consensus (#299) */
              React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', marginTop: 8 } },
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: currentPreset.local_preflight_check !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, local_preflight_check: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.preflight_syntax_title') || '🔍 Pre-Judge Local Syntax Gate (Zero-Token Linter)'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.preflight_syntax_desc') || 'Validate candidate code syntax locally before judge invocation to filter broken code without token costs.'
                ),
                React.createElement(
                  'label',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 4 } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: Boolean(currentPreset.early_exit_consensus_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, early_exit_consensus_enabled: e.target.checked })),
                    style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                  }),
                  t('aggregator.early_consensus_title') || '⚡ Early Exit upon Semantic Consensus'
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                  t('aggregator.early_consensus_desc') || 'Bypass the expensive judge round when reference models converge on equivalent code solutions.'
                )
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


