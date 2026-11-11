window.__ModuleLoader__.load({
  id: "@goodandready/dsh-moa",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");
    const NS = "dsh-moa";
    const PKG = "@goodandready/dsh-moa";
    const ROW_ID = "dsh-moa";
    const ROW_CONFIG_KEY = PKG + "#" + ROW_ID;
    const TITLE = "Mixture of Agents (MoA)";
    const SUBTITLE = "Ensemble parallel candidate generation with judge synthesis via /moa.";
    let rootCtx = null;
    let ensureZhIfNeeded = null;
    const en = {
      title: "Mixture of Agents (MoA)",
      description: "Ensemble model orchestration: parallel candidate proposals + judge synthesis via /moa <prompt>.",
      "header.title": "Mixture of Agents (MoA) Orchestration",
      "header.sub": "Parallel generation by candidate proposers with final evaluation and code promotion by a leading aggregator/judge. Returns to your session model automatically.",
      "badge.online": "MoA Active",
      "badge.offline": "Host Unreachable",
      "badge.preset": "Preset: {name}",
      "badge.models": "{count} models available",
      "badge.candidates": "{count} proposers",
      "presets.title": "\u{1F4CB} Preset Management",
      "presets.desc": "Select active preset or create custom configurations for specific tasks (e.g. code review, math, quick triage).",
      "presets.active_badge": "Active Default",
      "presets.set_default": "Set as Default",
      "presets.new_btn": "+ New Preset",
      "presets.del_btn": "Delete",
      "presets.del_confirm": 'Are you sure you want to delete preset "{name}"?',
      "presets.create": "Create",
      "presets.cancel": "Cancel",
      "presets.name_placeholder": "New preset name (e.g. fast-audit)",
      "aggregator.title": "\u2696\uFE0F Leading Model / Judge (Synthesis & Audit)",
      "aggregator.desc": "Compares candidate proposals, resolves discrepancies, filters hallucination, and synthesizes final solution.",
      "aggregator.temp_label": "Judge Temperature",
      "aggregator.temp_hint": "Recommended: 0.2 \u2013 0.4 for strict validation and deterministic synthesis.",
      "aggregator.criteria_label": "Judge Evaluation Criteria (Optional):",
      "aggregator.criteria_placeholder": "e.g. Priority: performance, zero external dependencies, robust edge-case handling...",
      "aggregator.questions_label": "Ask clarifying questions on broad tasks (Questionnaire)",
      "aggregator.questions_hint": "When enabled: for short/vague prompts, the judge synthesizes a 2-4 question checklist before code generation.",
      "aggregator.curator_label": "Curator Synthesis & Master Assembler Advice",
      "aggregator.curator_hint": "When enabled: the curator highlights the finest components of each candidate, applies the antipatterns rubric, and advises which agent model should assemble the solution.",
      "aggregator.stream_label": "Live Stream Curator/Judge Thinking",
      "aggregator.stream_hint": "Streams aggregator tokens directly to chat in real time for zero-latency initial response.",
      "aggregator.peer_label": "Consilium: Peer Critique (Round 2)",
      "aggregator.peer_hint": "Candidates critique each other's solutions and refine their code before final judge synthesis.",
      "aggregator.override_label": "Allow Candidate Override Actions",
      "aggregator.override_hint": "Keeps candidate workspaces in .moa to let you apply any candidate files via chat command.",
      "aggregator.test_gate_label": "Test Execution Gate (Automatic Sandbox Testing)",
      "aggregator.test_gate_hint": "Executes test suite inside candidate sandboxes before judge review. Real test results guide winner selection.",
      "aggregator.test_cmd_placeholder": "e.g. npm test or node --test",
      "aggregator.test_timeout_label": "Test timeout (sec):",
      "proposers.role_label": "Persona:",
      "proposers.role_general": "General",
      "proposers.role_minimalist": "Minimalist",
      "proposers.role_robustness": "Robustness",
      "proposers.role_performance": "Performance",
      "proposers.role_tester": "Tester",
      "leaderboard.filter_all": "All Presets",
      "leaderboard.export_csv": "Export CSV",
      "leaderboard.export_json": "Export JSON",
      "aggregator.blind_label": "Blind Review (Anonymize Candidates for Judge)",
      "aggregator.blind_hint": "When enabled: candidate model names and providers are hidden from the judge prompt to prevent family/brand bias.",
      "aggregator.timeout_label": "Judge synthesis timeout (sec):",
      "proposers.timeout_label": "Candidate timeout (sec):",
      "leaderboard.title": "\u{1F3C6} Model Win-Rate Leaderboard",
      "leaderboard.desc": "Performance metrics calculated from recorded MoA run verdicts.",
      "leaderboard.model": "Model",
      "leaderboard.runs": "Runs",
      "leaderboard.wins": "Wins",
      "leaderboard.winrate": "Win Rate",
      "leaderboard.cost": "Avg Cost",
      "leaderboard.empty": "No historical runs recorded yet.",
      "aggregator.fallbacks_title": "Fallback Judges Chain",
      "aggregator.fallbacks_desc": "Sequential backup models invoked automatically if the primary judge experiences rate limits or outages.",
      "aggregator.add_fallback_btn": "+ Add Fallback Judge",
      "proposers.quorum_label": "Quorum Fast-Forward (Straggler Mitigation)",
      "proposers.quorum_hint": "When 67%+ candidates finish, start a grace timer (default: 10s) and proceed without waiting for hanging providers.",
      "proposers.grace_label": "Grace Period (sec):",
      "proposers.title": "\u{1F465} Candidate Models (Proposers)",
      "proposers.desc": "Generate independent solutions in parallel to maximize diversity and solution space coverage.",
      "proposers.parallel_count": "Parallel Proposers",
      "proposers.candidate": "Candidate",
      "proposers.add_btn": "+ Add Candidate Model",
      "proposers.temp_label": "Candidates Temperature",
      "proposers.temp_hint": "Recommended: 0.6 \u2013 0.8 for creative, independent solution exploration.",
      "proposers.temperature_gradient": "Temperature Gradient Exploration (0.2 \u2192 0.9 across candidates)",
      "proposers.candidate_temp_tooltip": "Candidate Temperature (leave empty for default/gradient)",
      "stats.title": "\u{1F4C8} MoA Analytics & Telemetry",
      "stats.desc": "Session telemetry, historical runs, and model win-rate tracking.",
      "stats.total_runs": "Total Runs",
      "stats.avg_cost": "Avg Run Cost",
      "stats.active_models": "Configured Models",
      "stats.preset_count": "Total Presets",
      "picker.select": "Select model\u2026",
      "picker.search_placeholder": "Search model by name or provider\u2026",
      "picker.found": "Found",
      "picker.of": "of",
      "picker.clear": "Clear",
      "picker.none": "No matching models found.",
      "picker.custom": "Use custom: ",
      "actions.save": "Save Configuration",
      "actions.saving": "Saving\u2026",
      "actions.saved": "Configuration saved successfully!",
      "actions.saved_memory_only": "Saved to session memory only (not persisted to disk)",
      "actions.retry": "Reload Configuration",
      "badge.disabled": "MoA Disabled",
      "config.enabled_label": "Enable MoA (slash command and turn routing)",
      "slash.desc": "Run turn with Mixture of Agents ensemble synthesis (/moa [preset] <prompt>)",
      "updater.title": "Plugin Updates",
      "updater.desc": "Check npm registry for new versions and update with one click.",
      "updater.btnCheck": "Check Updates",
      "updater.btnUpdate": "Update to v{version}",
      "updater.checking": "Checking registry...",
      "updater.updating": "Updating plugin...",
      "updater.current": "Current version: v{version}",
      "updater.available": "Update available: v{version}",
      "updater.upToDate": "Up to date",
      "updater.checkFailed": "Registry check failed",
      "diff.title": "Candidate Diff Viewer",
      "diff.desc": "Visually inspect differences between candidate solutions and judge synthesis in the project workspace.",
      "diff.select_from": "Base:",
      "diff.select_to": "Compare with:",
      "diff.select_file": "File:",
      "diff.no_files": "No files found in candidate workspaces (.moa). Run a task with /moa to generate candidate code.",
      "diff.refresh": "Refresh Diff",
      "diff.loading": "Loading differences...",
      "diff.curator": "Curator Synthesis",
      "diff.candidate": "Candidate {num}",
      "diff.empty": "Selected files are identical (zero diff).",
      // Multi-Judge
      "aggregator.multi_judge_title": "Multi-Judge Panel & Consensus Voting",
      "aggregator.multi_judge_desc": "Deploy multiple judge models to score candidates and determine winner via consensus voting.",
      "aggregator.voting_strategy_label": "Voting Strategy:",
      "aggregator.voting_majority": "Majority Vote",
      "aggregator.voting_highest_score": "Highest Score",
      "aggregator.voting_unanimous": "Unanimous",
      "aggregator.judge_models_title": "Judge Panel Models",
      "aggregator.judge_models_desc": "Specify 2 or more judge models for panel consensus.",
      "aggregator.add_judge_btn": "+ Add Judge Model",
      "aggregator.judge_badge": "Judge #{num}",
      "aggregator.judge_models_empty": "At least 2 judge models are required for consensus voting.",
      // Composite
      "aggregator.composite_title": "Composite Hybrid Synthesis (AST / Block Merge)",
      "aggregator.composite_desc": "Synthesize modular code blocks, types, and algorithms from multiple candidates into a unified composite.",
      // Budget
      "aggregator.budget_title": "Cost Budget Guardrails & Auto-Fallback",
      "aggregator.budget_desc": "Cap maximum run cost; auto-trim candidate pool or abort to prevent accidental token spend.",
      "aggregator.budget_max_usd": "Max USD ($):",
      "aggregator.budget_action": "Action:",
      "aggregator.budget_action_trim": "Trim Pool",
      "aggregator.budget_action_abort": "Abort",
      // Reports
      "aggregator.report_title": "Automated Benchmark & Post-Mortem Report",
      "aggregator.report_desc": "Generate downloadable Markdown & JSON reports detailing candidate latency, agreement, test gate, and cost breakdown.",
      // Local Fallback
      "aggregator.local_fallback_title": "Graceful Degradation & Local Fallback",
      "aggregator.local_fallback_desc": "Automatically fall back to local Ollama / MiniPC models when online candidate APIs fail.",
      "aggregator.local_models_title": "Local Fallback Models",
      "aggregator.local_models_desc": "Local offline models used when cloud candidate APIs fail.",
      "aggregator.add_local_btn": "+ Add Local Model",
      "aggregator.local_badge": "Local #{num}",
      "aggregator.local_models_empty": "Configure at least one local fallback model (e.g. Ollama).",
      // Smart Routing Model
      "config.smart_routing_title": "Smart Prompt Routing",
      "config.smart_routing_desc": "Analyze task complexity and automatically select the optimal preset.",
      "config.smart_routing_model": "Routing Model:",
      // Multi-Turn Context
      "aggregator.context_pruning_title": "\u2702\uFE0F Cross-Candidate Context Pruning (Diff-Only Judge Context)",
      "aggregator.context_pruning_desc": "Replaces unchanged base project files with compact unified diffs (---/+++ hunks) in the Judge prompt, slashing prompt tokens by up to 85%.",
      "aggregator.context_pruning_lines": "Context lines around changes:",
      "aggregator.semantic_cache_title": "\u26A1 Semantic Caching for Candidate Generations",
      "aggregator.semantic_cache_desc": "Persists intermediate candidate outputs locally by deterministic SHA-256 fingerprint, eliminating duplicate API costs on retry or repeat requests.",
      "aggregator.semantic_cache_ttl": "Cache TTL (hours):",
      "aggregator.multi_turn_title": "Multi-Turn Context & Diff Pruning",
      "aggregator.multi_turn_desc": "Retain conversation context across turns while pruning duplicate code blocks.",
      // UI States & Errors
      "status.loading": "Loading MoA settings\u2026",
      "status.unavailable": "MoA service temporarily unavailable",
      "status.retry": "Retry",
      "status.error_saving": "Error saving: ",
      "error_boundary.title": "\u26A0\uFE0F MoA UI Error:",
      "error_boundary.retry": "Retry",
      // Diff Viewer
      "diff.select_run": "Run:",
      "diff.latest_run": "Latest / Active Workspace",
      "updater.success": "Successfully updated to v{version}. Restart DSH to apply.",
      // Interactive Workbench (#251)
      "aggregator.workbench_title": "\u{1F6E0}\uFE0F Interactive Workbench (1-10 File Scoring & Top-Model Glue)",
      "aggregator.workbench_desc": "Judge scores each candidate file from 1 to 10 with pros/cons. Select desired files across candidates; top model harmonizes and glues them, followed by final judge audit.",
      "aggregator.workbench_companion": "Companion Plugin:",
      "aggregator.workbench_companion_note": "safe shadow Git checkpoints before file promotion",
      "aggregator.preflight_syntax_title": "\u{1F50D} Pre-Judge Local Syntax Gate (Zero-Token Linter)",
      "aggregator.preflight_syntax_desc": "Validate candidate code syntax locally before judge invocation to filter broken code without token costs.",
      "aggregator.early_consensus_title": "\u26A1 Early Exit upon Semantic Consensus",
      "aggregator.early_consensus_desc": "Bypass the expensive judge round when reference models converge on equivalent code solutions.",
      "workbench.title": "\u{1F6E0}\uFE0F Interactive Synthesis Workbench",
      "workbench.desc": "Inspect candidate file quality scores (1\u201310), mix and match files across proposals, harmonize with top-model glue, and run a final judge audit.",
      "workbench.select_run": "MoA Run:",
      "workbench.latest_run": "Select Run\u2026",
      "workbench.no_runs": "No MoA runs with file candidates recorded yet.",
      "workbench.empty_files": "No candidate files found for this run.",
      "workbench.file_header": "Project File",
      "workbench.candidate_header": "Candidate Versions & Scores (1-10)",
      "workbench.instructions_label": "Harmonization Instructions (Optional):",
      "workbench.instructions_placeholder": "e.g. Ensure all imports match, unify TypeScript types, align function signatures...",
      "workbench.assemble_btn": "\u{1F680} Harmonize & Assemble (Top-Model Glue)",
      "workbench.assembling": "\u23F3 Harmonizing files with Top Model...",
      "workbench.recheck_title": "\u2696\uFE0F Judge Re-Audit Verdict",
      "workbench.audit_passed": "PASSED",
      "workbench.audit_failed": "FAILED",
      "workbench.promote_btn": "Promote Harmonized Files to Workspace",
      "workbench.promoted_ok": "\u2705 Harmonized deliverable promoted to workspace root!",
      "workbench.pros": "Pros:",
      "workbench.cons": "Cons:",
      "aggregator.self_consistency_title": "\u{1F3B2} Self-Consistency Temperature Sampling (Single-Model Diversity)",
      "aggregator.self_consistency_desc": "Expands a single reference model into multiple parallel samples with varied temperatures and personas, bringing MoA benefits to single-model setups.",
      "aggregator.self_consistency_samples": "Samples:",
      "aggregator.escalation_title": "\u2696\uFE0F Dynamic Consensus Threshold & Judge Escalation",
      "aggregator.escalation_desc": "Detects divergence across candidates. When consensus is weak, automatically upgrades to a senior flagship judge or convenes a 3-judge panel.",
      "aggregator.escalation_policy": "Escalation Policy:",
      "aggregator.escalation_policy_single": "Standard Single Judge (No Escalation)",
      "aggregator.escalation_policy_upgrade": "Auto-Upgrade to Senior Judge on Divergence",
      "aggregator.escalation_policy_council": "Convene 3-Judge Majority Council on Divergence",
      "aggregator.escalation_threshold": "Divergence Threshold:",
      "aggregator.escalation_judge_label": "Senior Judge:",
      "aggregator.stack_personas_title": "\u{1F4E6} Stack-Aware Dynamic Persona Evolution (Project Manifests)",
      "aggregator.stack_personas_desc": "Scans project manifests (package.json, Cargo.toml, pyproject.toml, go.mod) and assigns specialized engineering roles to candidate slots.",
      "aggregator.preferences_title": "\u{1F9E0} Developer Coding Principles & Preferences Metaprompt",
      "aggregator.preferences_desc": "Injects learned developer preferences (strict typing, functional immutability, error boundaries) to guide Judge synthesis.",
      "aggregator.security_gate_title": "\u{1F6E1}\uFE0F Adversarial White-Hat Security Fuzzing Gate",
      "aggregator.security_gate_desc": "Red-team security auditor checks candidate proposals for SQLi, XSS, ReDoS, Command Injection and Path Traversal with blocking SECURITY_VETO.",
      "aggregator.cove_gate_title": "\u{1F50D} Chain-of-Verification (CoVe) Fact-Checking Gate",
      "aggregator.cove_gate_desc": "Formulates API existence & method signature verification questions, disqualifying candidates that use hallucinated methods.",
      "aggregator.profiler_gate_title": "\u26A1 Automated Runtime Memory & CPU Profiler Gate",
      "aggregator.profiler_gate_desc": "Runs isolated micro-benchmarks measuring execution latency, throughput (ops/sec), and heap memory usage.",
      "aggregator.mutation_gate_title": "\u{1F9EC} Runtime Mutation Testing Gate for Candidate Tests",
      "aggregator.mutation_gate_desc": "Injects synthetic faults into candidate code to test test-suite robustness, eliminating tautological and weak tests.",
      "aggregator.privacy_gate_title": "\u{1F6E1}\uFE0F Hybrid Private Edge MoA (Local Edge Proposers + Cloud Judge)",
      "aggregator.privacy_gate_desc": "Scans and redacts proprietary secrets, local paths, and private network IPs before forwarding proposals to external cloud judges.",
      "aggregator.speculative_gate_title": "\u26A1 Heterogeneous Speculative Decoding (Local Draft + Cloud Verifier)",
      "aggregator.speculative_gate_desc": "Lightweight local edge model generates high-speed token drafts verified and completed in one fast pass by the cloud model.",
      "aggregator.pareto_slider_title": "\u{1F4C8} Cost vs Quality Pareto Frontier Slider",
      "aggregator.pareto_slider_desc": "Reactive balance from 100% free local edge models to ultra-rigorous flagship multi-judge consensus.",
      "aggregator.pareto_pos_label": "Frontier Position:",
      "aggregator.hard_budget_title": "\u{1F6E1}\uFE0F Hard Token Budget Guard with Auto-Scaling",
      "aggregator.hard_budget_desc": "Pre-calculates turn costs against a hard financial ceiling, automatically scaling down or halting execution.",
      "aggregator.hard_budget_limit_label": "Max Cost Per Turn (USD):",
      "aggregator.hard_budget_policy_label": "Exceed Policy:",
      "aggregator.hard_budget_policy_downgrade": "Auto-Downgrade to Local/Economic",
      "aggregator.hard_budget_policy_fail": "Fail-Closed (Halt Execution)",
      "aggregator.rebuttal_debate_title": "\u{1F5E3}\uFE0F Multi-Round Rebuttal Debate",
      "aggregator.rebuttal_debate_desc": "Candidates cross-examine peer solutions and expose flaws before judge arbitration.",
      "aggregator.rebuttal_rounds_label": "Debate Rounds:",
      "aggregator.embedding_clustering_title": "\u{1F9ED} Blind Embedding Clustering",
      "aggregator.embedding_clustering_desc": "Bypass LLM Judge when candidate embeddings converge into a dominant cluster (>= threshold).",
      "aggregator.embedding_threshold_label": "Consensus Similarity Threshold:",
      "aggregator.fallback_to_judge_label": "Fallback to Judge if Opinion Splits",
      "aggregator.git_tournament_title": "\u{1F3C6} Multi-Branch Git Sandbox Tournament",
      "aggregator.git_tournament_desc": "Executes candidate proposals in isolated Git worktrees and runs real project tests (npm test, pytest).",
      "aggregator.git_tournament_cmd_label": "Test Command:",
      "aggregator.council_arbitration_title": "\u{1F3DB}\uFE0F Multi-Persona Role-Playing Council Arbitration",
      "aggregator.council_arbitration_desc": "Replaces single-judge bias with a 3-expert jury: Systems Architect, Security Auditor, and Pragmatic Minimalist.",
      "aggregator.council_weights_label": "Council Weights (Arch / Sec / Min):",
      "aggregator.benchmark_title": "\u{1F4CA} MoA Preset Regression Benchmark Suite",
      "aggregator.benchmark_desc": "Calibrates ensemble accuracy, latency, and cost against ground-truth coding puzzles vs single baseline.",
      "aggregator.pr_review_title": "\u{1F916} PR & Webhook Consensus Reviewer Bot Mode",
      "aggregator.pr_review_desc": "Autonomous multi-model code review for Gitea/GitHub pull requests with de-duplicated blocker detection.",
      "aggregator.ecosystem_title": "\u{1F310} Context Lens & LLM Wiki Ecosystem Injection",
      "aggregator.ecosystem_desc": "Enriches candidate generation with AST symbol graphs and architectural invariants (graceful autonomous fallback).",
      "aggregator.knowledge_title": "\u{1F9E0} Long-Term Consensus Knowledge Graph",
      "aggregator.knowledge_desc": "Persists consensus decisions to ~/.dsh/moa/knowledge.json and syncs with dsh-memory-brain to prevent recurring debates.",
      "aggregator.multi_stream_title": "\u26A1 Multi-Column Live Candidate Streaming",
      "aggregator.multi_stream_desc": "Streams parallel candidate tokens in real-time split columns with TTFT and tok/s speed metrics.",
      "aggregator.ast_heatmap_title": "\u{1F308} AST Consensus Heatmap in Code Diff",
      "aggregator.ast_heatmap_desc": "Visualizes line-by-line consensus agreement across models with interactive contested block resolution.",
      "aggregator.arena_title": "\u2694\uFE0F Blind Battle Arena & Human Jury Mode",
      "aggregator.arena_desc": "Anonymizes candidate models as Option A/B/C for blind human voting with local ELO leaderboard ranking.",
      "aggregator.mixer_title": "\u{1F9E9} Interactive Drag-and-Drop Block Mixer",
      "aggregator.mixer_desc": "Enables discrete AST/markdown block extraction and manual composition across candidates with judge reconciliation.",
      "aggregator.timeline_title": "\u23F3 Historical Consensus Decision Timeline & Time-Travel",
      "aggregator.timeline_desc": "Captures granular phase snapshots across debate and synthesis stages with interactive rewind and branch forking."
    };
    function makeT(dict, fallback) {
      return function t(key, vars) {
        let val = dict && dict[key] || fallback && fallback[key] || key;
        if (vars && typeof val === "string") {
          for (const k of Object.keys(vars)) {
            val = val.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
          }
        }
        return val;
      };
    }
    function FallbackChevron({ className, style }) {
      return React.createElement(
        "svg",
        {
          width: 14,
          height: 14,
          viewBox: "0 0 14 14",
          fill: "none",
          "aria-hidden": true,
          className,
          style
        },
        React.createElement("path", {
          d: "M3.5 5.25L7 8.75L10.5 5.25",
          stroke: "currentColor",
          strokeWidth: 1.5,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        })
      );
    }
    let Chevron = FallbackChevron;
    try {
      const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
      if (primitives && typeof primitives.IconChevronDownOutline14 === "function") {
        Chevron = primitives.IconChevronDownOutline14;
      }
    } catch (noPrimitives) {
      Chevron = FallbackChevron;
    }
    function renderSlotEditorList({ items, badgePrefix, onUpdate, onAdd, onRemove, addLabel, emptyWarning, availableModels, t }) {
      return React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
        (Array.isArray(items) ? items : []).map(
          (item, idx) => React.createElement(
            "div",
            { key: idx, style: { display: "flex", alignItems: "center", gap: 8 } },
            React.createElement("span", { className: "moa-cand-badge" }, `${badgePrefix} #${idx + 1}`),
            React.createElement(
              "div",
              { style: { flex: 1 } },
              React.createElement(SearchableModelPicker, {
                provider: item && item.provider || "",
                model: item && item.model || "",
                onChange: (prov, mod) => onUpdate(idx, prov, mod),
                availableModels,
                t
              })
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "moa-btn moa-btn-danger moa-btn-sub",
                onClick: () => onRemove(idx)
              },
              "\u2715"
            )
          )
        ),
        React.createElement(
          "button",
          {
            type: "button",
            className: "moa-btn moa-btn-sub",
            style: { marginTop: 4, alignSelf: "flex-start" },
            onClick: onAdd
          },
          addLabel
        ),
        emptyWarning ? React.createElement(
          "div",
          { style: { fontSize: 11, color: "var(--dsw-alias-state-warning-primary)", marginTop: 2 } },
          emptyWarning
        ) : null
      );
    }
    function lazyPanel(name) {
      if (typeof React.lazy !== "function" || !React.Suspense) {
        return function UnavailableLazyPanel() {
          return null;
        };
      }
      const Component = React.lazy(() => {
        if (typeof require !== "function" || typeof require.async !== "function") {
          return Promise.resolve({ default: () => null });
        }
        return require.async("./client.panels.js").then((mod) => ({
          default: mod && mod[name] || (() => null)
        }));
      });
      return function LazyPanel(props) {
        return React.createElement(React.Suspense, { fallback: null }, React.createElement(Component, props));
      };
    }
    const CandidateDiffSection = lazyPanel("CandidateDiffSection");
    const InteractiveWorkbenchSection = lazyPanel("InteractiveWorkbenchSection");
    const STYLES = `
/* dsh-moa modern clinebot-aligned styling */
.moa-page{display:flex;flex-direction:column;gap:18px;padding:4px 0 24px;max-width:960px}
.moa-header{display:flex;flex-direction:column;gap:8px;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.moa-page-title{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.moa-page-sub{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5}

.moa-badge-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:2px}
.moa-badge{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:5px;font-weight:500}
.moa-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)}
.moa-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:color-mix(in srgb, var(--dsw-alias-state-warning-primary) 10%, transparent)}
.moa-badge-brand{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}

.moa-section-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.moa-section-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.moa-section-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-6px;line-height:1.4}

.moa-grid-2{display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px}
.moa-stat-box{padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:4px}
.moa-stat-val{font-size:18px;font-weight:700;color:var(--dsw-alias-label-primary)}
.moa-stat-lbl{font-size:12px;color:var(--dsw-alias-label-secondary)}

.moa-input{height:36px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;width:100%;box-sizing:border-box}
.moa-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))}
.moa-textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;resize:vertical;outline:none;line-height:1.4}
.moa-textarea:focus{border-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))}

.moa-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 14px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}
.moa-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-1));border-color:var(--dsw-alias-label-secondary)}
.moa-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.moa-btn-primary:hover:not(:disabled){background:var(--dsw-alias-label-primary) !important;color:var(--dsw-alias-bg-layer-3) !important;opacity:0.9}
.moa-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, transparent)}
.moa-btn-danger:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent) !important;border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 50%, transparent)}
.moa-btn-sub{padding:5px 12px;font-size:12px;border-radius:6px}

/* Segmented Buttons */
.moa-seg-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.moa-seg-btn{appearance:none;font:inherit;padding:6px 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s ease}
.moa-seg-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-secondary)}
.moa-seg-btn-active{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent;font-weight:600}
.moa-seg-btn-active:hover{background:var(--dsw-alias-label-primary) !important;color:var(--dsw-alias-bg-layer-3) !important}

/* Sliders */
.moa-slider-row{display:flex;align-items:center;gap:14px}
.moa-slider{flex:1;accent-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary));cursor:pointer;height:6px}
.moa-slider-badge{min-width:48px;height:30px;padding:0 8px;display:flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:6px;font-size:13px;font-weight:700;color:var(--dsw-alias-label-primary)}

/* Candidate Rows */
.moa-cand-list{display:flex;flex-direction:column;gap:10px}
.moa-cand-row{display:flex;align-items:center;gap:10px}
.moa-cand-badge{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);min-width:92px;flex-shrink:0}
.moa-cand-picker{flex:1;min-width:0}

/* Searchable Model Picker */
.moa-picker-container{position:relative;width:100%}
.moa-picker-btn{width:100%;min-height:38px;padding:6px 12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:13px;text-align:left;box-sizing:border-box;gap:8px}
.moa-picker-btn:hover{border-color:var(--dsw-alias-label-secondary)}
.moa-picker-summary{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.moa-prov-chip{font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);flex-shrink:0}
.moa-model-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.moa-picker-popover{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:0 12px 36px color-mix(in srgb, var(--dsw-alias-label-tertiary) 45%, transparent);z-index:1000;max-height:360px;display:flex;flex-direction:column;overflow:hidden}
.moa-picker-search-bar{padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:4px}
.moa-search-input{width:100%;height:32px;padding:0 10px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:13px;outline:none;box-sizing:border-box}
.moa-search-input:focus{border-color:var(--dsw-alias-label-primary)}
.moa-search-info{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:0 2px;display:flex;justify-content:space-between}
.moa-picker-list{overflow-y:auto;max-height:280px;padding:6px;display:flex;flex-direction:column;gap:2px}
.moa-group-title{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:8px 8px 4px}
.moa-picker-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:6px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;border:none;background:transparent;width:100%;gap:8px}
.moa-picker-item:hover, .moa-picker-item-selected{background:var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2))}
.moa-picker-check{color:var(--dsw-alias-state-success-primary);font-weight:bold;font-size:14px;flex-shrink:0}
.moa-custom-opt{padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);font-size:12px;color:var(--dsw-alias-label-primary);cursor:pointer;display:flex;align-items:center;gap:6px}

/* Alerts & Collapsible Card */
.moa-alert-ok{padding:10px 14px;border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent);color:var(--dsw-alias-state-success-primary);font-size:13px;font-weight:500}
.moa-alert-err{padding:10px 14px;border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);color:var(--dsw-alias-state-error-primary);font-size:13px;font-weight:500}
.moa-card{list-style:none;margin:0;padding:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;overflow:hidden;transition:border-color .15s ease}
.moa-head{width:100%;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:transparent;border:none;color:inherit;cursor:pointer;text-align:left}
.moa-head:hover{background:var(--dsw-alias-bg-layer-2)}
.moa-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.moa-sub{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.moa-chev{transition:transform .2s ease;color:var(--dsw-alias-label-secondary)}
.moa-chev-open{transform:rotate(180deg)}
.moa-body{padding:0 18px 20px;border-top:1px solid var(--dsw-alias-border-l2)}
/* Candidate Diff Viewer */
.moa-diff-container{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.moa-diff-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.moa-diff-select{height:32px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;outline:none}
.moa-diff-box{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 0;font-family:monospace, ui-monospace, Menlo, Consolas, monospace;font-size:12px;line-height:1.5;max-height:400px;overflow-y:auto;overflow-x:auto}
.moa-diff-line{display:flex;padding:1px 10px;white-space:pre}
.moa-diff-line-same{color:var(--dsw-alias-label-secondary)}
.moa-diff-line-add{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent);color:var(--dsw-alias-state-success-primary)}
.moa-diff-line-del{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);color:var(--dsw-alias-state-error-primary)}
.moa-diff-prefix{width:20px;user-select:none;flex-shrink:0;font-weight:bold}
.moa-diff-content{flex:1}
.moa-diff-stat-add{color:var(--dsw-alias-state-success-primary);font-weight:600}
.moa-diff-stat-del{color:var(--dsw-alias-state-error-primary);font-weight:600}

`;
    let stylesInjected = false;
    function ensureStyles() {
      if (stylesInjected || typeof document === "undefined") return;
      stylesInjected = true;
      const style = document.createElement("style");
      style.id = "dsh-moa-full-css";
      if (style.dataset) {
        style.dataset.dshPlugin = NS;
      } else if (typeof style.setAttribute === "function") {
        style.setAttribute("data-dsh-plugin", NS);
      }
      style.textContent = STYLES;
      document.head.appendChild(style);
    }
    const PROVIDER_TITLES = {
      deepseek: "DeepSeek",
      openai: "OpenAI",
      anthropic: "Anthropic Claude",
      claude: "Claude (Anthropic)",
      google: "Google Gemini",
      gemini: "Google Gemini",
      groq: "Groq Cloud",
      ollama: "Ollama (Local / Cloud)",
      openrouter: "OpenRouter",
      qwen: "Qwen",
      zai: "Zhipu GLM",
      minimax: "MiniMax",
      mistral: "Mistral AI",
      "deepseek-official": "DeepSeek Official"
    };
    function SearchableModelPicker({
      provider,
      model,
      onChange,
      availableModels = [],
      t
    }) {
      const [open, setOpen] = React.useState(false);
      const [query, setQuery] = React.useState("");
      const rootRef = React.useRef(null);
      const inputRef = React.useRef(null);
      const selectedLabel = React.useMemo(() => {
        if (!provider && !model) return t("picker.select");
        const found = availableModels.find((m) => m.provider === provider && m.model === model);
        return found ? found.label || `${provider}: ${found.model}` : `${provider}:${model}`;
      }, [availableModels, provider, model, t]);
      const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return availableModels;
        return availableModels.filter((m) => {
          const prov = (m.provider || "").toLowerCase();
          const mod = (m.model || "").toLowerCase();
          const lbl = (m.label || "").toLowerCase();
          return prov.includes(q) || mod.includes(q) || lbl.includes(q);
        });
      }, [availableModels, query]);
      const grouped = React.useMemo(() => {
        const map = /* @__PURE__ */ new Map();
        for (const m of filtered) {
          const p = m.provider || "other";
          if (!map.has(p)) map.set(p, []);
          map.get(p).push(m);
        }
        const groups = [];
        for (const [prov, items] of map.entries()) {
          const title = PROVIDER_TITLES[prov] || prov.toUpperCase();
          groups.push({ provider: prov, title, items });
        }
        return groups;
      }, [filtered]);
      React.useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
          if (rootRef.current && !rootRef.current.contains(e.target)) {
            setOpen(false);
          }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
      }, [open]);
      React.useEffect(() => {
        if (open && inputRef.current) {
          inputRef.current.focus();
        }
      }, [open]);
      const handleSelect = (item) => {
        onChange(item.provider, item.model);
        setOpen(false);
        setQuery("");
      };
      const handleCustom = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        let prov = provider || "custom";
        let mod = trimmed;
        if (trimmed.includes(":")) {
          const [p, ...rest] = trimmed.split(":");
          prov = p.trim();
          mod = rest.join(":").trim();
        }
        onChange(prov, mod);
        setOpen(false);
        setQuery("");
      };
      return React.createElement(
        "div",
        { className: "moa-picker-container", ref: rootRef },
        React.createElement(
          "button",
          {
            type: "button",
            className: "moa-picker-btn",
            onClick: () => setOpen(!open)
          },
          React.createElement(
            "div",
            { className: "moa-picker-summary" },
            provider && React.createElement("span", { className: "moa-prov-chip" }, provider),
            React.createElement("span", { className: "moa-model-name" }, selectedLabel)
          ),
          React.createElement(Chevron, { style: { transform: open ? "rotate(180deg)" : "none" } })
        ),
        open && React.createElement(
          "div",
          { className: "moa-picker-popover" },
          React.createElement(
            "div",
            { className: "moa-picker-search-bar" },
            React.createElement("input", {
              ref: inputRef,
              type: "text",
              className: "moa-search-input",
              placeholder: t("picker.search_placeholder"),
              value: query,
              onChange: (e) => setQuery(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && query.trim()) handleCustom();
              }
            }),
            React.createElement(
              "div",
              { className: "moa-search-info" },
              React.createElement(
                "span",
                null,
                `${t("picker.found")}: ${filtered.length} ${t("picker.of")} ${availableModels.length}`
              ),
              query && React.createElement(
                "span",
                { style: { cursor: "pointer", textDecoration: "underline" }, onClick: () => setQuery("") },
                t("picker.clear")
              )
            )
          ),
          React.createElement(
            "div",
            { className: "moa-picker-list" },
            grouped.map(
              (g) => React.createElement(
                React.Fragment,
                { key: g.provider },
                React.createElement("div", { className: "moa-group-title" }, g.title),
                g.items.map((item) => {
                  const isCur = item.provider === provider && item.model === model;
                  return React.createElement(
                    "button",
                    {
                      key: `${item.provider}:${item.model}`,
                      type: "button",
                      className: isCur ? "moa-picker-item moa-picker-item-selected" : "moa-picker-item",
                      onClick: () => handleSelect(item)
                    },
                    React.createElement(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 } },
                      React.createElement("span", { className: "moa-prov-chip" }, item.provider),
                      React.createElement("span", { className: "moa-model-name" }, item.label || item.model)
                    ),
                    isCur && React.createElement("span", { className: "moa-picker-check" }, "\u2713")
                  );
                })
              )
            ),
            filtered.length === 0 && React.createElement(
              "div",
              { style: { padding: "12px 10px", fontSize: 13, color: "var(--dsw-alias-label-secondary)" } },
              t("picker.none")
            )
          ),
          query.trim() && React.createElement(
            "div",
            { className: "moa-custom-opt", onClick: handleCustom },
            React.createElement("span", null, "\u2795"),
            React.createElement(
              "span",
              null,
              `${t("picker.custom")}"${query.trim()}"`
            )
          )
        )
      );
    }
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
      leaderboardPresetFilter = "all",
      setLeaderboardPresetFilter = () => {
      },
      handleSave,
      saveStatus,
      reload,
      updateState,
      checkUpdates,
      runUpdate
    }) {
      const [selectedPresetName, setSelectedPresetName] = React.useState(defaultPreset || presets[0] && presets[0].name || "default");
      const [isCreating, setIsCreating] = React.useState(false);
      const [newPresetName, setNewPresetName] = React.useState("");
      React.useEffect(() => {
        if (!presets.some((p) => p.name === selectedPresetName)) {
          setSelectedPresetName(defaultPreset || presets[0] && presets[0].name || "default");
        }
      }, [presets, selectedPresetName, defaultPreset]);
      const currentPreset = presets.find((p) => p.name === selectedPresetName) || presets[0] || {
        name: "default",
        reference_models: [],
        aggregator: { provider: availableModels[0] && availableModels[0].provider || "", model: availableModels[0] && availableModels[0].model || "" },
        aggregator_temperature: 0.4,
        reference_temperature: 0.6,
        judge_criteria: "",
        ask_clarifying_questions: true
      };
      const updateCurrentPreset = (modifier) => {
        setPresets((prev) => {
          const copy = structuredClone(prev || []);
          const idx = copy.findIndex((p) => p.name === currentPreset.name);
          if (idx !== -1) {
            copy[idx] = modifier(copy[idx]);
          }
          return copy;
        });
      };
      const setAggregatorModel = (prov, mod) => {
        updateCurrentPreset((p) => ({ ...p, aggregator: { provider: prov, model: mod } }));
      };
      const setAggregatorTemp = (temp) => {
        const val = Math.round(Number(temp) * 100) / 100;
        updateCurrentPreset((p) => ({ ...p, aggregator_temperature: val }));
      };
      const setReferenceTemp = (temp) => {
        const val = Math.round(Number(temp) * 100) / 100;
        updateCurrentPreset((p) => ({ ...p, reference_temperature: val }));
      };
      const setJudgeCriteria = (criteria) => {
        updateCurrentPreset((p) => ({ ...p, judge_criteria: criteria }));
      };
      const setReferenceModel = (idx, prov, mod) => {
        updateCurrentPreset((p) => {
          const refs = [...p.reference_models || []];
          refs[idx] = { provider: prov, model: mod };
          return { ...p, reference_models: refs };
        });
      };
      const setReferenceCount = (targetCount) => {
        updateCurrentPreset((p) => {
          let refs = [...p.reference_models || []];
          if (refs.length > targetCount) {
            refs = refs.slice(0, targetCount);
          } else {
            while (refs.length < targetCount) {
              const fallback = availableModels[refs.length % (availableModels.length || 1)] || {
                provider: "",
                model: ""
              };
              refs.push({ provider: fallback.provider, model: fallback.model });
            }
          }
          return { ...p, reference_models: refs };
        });
      };
      const removeReference = (idx) => {
        updateCurrentPreset((p) => {
          const refs = [...p.reference_models || []];
          refs.splice(idx, 1);
          return { ...p, reference_models: refs };
        });
      };
      const addReference = () => {
        updateCurrentPreset((p) => {
          const refs = [...p.reference_models || []];
          const fallback = availableModels[refs.length % (availableModels.length || 1)] || {
            provider: "",
            model: ""
          };
          refs.push({ provider: fallback.provider, model: fallback.model, role_persona: "general" });
          return { ...p, reference_models: refs };
        });
      };
      const handleCreatePreset = () => {
        const name = newPresetName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        if (!name) return;
        if (presets.some((p) => p.name === name)) {
          setSelectedPresetName(name);
          setIsCreating(false);
          setNewPresetName("");
          return;
        }
        const created = {
          name,
          enabled: true,
          ask_clarifying_questions: true,
          reference_models: currentPreset?.reference_models?.length ? structuredClone(currentPreset.reference_models) : availableModels.length >= 2 ? [
            { provider: availableModels[0].provider, model: availableModels[0].model, role_persona: "general" },
            { provider: availableModels[1].provider, model: availableModels[1].model, role_persona: "general" }
          ] : [
            { provider: "", model: "", role_persona: "general" },
            { provider: "", model: "", role_persona: "general" }
          ],
          aggregator: currentPreset?.aggregator?.provider ? structuredClone(currentPreset.aggregator) : {
            provider: availableModels[0] && availableModels[0].provider || "",
            model: availableModels[0] && availableModels[0].model || ""
          },
          reference_temperature: 0.6,
          aggregator_temperature: 0.4,
          max_tokens: 4096,
          judge_criteria: ""
        };
        setPresets((prev) => [...prev || [], created]);
        setSelectedPresetName(name);
        setIsCreating(false);
        setNewPresetName("");
      };
      const handleDeletePreset = (nameToDelete) => {
        if (presets.length <= 1) return;
        if (typeof window !== "undefined" && window.confirm) {
          if (!window.confirm(t("presets.del_confirm", { name: nameToDelete }))) return;
        }
        setPresets((prev) => prev.filter((p) => p.name !== nameToDelete));
        if (defaultPreset === nameToDelete) {
          const nextDefault = presets.find((p) => p.name !== nameToDelete)?.name || "default";
          setDefaultPreset(nextDefault);
        }
      };
      const aggTemp = currentPreset.aggregator_temperature !== void 0 ? currentPreset.aggregator_temperature : 0.4;
      const refTemp = currentPreset.reference_temperature !== void 0 ? currentPreset.reference_temperature : 0.6;
      const currentRefs = currentPreset.reference_models || [];
      const judgeCriteria = currentPreset.judge_criteria || "";
      const isDefault = defaultPreset === currentPreset.name;
      const hostStatusBadge = hostStatus === "online" ? React.createElement("span", { className: "moa-badge moa-badge-ok" }, "\u{1F7E2} " + t("badge.online")) : hostStatus === "disabled" ? React.createElement("span", { className: "moa-badge moa-badge-warn" }, "\u23F8 " + t("badge.disabled")) : React.createElement("span", { className: "moa-badge moa-badge-warn" }, "\u{1F534} " + t("badge.offline"));
      return React.createElement(
        "div",
        { className: "moa-page" },
        /* ── HEADER WITH LIVE STATUS CHIPS ── */
        React.createElement(
          "div",
          { className: "moa-header" },
          React.createElement(
            "div",
            { className: "moa-page-title" },
            React.createElement("span", null, "\u{1F9E0} " + t("header.title")),
            React.createElement(
              "div",
              { className: "moa-badge-row" },
              hostStatusBadge,
              React.createElement("span", { className: "moa-badge moa-badge-brand" }, t("badge.preset", { name: currentPreset.name })),
              React.createElement("span", { className: "moa-badge moa-badge-brand" }, t("badge.models", { count: availableModels.length })),
              React.createElement("span", { className: "moa-badge moa-badge-brand" }, t("badge.candidates", { count: currentRefs.length }))
            )
          ),
          React.createElement("div", { className: "moa-page-sub" }, t("header.sub"))
        ),
        // --- src/client/70-card-presets.js ---
        /* ── SECTION 1: PRESET MANAGEMENT ── */
        React.createElement(
          "div",
          { className: "moa-section-card" },
          React.createElement(
            "div",
            { className: "moa-section-title" },
            React.createElement("span", null, t("presets.title")),
            React.createElement(
              "div",
              { style: { display: "flex", gap: 8, alignItems: "center" } },
              !isDefault && React.createElement(
                "button",
                {
                  type: "button",
                  className: "moa-btn moa-btn-sub",
                  onClick: () => setDefaultPreset(currentPreset.name)
                },
                "\u2605 " + t("presets.set_default")
              ),
              isDefault && React.createElement("span", { className: "moa-badge moa-badge-ok" }, "\u2713 " + t("presets.active_badge")),
              !isCreating && React.createElement(
                "button",
                {
                  type: "button",
                  className: "moa-btn moa-btn-sub",
                  onClick: () => setIsCreating(true)
                },
                t("presets.new_btn")
              )
            )
          ),
          React.createElement("div", { className: "moa-section-desc" }, t("presets.desc")),
          React.createElement(
            "div",
            { className: "moa-seg-group" },
            presets.map((p) => {
              const isCur = p.name === selectedPresetName;
              return React.createElement(
                "button",
                {
                  key: p.name,
                  type: "button",
                  className: isCur ? "moa-seg-btn moa-seg-btn-active" : "moa-seg-btn",
                  onClick: () => setSelectedPresetName(p.name)
                },
                p.name === defaultPreset ? `\u2605 ${p.name}` : p.name
              );
            }),
            presets.length > 1 && React.createElement(
              "button",
              {
                type: "button",
                className: "moa-btn moa-btn-danger moa-btn-sub",
                onClick: () => handleDeletePreset(currentPreset.name),
                title: t("presets.del_btn")
              },
              "\u{1F5D1} " + t("presets.del_btn")
            )
          ),
          isCreating && React.createElement(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 4 } },
            React.createElement("input", {
              type: "text",
              className: "moa-input",
              style: { maxWidth: 320 },
              placeholder: t("presets.name_placeholder"),
              value: newPresetName,
              onChange: (e) => setNewPresetName(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") handleCreatePreset();
                if (e.key === "Escape") setIsCreating(false);
              }
            }),
            React.createElement(
              "button",
              {
                type: "button",
                className: "moa-btn moa-btn-primary",
                onClick: handleCreatePreset
              },
              t("presets.create")
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "moa-btn",
                onClick: () => setIsCreating(false)
              },
              t("presets.cancel")
            )
          )
        ),
        /* ── SECTION 2: AGGREGATOR / JUDGE ── */
        // --- src/client/80-card-aggregator.js ---
        React.createElement(
          "div",
          { className: "moa-section-card" },
          React.createElement(
            "div",
            { className: "moa-section-title" },
            React.createElement("span", null, t("aggregator.title")),
            React.createElement("span", { className: "moa-badge moa-badge-brand" }, `Temp: ${aggTemp}`)
          ),
          React.createElement("div", { className: "moa-section-desc" }, t("aggregator.desc")),
          React.createElement(SearchableModelPicker, {
            provider: currentPreset.aggregator?.provider || "",
            model: currentPreset.aggregator?.model || "",
            onChange: setAggregatorModel,
            availableModels,
            t
          }),
          React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
            React.createElement(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 500 } },
              React.createElement("span", null, t("aggregator.temp_label")),
              React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12 } }, t("aggregator.temp_hint"))
            ),
            React.createElement(
              "div",
              { className: "moa-slider-row" },
              React.createElement("input", {
                type: "range",
                className: "moa-slider",
                min: "0",
                max: "2",
                step: "0.05",
                value: aggTemp,
                onChange: (e) => setAggregatorTemp(e.target.value)
              }),
              React.createElement("div", { className: "moa-slider-badge" }, aggTemp)
            )
          ),
          React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4, borderTop: "1px solid var(--dsw-alias-border-l2)", paddingTop: 10 } },
            React.createElement("label", { style: { fontSize: 13, fontWeight: 500 } }, t("aggregator.criteria_label")),
            React.createElement("textarea", {
              className: "moa-textarea",
              rows: 2,
              placeholder: t("aggregator.criteria_placeholder"),
              value: judgeCriteria,
              onChange: (e) => setJudgeCriteria(e.target.value)
            }),
            React.createElement(
              "div",
              { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 3 } },
              React.createElement(
                "label",
                { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                React.createElement("input", {
                  type: "checkbox",
                  checked: currentPreset.ask_clarifying_questions !== false,
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, ask_clarifying_questions: e.target.checked })),
                  style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                }),
                t("aggregator.questions_label")
              ),
              React.createElement(
                "div",
                { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                t("aggregator.questions_hint")
              ),
              React.createElement(
                "label",
                { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement("input", {
                  type: "checkbox",
                  checked: Boolean(currentPreset.curator_synthesis),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, curator_synthesis: e.target.checked })),
                  style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                }),
                t("aggregator.curator_label")
              ),
              React.createElement(
                "div",
                { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                t("aggregator.curator_hint")
              ),
              React.createElement(
                "label",
                { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement("input", {
                  type: "checkbox",
                  checked: currentPreset.stream_aggregator !== false,
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, stream_aggregator: e.target.checked })),
                  style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                }),
                t("aggregator.stream_label")
              ),
              React.createElement(
                "div",
                { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                t("aggregator.stream_hint")
              ),
              React.createElement(
                "label",
                { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement("input", {
                  type: "checkbox",
                  checked: Boolean(currentPreset.blind_evaluation),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, blind_evaluation: e.target.checked })),
                  style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                }),
                t("aggregator.blind_label")
              ),
              React.createElement(
                "div",
                { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                t("aggregator.blind_hint")
              ),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 } },
                React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.timeout_label")),
                React.createElement("input", {
                  type: "number",
                  className: "moa-input",
                  style: { width: 80, height: 28, padding: "0 6px", fontSize: 12 },
                  min: 30,
                  max: 600,
                  value: currentPreset.aggregator_timeout_sec ?? 180,
                  onChange: (e) => {
                    const val = parseInt(e.target.value, 10);
                    updateCurrentPreset((p) => ({ ...p, aggregator_timeout_sec: isNaN(val) ? 180 : val }));
                  }
                })
              ),
              React.createElement(
                "label",
                { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement("input", {
                  type: "checkbox",
                  checked: Boolean(currentPreset.peer_critique_enabled),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, peer_critique_enabled: e.target.checked })),
                  style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                }),
                t("aggregator.peer_label")
              ),
              React.createElement(
                "div",
                { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                t("aggregator.peer_hint")
              ),
              React.createElement(
                "label",
                { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement("input", {
                  type: "checkbox",
                  checked: Boolean(currentPreset.allow_candidate_override),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, allow_candidate_override: e.target.checked })),
                  style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                }),
                t("aggregator.override_label")
              ),
              React.createElement(
                "div",
                { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                t("aggregator.override_hint")
              ),
              React.createElement(
                "label",
                { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement("input", {
                  type: "checkbox",
                  checked: Boolean(currentPreset.test_gate_enabled),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, test_gate_enabled: e.target.checked })),
                  style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                }),
                t("aggregator.test_gate_label")
              ),
              React.createElement(
                "div",
                { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                t("aggregator.test_gate_hint")
              ),
              Boolean(currentPreset.test_gate_enabled) && React.createElement(
                "div",
                { style: { marginLeft: 22, marginTop: 6, display: "flex", flexDirection: "column", gap: 6 } },
                React.createElement("input", {
                  type: "text",
                  className: "moa-input",
                  style: { fontSize: 12, height: 28 },
                  placeholder: t("aggregator.test_cmd_placeholder"),
                  value: currentPreset.test_command || "",
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, test_command: e.target.value }))
                }),
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: 8 } },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.test_timeout_label")),
                  React.createElement("input", {
                    type: "number",
                    className: "moa-input",
                    style: { width: 70, height: 26, fontSize: 12 },
                    min: 5,
                    max: 120,
                    value: currentPreset.test_gate_timeout_sec ?? 15,
                    onChange: (e) => {
                      const val = parseInt(e.target.value, 10);
                      updateCurrentPreset((p) => ({ ...p, test_gate_timeout_sec: isNaN(val) ? 15 : val }));
                    }
                  })
                )
              ),
              /* Multi-Judge Panel & Consensus Voting (#175, #176) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.multi_judge_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, multi_judge_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.multi_judge_title") || "Multi-Judge Panel & Consensus Voting"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.multi_judge_desc") || "Deploy multiple judge models to score candidates and determine winner via consensus voting."
                ),
                currentPreset.multi_judge_enabled && React.createElement(
                  "div",
                  { style: { marginLeft: 22, display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.voting_strategy_label") || "Voting Strategy:"),
                    React.createElement(
                      "select",
                      {
                        className: "moa-select",
                        style: { width: 140, height: 28, fontSize: 12, padding: "0 6px" },
                        value: currentPreset.judge_voting_strategy || "majority",
                        onChange: (e) => updateCurrentPreset((p) => ({ ...p, judge_voting_strategy: e.target.value }))
                      },
                      React.createElement("option", { value: "majority" }, t("aggregator.voting_majority") || "Majority Vote"),
                      React.createElement("option", { value: "highest_score" }, t("aggregator.voting_highest_score") || "Highest Score"),
                      React.createElement("option", { value: "unanimous" }, t("aggregator.voting_unanimous") || "Unanimous")
                    )
                  ),
                  renderSlotEditorList({
                    items: currentPreset.judge_models,
                    badgePrefix: "Judge",
                    onUpdate: (idx, prov, mod) => {
                      updateCurrentPreset((p) => {
                        const list = [...p.judge_models || []];
                        list[idx] = { provider: prov, model: mod };
                        return { ...p, judge_models: list };
                      });
                    },
                    onRemove: (idx) => {
                      updateCurrentPreset((p) => ({
                        ...p,
                        judge_models: (p.judge_models || []).filter((_, i) => i !== idx)
                      }));
                    },
                    onAdd: () => {
                      updateCurrentPreset((p) => ({
                        ...p,
                        judge_models: [...p.judge_models || [], { provider: availableModels[0] && availableModels[0].provider || "", model: availableModels[0] && availableModels[0].model || "" }]
                      }));
                    },
                    addLabel: t("aggregator.add_judge_btn") || "+ Add Judge Model",
                    emptyWarning: !currentPreset.judge_models || currentPreset.judge_models.length < 2 ? t("aggregator.judge_models_empty") || "At least 2 judge models are required for consensus voting." : null,
                    availableModels,
                    t
                  })
                )
              ),
              /* Composite Hybrid Synthesis (AST / Block Merge) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.composite_merge_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, composite_merge_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.composite_title") || "Composite Hybrid Synthesis (AST / Block Merge)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.composite_desc") || "Synthesize modular code blocks, types, and algorithms from multiple candidates into a unified composite."
                )
              ),
              /* Cost Budget Guardrails & Auto-Fallback */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.budget_guard_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, budget_guard_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.budget_title") || "Cost Budget Guardrails & Auto-Fallback"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.budget_desc") || "Cap maximum run cost; auto-trim candidate pool or abort to prevent accidental token spend."
                ),
                currentPreset.budget_guard_enabled && React.createElement(
                  "div",
                  { style: { marginLeft: 22, display: "flex", alignItems: "center", gap: 12, marginTop: 4 } },
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 6 } },
                    React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.budget_max_usd") || "Max USD ($):"),
                    React.createElement("input", {
                      type: "number",
                      step: "0.01",
                      className: "moa-input",
                      style: { width: 80, height: 28, padding: "0 6px", fontSize: 12 },
                      value: currentPreset.max_budget_usd ?? 0.1,
                      onChange: (e) => {
                        const val = parseFloat(e.target.value);
                        updateCurrentPreset((p) => ({ ...p, max_budget_usd: isNaN(val) ? 0 : val }));
                      }
                    })
                  ),
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 6 } },
                    React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.budget_action") || "Action:"),
                    React.createElement(
                      "select",
                      {
                        className: "moa-select",
                        style: { width: 100, height: 28, fontSize: 12, padding: "0 6px" },
                        value: currentPreset.budget_action || "trim",
                        onChange: (e) => updateCurrentPreset((p) => ({ ...p, budget_action: e.target.value }))
                      },
                      React.createElement("option", { value: "trim" }, t("aggregator.budget_action_trim") || "Trim Pool"),
                      React.createElement("option", { value: "abort" }, t("aggregator.budget_action_abort") || "Abort")
                    )
                  )
                )
              ),
              /* Automated Benchmark & Post-Mortem Report */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.report_generation_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, report_generation_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.report_title") || "Automated Benchmark & Post-Mortem Report"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.report_desc") || "Generate downloadable Markdown & JSON reports detailing candidate latency, agreement, test gate, and cost breakdown."
                )
              ),
              // --- src/client/85-card-aggregator-ext.js ---
              /* Interactive Workbench & File Scoring (#251) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.interactive_workbench_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, interactive_workbench_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.workbench_title") || "\u{1F6E0}\uFE0F Interactive Workbench (1-10 File Scoring & Top-Model Glue)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.workbench_desc") || "Judge scores each candidate file (1\u201310). Mix and match candidate files in the UI; the top model harmonizes them into a unified project followed by judge re-audit."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 4 } },
                  "\u{1F517} " + (t("aggregator.workbench_companion") || "Companion Plugin:"),
                  React.createElement(
                    "a",
                    {
                      href: "https://github.com/goodandready/dsh-time-machine",
                      target: "_blank",
                      rel: "noopener noreferrer",
                      style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" }
                    },
                    "dsh-time-machine"
                  ),
                  "(" + (t("aggregator.workbench_companion_note") || "safe shadow Git checkpoints before file promotion") + ")"
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
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.ast_merge_title") || "\u{1F333} AST-Level Composite Merge (Semantic Tree Synthesis)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.ast_merge_desc") || "Merge imports, type signatures, JSDoc, and function bodies at the AST declaration level without duplicate import collisions."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 6 } },
                  "\u{1F517} Companion Plugin:",
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
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.speculative_moa_title") || "\u26A1 Speculative MoA (Fast Draft + Multi-Auditor Diffs)"
                ),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 4 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.adversarial_tdd_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, adversarial_tdd_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.adversarial_tdd_title") || "\u{1F6E1}\uFE0F Adversarial TDD Loop (Auto-Generated Red-Team Unit Tests)"
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
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.visual_moa_title") || "\u{1F441}\uFE0F Multimodal Visual MoA Consensus"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.visual_moa_desc") || "Render UI candidates in Live Canvas and evaluate visual layout fidelity via Vision Bridge VLM."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
                  "\u{1F517} Companion Plugins:",
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
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.quota_balancing_title") || "\u2696\uFE0F Quota-Aware Provider Balancing"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.quota_balancing_desc") || "Automatically substitute low-quota candidate models in Layer 1 to preserve rate limits for the final aggregator."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
                  "\u{1F517} Companion Plugins:",
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
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.self_healing_title") || "\u{1FA7A} Self-Healing Post-Promotion Build Loop"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.self_healing_desc") || "Verify promoted files with a test command, request hotfix patches from the aggregator on failure, or auto-rollback to the Time Machine checkpoint."
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary)", marginLeft: 22, marginTop: 2, display: "flex", alignItems: "center", gap: 6 } },
                  "\u{1F517} Companion Plugin:",
                  React.createElement(
                    "a",
                    { href: "https://github.com/GooDAnDReaDY/dsh-time-machine", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" } },
                    "@goodandready/dsh-time-machine"
                  )
                )
              ),
              /* Graceful Degradation & Local Fallback (#175, #176) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.local_fallback_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, local_fallback_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.local_fallback_title") || "Graceful Degradation & Local Fallback"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.local_fallback_desc") || "Automatically fall back to local Ollama / MiniPC models when online candidate APIs fail."
                ),
                currentPreset.local_fallback_enabled && React.createElement(
                  "div",
                  { style: { marginLeft: 22, marginTop: 4 } },
                  renderSlotEditorList({
                    items: currentPreset.local_fallback_models,
                    badgePrefix: "Local",
                    onUpdate: (idx, prov, mod) => {
                      updateCurrentPreset((p) => {
                        const list = [...p.local_fallback_models || []];
                        list[idx] = { provider: prov, model: mod };
                        return { ...p, local_fallback_models: list };
                      });
                    },
                    onRemove: (idx) => {
                      updateCurrentPreset((p) => ({
                        ...p,
                        local_fallback_models: (p.local_fallback_models || []).filter((_, i) => i !== idx)
                      }));
                    },
                    onAdd: () => {
                      updateCurrentPreset((p) => ({
                        ...p,
                        local_fallback_models: [...p.local_fallback_models || [], { provider: "ollama", model: "" }]
                      }));
                    },
                    addLabel: t("aggregator.add_local_btn") || "+ Add Local Model",
                    emptyWarning: !currentPreset.local_fallback_models || currentPreset.local_fallback_models.length === 0 ? t("aggregator.local_models_empty") || "Configure at least one local fallback model (e.g. Ollama)." : null,
                    availableModels,
                    t
                  })
                )
              ),
              /* Smart Prompt Routing (#176) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.smart_routing_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, smart_routing_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("config.smart_routing_title") || "Smart Prompt Routing"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("config.smart_routing_desc") || "Analyze task complexity and automatically select the optimal preset."
                ),
                currentPreset.smart_routing_enabled && React.createElement(
                  "div",
                  { style: { marginLeft: 22, marginTop: 4, display: "flex", alignItems: "center", gap: 8 } },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("config.smart_routing_model") || "Routing Model:"),
                  React.createElement(
                    "div",
                    { style: { flex: 1, maxWidth: 320 } },
                    React.createElement(SearchableModelPicker, {
                      provider: currentPreset.smart_routing_model?.provider || "",
                      model: currentPreset.smart_routing_model?.model || "",
                      onChange: (prov, mod) => {
                        updateCurrentPreset((p) => ({
                          ...p,
                          smart_routing_model: { provider: prov, model: mod }
                        }));
                      },
                      availableModels,
                      t
                    })
                  )
                )
              ),
              /* Pre-Judge Local Syntax Gate (#303) & Early Semantic Consensus (#299) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: currentPreset.local_preflight_check !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, local_preflight_check: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.preflight_syntax_title") || "\u{1F50D} Pre-Judge Local Syntax Gate (Zero-Token Linter)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.preflight_syntax_desc") || "Validate candidate code syntax locally before judge invocation to filter broken code without token costs."
                ),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 4 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.early_exit_consensus_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, early_exit_consensus_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.early_consensus_title") || "\u26A1 Early Exit upon Semantic Consensus"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.early_consensus_desc") || "Bypass the expensive judge round when reference models converge on equivalent code solutions."
                )
              ),
              /* Multi-Round Rebuttal Debate (#298) & Blind Embedding Clustering (#312) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.rebuttal_debate_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, rebuttal_debate_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.rebuttal_debate_title") || "\u{1F5E3}\uFE0F Multi-Round Rebuttal Debate"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.rebuttal_debate_desc") || "Candidates cross-examine peer solutions and expose flaws before judge arbitration."
                ),
                Boolean(currentPreset.rebuttal_debate_enabled) && React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: 8, marginLeft: 22, marginTop: 4 } },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.rebuttal_rounds_label") || "Debate Rounds:"),
                  React.createElement("input", {
                    type: "number",
                    min: 1,
                    max: 3,
                    value: currentPreset.rebuttal_rounds || 1,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, rebuttal_rounds: Math.min(3, Math.max(1, Number(e.target.value) || 1)) })),
                    style: { width: 50, padding: "2px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)" }
                  })
                ),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.embedding_clustering_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, embedding_clustering_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.embedding_clustering_title") || "\u{1F9ED} Blind Embedding Clustering"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.embedding_clustering_desc") || "Bypass LLM Judge when candidate embeddings converge into a dominant cluster (>= threshold)."
                ),
                Boolean(currentPreset.embedding_clustering_enabled) && React.createElement(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: 4, marginLeft: 22, marginTop: 4 } },
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.embedding_threshold_label") || "Consensus Similarity Threshold:"),
                    React.createElement("input", {
                      type: "number",
                      step: 0.01,
                      min: 0.5,
                      max: 0.99,
                      value: currentPreset.embedding_consensus_threshold ?? 0.88,
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, embedding_consensus_threshold: Number(e.target.value) || 0.88 })),
                      style: { width: 60, padding: "2px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)" }
                    })
                  ),
                  React.createElement(
                    "label",
                    { style: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12 } },
                    React.createElement("input", {
                      type: "checkbox",
                      checked: currentPreset.fallback_to_judge_on_split !== false,
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, fallback_to_judge_on_split: e.target.checked })),
                      style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))" }
                    }),
                    t("aggregator.fallback_to_judge_label") || "Fallback to Judge if Opinion Splits"
                  )
                )
              ),
              /* Multi-Branch Git Sandbox Tournament (#304) & Multi-Persona Council (#313) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.git_tournament_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, git_tournament_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.git_tournament_title") || "\u{1F3C6} Multi-Branch Git Sandbox Tournament"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.git_tournament_desc") || "Executes candidate proposals in isolated Git worktrees and runs real project tests (npm test, pytest)."
                ),
                Boolean(currentPreset.git_tournament_enabled) && React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: 8, marginLeft: 22, marginTop: 4 } },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.git_tournament_cmd_label") || "Test Command:"),
                  React.createElement("input", {
                    type: "text",
                    value: currentPreset.git_tournament_command || "npm test",
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, git_tournament_command: e.target.value })),
                    style: { width: 140, padding: "2px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)" }
                  })
                ),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.council_arbitration_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, council_arbitration_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.council_arbitration_title") || "\u{1F3DB}\uFE0F Multi-Persona Role-Playing Council Arbitration"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.council_arbitration_desc") || "Replaces single-judge bias with a 3-expert jury: Systems Architect, Security Auditor, and Pragmatic Minimalist."
                ),
                Boolean(currentPreset.council_arbitration_enabled) && React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: 8, marginLeft: 22, marginTop: 4 } },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.council_weights_label") || "Council Weights (Arch / Sec / Min):"),
                  React.createElement("input", {
                    type: "number",
                    min: 0,
                    max: 100,
                    value: currentPreset.council_weight_architect ?? 35,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, council_weight_architect: Number(e.target.value) || 0 })),
                    style: { width: 45, padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)" }
                  }),
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, "/"),
                  React.createElement("input", {
                    type: "number",
                    min: 0,
                    max: 100,
                    value: currentPreset.council_weight_security ?? 35,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, council_weight_security: Number(e.target.value) || 0 })),
                    style: { width: 45, padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)" }
                  }),
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, "/"),
                  React.createElement("input", {
                    type: "number",
                    min: 0,
                    max: 100,
                    value: currentPreset.council_weight_minimalist ?? 30,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, council_weight_minimalist: Number(e.target.value) || 0 })),
                    style: { width: 45, padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)" }
                  })
                )
              ),
              // --- src/client/86-card-aggregator-ext2.js ---
              /* MoA Preset Regression Benchmark (#310) & PR Consensus Bot (#311) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.benchmark_suite_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, benchmark_suite_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.benchmark_title") || "\u{1F4CA} MoA Preset Regression Benchmark Suite"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.benchmark_desc") || "Calibrates ensemble accuracy, latency, and cost against ground-truth coding puzzles vs single baseline."
                ),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.pr_review_bot_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, pr_review_bot_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.pr_review_title") || "\u{1F916} PR & Webhook Consensus Reviewer Bot Mode"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.pr_review_desc") || "Autonomous multi-model code review for Gitea/GitHub pull requests with de-duplicated blocker detection."
                )
              ),
              /* Ecosystem Context (#321) & Consensus Knowledge Graph (#322) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: currentPreset.enable_ecosystem_context !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, enable_ecosystem_context: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.ecosystem_title") || "\u{1F310} Context Lens & LLM Wiki Ecosystem Injection"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.ecosystem_desc") || "Enriches candidate generation with AST symbol graphs and architectural invariants (graceful autonomous fallback)."
                ),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: currentPreset.sync_with_memory_brain !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, sync_with_memory_brain: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.knowledge_title") || "\u{1F9E0} Long-Term Consensus Knowledge Graph"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.knowledge_desc") || "Persists consensus decisions to ~/.dsh/moa/knowledge.json and syncs with dsh-memory-brain to prevent recurring debates."
                )
              ),
              /* Multi-Column Streaming (#295) & AST Heatmap (#297) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", { type: "checkbox", checked: currentPreset.multi_column_stream_enabled !== false, onChange: (e) => updateCurrentPreset((p) => ({ ...p, multi_column_stream_enabled: e.target.checked })), style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" } }),
                  t("aggregator.multi_stream_title") || "\u26A1 Multi-Column Live Candidate Streaming"
                ),
                React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } }, t("aggregator.multi_stream_desc") || "Streams parallel candidate tokens in real-time split columns with TTFT and tok/s speed metrics."),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement("input", { type: "checkbox", checked: currentPreset.ast_heatmap_enabled !== false, onChange: (e) => updateCurrentPreset((p) => ({ ...p, ast_heatmap_enabled: e.target.checked })), style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" } }),
                  t("aggregator.ast_heatmap_title") || "\u{1F308} AST Consensus Heatmap in Code Diff"
                ),
                React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } }, t("aggregator.ast_heatmap_desc") || "Visualizes line-by-line consensus agreement across models with interactive contested block resolution.")
              ),
              /* Multi-Turn Context & Diff Pruning (#176) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: currentPreset.multi_turn_enabled !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, multi_turn_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.multi_turn_title") || "Multi-Turn Context & Diff Pruning"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.multi_turn_desc") || "Retain conversation context across turns while pruning duplicate code blocks."
                )
              ),
              /* Context Pruning (#305) & Semantic Caching (#318) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: currentPreset.context_pruning_enabled !== false,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, context_pruning_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.context_pruning_title") || "\u2702\uFE0F Cross-Candidate Context Pruning (Diff-Only Judge Context)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.context_pruning_desc") || "Replaces unchanged base project files with compact unified diffs (---/+++ hunks) in the Judge prompt, slashing prompt tokens by up to 85%."
                ),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 4 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.semantic_cache_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, semantic_cache_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.semantic_cache_title") || "\u26A1 Semantic Caching for Candidate Generations"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.semantic_cache_desc") || "Persists intermediate candidate outputs locally by deterministic SHA-256 fingerprint, eliminating duplicate API costs on retry or repeat requests."
                )
              ),
              /* Self-Consistency Temperature Sampling (#301) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.self_consistency_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, self_consistency_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.self_consistency_title") || "\u{1F3B2} Self-Consistency Temperature Sampling (Single-Model Diversity)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.self_consistency_desc") || "Expands a single reference model into multiple parallel samples with varied temperatures and personas, bringing MoA benefits to single-model setups."
                ),
                currentPreset.self_consistency_enabled && React.createElement(
                  "div",
                  { style: { marginLeft: 22, marginTop: 4, display: "flex", alignItems: "center", gap: 12 } },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, (t("aggregator.self_consistency_samples") || "Samples:") + " " + (currentPreset.self_consistency_samples || 3)),
                  React.createElement("input", {
                    type: "range",
                    min: 2,
                    max: 5,
                    value: currentPreset.self_consistency_samples || 3,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, self_consistency_samples: Number(e.target.value) })),
                    style: { width: 100, accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))" }
                  })
                )
              ),
              /* Dynamic Consensus Threshold & Multi-Judge Escalation (#300) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "div",
                  { style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } },
                  t("aggregator.escalation_title") || "\u2696\uFE0F Dynamic Consensus Threshold & Judge Escalation"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } },
                  t("aggregator.escalation_desc") || "Detects divergence across candidates. When consensus is weak, automatically upgrades to a senior flagship judge or convenes a 3-judge panel."
                ),
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.escalation_policy") || "Escalation Policy:"),
                  React.createElement(
                    "select",
                    {
                      value: currentPreset.escalation_policy || "single",
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, escalation_policy: e.target.value })),
                      style: {
                        padding: "4px 8px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid var(--dsw-alias-border-l2)",
                        background: "var(--dsw-alias-bg-layer-1)",
                        color: "var(--dsw-alias-label-primary)"
                      }
                    },
                    React.createElement("option", { value: "single" }, t("aggregator.escalation_policy_single") || "Standard Single Judge (No Escalation)"),
                    React.createElement("option", { value: "auto_upgrade" }, t("aggregator.escalation_policy_upgrade") || "Auto-Upgrade to Senior Judge on Divergence"),
                    React.createElement("option", { value: "council_majority" }, t("aggregator.escalation_policy_council") || "Convene 3-Judge Majority Council on Divergence")
                  )
                ),
                currentPreset.escalation_policy && currentPreset.escalation_policy !== "single" && React.createElement(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } },
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 12 } },
                    React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, (t("aggregator.escalation_threshold") || "Divergence Threshold:") + " " + Math.round((currentPreset.escalation_disagreement_threshold ?? 0.4) * 100) + "%"),
                    React.createElement("input", {
                      type: "range",
                      min: 10,
                      max: 90,
                      value: Math.round((currentPreset.escalation_disagreement_threshold ?? 0.4) * 100),
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, escalation_disagreement_threshold: Number(e.target.value) / 100 })),
                      style: { width: 120, accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))" }
                    })
                  ),
                  currentPreset.escalation_policy === "auto_upgrade" && React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.escalation_judge_label") || "Senior Judge:"),
                    React.createElement(
                      "div",
                      { style: { flex: 1, maxWidth: 300 } },
                      React.createElement(SearchableModelPicker, {
                        provider: currentPreset.escalation_judge?.provider || "",
                        model: currentPreset.escalation_judge?.model || "",
                        onChange: (prov, mod) => {
                          updateCurrentPreset((p) => ({
                            ...p,
                            escalation_judge: { provider: prov, model: mod }
                          }));
                        },
                        availableModels,
                        t
                      })
                    )
                  )
                )
              ),
              /* Stack-Aware Dynamic Persona Evolution (#308) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.stack_aware_personas_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, stack_aware_personas_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.stack_personas_title") || "\u{1F4E6} Stack-Aware Dynamic Persona Evolution (Project Manifests)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.stack_personas_desc") || "Scans project manifests (package.json, Cargo.toml, pyproject.toml, go.mod) and assigns specialized engineering roles to candidate slots."
                )
              ),
              // --- src/client/87-card-aggregator-ext3.js ---
              /* Self-Learning Developer Preferences Metaprompt (#309) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.developer_preferences_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, developer_preferences_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.preferences_title") || "\u{1F9E0} Developer Coding Principles & Preferences Metaprompt"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.preferences_desc") || "Injects learned developer preferences (strict typing, functional immutability, error boundaries) to guide Judge synthesis."
                )
              ),
              /* Adversarial White-Hat Security Fuzzing Gate (#302) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.security_gate_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, security_gate_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.security_gate_title") || "\u{1F6E1}\uFE0F Adversarial White-Hat Security Fuzzing Gate"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.security_gate_desc") || "Red-team security auditor checks candidate proposals for SQLi, XSS, ReDoS, Command Injection and Path Traversal with blocking SECURITY_VETO."
                )
              ),
              /* Chain-of-Verification (CoVe) Fact-Checking Gate (#314) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.cove_verification_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, cove_verification_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.cove_gate_title") || "\u{1F50D} Chain-of-Verification (CoVe) Fact-Checking Gate"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.cove_gate_desc") || "Formulates API existence & method signature verification questions, disqualifying candidates that use hallucinated methods."
                )
              ),
              /* Automated Runtime Memory & CPU Profiler Gate (#315) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.profiler_gate_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, profiler_gate_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.profiler_gate_title") || "\u26A1 Automated Runtime Memory & CPU Profiler Gate"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.profiler_gate_desc") || "Runs isolated micro-benchmarks measuring execution latency, throughput (ops/sec), and heap memory usage."
                )
              ),
              /* Runtime Mutation Testing Gate (#316) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.mutation_testing_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, mutation_testing_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.mutation_gate_title") || "\u{1F9EC} Runtime Mutation Testing Gate for Candidate Tests"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.mutation_gate_desc") || "Injects synthetic faults into candidate code to test test-suite robustness, eliminating tautological and weak tests."
                )
              ),
              /* Hybrid Edge Privacy Gate (#306) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 4 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)", cursor: "pointer" } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.hybrid_edge_privacy_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, hybrid_edge_privacy_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.privacy_gate_title") || "\u{1F6E1}\uFE0F Hybrid Private Edge MoA (Local Edge Proposers + Cloud Judge)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.privacy_gate_desc") || "Scans and redacts proprietary secrets, local paths, and private network IPs before forwarding proposals to external cloud judges."
                )
              ),
              /* Heterogeneous Speculative Decoding (#317) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 4 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)", cursor: "pointer" } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.speculative_draft_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, speculative_draft_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.speculative_gate_title") || "\u26A1 Heterogeneous Speculative Decoding (Local Draft + Cloud Verifier)"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.speculative_gate_desc") || "Lightweight local edge model generates high-speed token drafts verified and completed in one fast pass by the cloud model."
                )
              ),
              /* Pareto Frontier Slider (#307) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)", cursor: "pointer" } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.pareto_slider_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, pareto_slider_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.pareto_slider_title") || "\u{1F4C8} Cost vs Quality Pareto Frontier Slider"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.pareto_slider_desc") || "Reactive balance from 100% free local edge models to ultra-rigorous flagship multi-judge consensus."
                ),
                currentPreset.pareto_slider_enabled && React.createElement(
                  "div",
                  { style: { marginLeft: 22, marginTop: 4, display: "flex", alignItems: "center", gap: 10 } },
                  React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.pareto_pos_label") || "Frontier Position:"),
                  React.createElement("input", {
                    type: "range",
                    min: 0,
                    max: 100,
                    step: 5,
                    value: currentPreset.pareto_slider_position ?? 50,
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, pareto_slider_position: Number(e.target.value) })),
                    style: { cursor: "pointer", flex: 1, maxWidth: 200 }
                  }),
                  React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, String(currentPreset.pareto_slider_position ?? 50) + "%")
                )
              ),
              /* Hard Token Budget Guard (#319) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)", cursor: "pointer" } },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: Boolean(currentPreset.hard_budget_guard_enabled),
                    onChange: (e) => updateCurrentPreset((p) => ({ ...p, hard_budget_guard_enabled: e.target.checked })),
                    style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
                  }),
                  t("aggregator.hard_budget_title") || "\u{1F6E1}\uFE0F Hard Token Budget Guard with Auto-Scaling"
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
                  t("aggregator.hard_budget_desc") || "Pre-calculates turn costs against a hard financial ceiling, automatically scaling down or halting execution."
                ),
                currentPreset.hard_budget_guard_enabled && React.createElement(
                  "div",
                  { style: { marginLeft: 22, marginTop: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 } },
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 6 } },
                    React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.hard_budget_limit_label") || "Max Cost (USD):"),
                    React.createElement("input", {
                      type: "number",
                      min: 1e-3,
                      max: 10,
                      step: 5e-3,
                      value: currentPreset.hard_budget_limit_usd ?? 0.02,
                      onChange: (e) => updateCurrentPreset((p) => ({ ...p, hard_budget_limit_usd: Number(e.target.value) })),
                      style: { width: 80, padding: "2px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--dsw-alias-border-primary)" }
                    })
                  ),
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: 6 } },
                    React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("aggregator.hard_budget_policy_label") || "Policy:"),
                    React.createElement(
                      "select",
                      {
                        value: currentPreset.hard_budget_policy || "auto_downgrade",
                        onChange: (e) => updateCurrentPreset((p) => ({ ...p, hard_budget_policy: e.target.value })),
                        style: { padding: "2px 6px", fontSize: 12, borderRadius: 4, border: "1px solid var(--dsw-alias-border-primary)" }
                      },
                      React.createElement("option", { value: "auto_downgrade" }, t("aggregator.hard_budget_policy_downgrade") || "Auto-Downgrade"),
                      React.createElement("option", { value: "fail_closed" }, t("aggregator.hard_budget_policy_fail") || "Fail-Closed")
                    )
                  )
                )
              ),
              /* Human Jury Battle Arena (#294), Block Mixer (#296), Decision Timeline (#320) */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", marginTop: 8 } },
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
                  React.createElement("input", { type: "checkbox", checked: Boolean(currentPreset.blind_arena_enabled), onChange: (e) => updateCurrentPreset((p) => ({ ...p, blind_arena_enabled: e.target.checked, jury_mode: e.target.checked ? "blind_human" : "auto" })), style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" } }),
                  t("aggregator.arena_title") || "\u2694\uFE0F Blind Battle Arena & Human Jury Mode"
                ),
                React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } }, t("aggregator.arena_desc") || "Anonymizes candidate models as Option A/B/C for blind human voting with local ELO leaderboard ranking."),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement("input", { type: "checkbox", checked: currentPreset.block_mixer_enabled !== false, onChange: (e) => updateCurrentPreset((p) => ({ ...p, block_mixer_enabled: e.target.checked })), style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" } }),
                  t("aggregator.mixer_title") || "\u{1F9E9} Interactive Drag-and-Drop Block Mixer"
                ),
                React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } }, t("aggregator.mixer_desc") || "Enables discrete AST/markdown block extraction and manual composition across candidates with judge reconciliation."),
                React.createElement(
                  "label",
                  { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 6 } },
                  React.createElement("input", { type: "checkbox", checked: currentPreset.decision_timeline_enabled !== false, onChange: (e) => updateCurrentPreset((p) => ({ ...p, decision_timeline_enabled: e.target.checked })), style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" } }),
                  t("aggregator.timeline_title") || "\u23F3 Historical Consensus Decision Timeline & Time-Travel"
                ),
                React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } }, t("aggregator.timeline_desc") || "Captures granular phase snapshots across debate and synthesis stages with interactive rewind and branch forking.")
              ),
              /* Fallback Judges Chain */
              React.createElement(
                "div",
                { style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 } },
                React.createElement(
                  "div",
                  { style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } },
                  t("aggregator.fallbacks_title")
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginTop: -4 } },
                  t("aggregator.fallbacks_desc")
                ),
                renderSlotEditorList({
                  items: currentPreset.aggregator_fallbacks,
                  badgePrefix: "Fallback",
                  onUpdate: (idx, prov, mod) => {
                    updateCurrentPreset((p) => {
                      const list = [...p.aggregator_fallbacks || []];
                      list[idx] = { provider: prov, model: mod };
                      return { ...p, aggregator_fallbacks: list };
                    });
                  },
                  onRemove: (idx) => {
                    updateCurrentPreset((p) => ({
                      ...p,
                      aggregator_fallbacks: (p.aggregator_fallbacks || []).filter((_, i) => i !== idx)
                    }));
                  },
                  onAdd: () => {
                    updateCurrentPreset((p) => ({
                      ...p,
                      aggregator_fallbacks: [...p.aggregator_fallbacks || [], { provider: availableModels[0] && availableModels[0].provider || "", model: availableModels[0] && availableModels[0].model || "" }]
                    }));
                  },
                  addLabel: t("aggregator.add_fallback_btn"),
                  emptyWarning: null,
                  availableModels,
                  t
                })
              )
            )
          )
        ),
        // --- src/client/90-card-proposers.js ---
        /* ── SECTION 3: CANDIDATE PROPOSERS ── */
        React.createElement(
          "div",
          { className: "moa-section-card" },
          React.createElement(
            "div",
            { className: "moa-section-title" },
            React.createElement("span", null, t("proposers.title")),
            React.createElement(
              "div",
              { className: "moa-seg-group" },
              React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("proposers.parallel_count") + ":"),
              [2, 3, 4, 5].map(
                (cnt) => React.createElement(
                  "button",
                  {
                    key: cnt,
                    type: "button",
                    className: currentRefs.length === cnt ? "moa-seg-btn moa-seg-btn-active moa-btn-sub" : "moa-seg-btn moa-btn-sub",
                    onClick: () => setReferenceCount(cnt)
                  },
                  cnt
                )
              )
            )
          ),
          React.createElement("div", { className: "moa-section-desc" }, t("proposers.desc")),
          React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)" } },
            React.createElement(
              "label",
              { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } },
              React.createElement("input", {
                type: "checkbox",
                checked: Boolean(currentPreset.quorum_enabled),
                onChange: (e) => updateCurrentPreset((p) => ({ ...p, quorum_enabled: e.target.checked })),
                style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
              }),
              t("proposers.quorum_label")
            ),
            React.createElement(
              "div",
              { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginLeft: 22 } },
              t("proposers.quorum_hint")
            ),
            currentPreset.quorum_enabled && React.createElement(
              "div",
              { style: { marginLeft: 22, display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
              React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("proposers.grace_label")),
              React.createElement("input", {
                type: "number",
                className: "moa-input",
                style: { width: 70, height: 28, padding: "0 6px", fontSize: 12 },
                min: 2,
                max: 60,
                value: currentPreset.grace_period_sec ?? 10,
                onChange: (e) => {
                  const val = parseInt(e.target.value, 10);
                  updateCurrentPreset((p) => ({ ...p, grace_period_sec: isNaN(val) ? 10 : val }));
                }
              })
            ),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
              React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, t("proposers.timeout_label")),
              React.createElement("input", {
                type: "number",
                className: "moa-input",
                style: { width: 70, height: 28, padding: "0 6px", fontSize: 12 },
                min: 10,
                max: 300,
                value: currentPreset.reference_timeout_sec ?? 60,
                onChange: (e) => {
                  const val = parseInt(e.target.value, 10);
                  updateCurrentPreset((p) => ({ ...p, reference_timeout_sec: isNaN(val) ? 60 : val }));
                }
              })
            ),
            React.createElement(
              "label",
              { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 4 } },
              React.createElement("input", {
                type: "checkbox",
                checked: Boolean(currentPreset.temperature_gradient_enabled),
                onChange: (e) => updateCurrentPreset((p) => ({ ...p, temperature_gradient_enabled: e.target.checked })),
                style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
              }),
              t("proposers.temperature_gradient") || "Temperature Gradient Exploration (0.2 \u2192 0.9 across candidates)"
            )
          ),
          React.createElement(
            "div",
            { className: "moa-cand-list" },
            currentRefs.map(
              (ref, idx) => React.createElement(
                "div",
                { key: idx, className: "moa-cand-row" },
                React.createElement("span", { className: "moa-cand-badge" }, `${t("proposers.candidate")} #${idx + 1}`),
                React.createElement(
                  "div",
                  { className: "moa-cand-picker" },
                  React.createElement(SearchableModelPicker, {
                    provider: ref.provider || "",
                    model: ref.model || "",
                    onChange: (p, m) => setReferenceModel(idx, p, m),
                    availableModels,
                    t
                  })
                ),
                React.createElement("input", {
                  type: "number",
                  step: "0.1",
                  min: "0",
                  max: "2",
                  placeholder: "Temp",
                  title: t("proposers.candidate_temp_tooltip") || "Candidate Temperature (leave empty for default/gradient)",
                  className: "moa-input",
                  style: { width: 50, height: 32, fontSize: 12, padding: "0 4px", textAlign: "center" },
                  value: typeof ref.temperature === "number" && ref.temperature >= 0 ? ref.temperature : "",
                  onChange: (e) => {
                    const raw = e.target.value;
                    const parsedVal = raw === "" ? -1 : parseFloat(raw);
                    updateCurrentPreset((p) => {
                      const refs = [...p.reference_models || []];
                      refs[idx] = { ...refs[idx], temperature: isNaN(parsedVal) ? -1 : parsedVal };
                      return { ...p, reference_models: refs };
                    });
                  }
                }),
                React.createElement(
                  "select",
                  {
                    className: "moa-select",
                    style: { width: 105, height: 32, fontSize: 12, padding: "0 6px" },
                    value: ref.role_persona || "general",
                    title: t("proposers.role_label"),
                    onChange: (e) => {
                      const newRole = e.target.value;
                      updateCurrentPreset((p) => {
                        const refs = [...p.reference_models || []];
                        refs[idx] = { ...refs[idx], role_persona: newRole };
                        return { ...p, reference_models: refs };
                      });
                    }
                  },
                  React.createElement("option", { value: "general" }, t("proposers.role_general") || "General"),
                  React.createElement("option", { value: "minimalist" }, t("proposers.role_minimalist") || "Minimalist"),
                  React.createElement("option", { value: "robustness" }, t("proposers.role_robustness") || "Robustness"),
                  React.createElement("option", { value: "performance" }, t("proposers.role_performance") || "Performance"),
                  React.createElement("option", { value: "tester" }, t("proposers.role_tester") || "Tester")
                ),
                currentRefs.length > 1 && React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "moa-btn moa-btn-danger moa-btn-sub",
                    title: "Remove",
                    onClick: () => removeReference(idx)
                  },
                  "\u2715"
                )
              )
            )
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "moa-btn",
              style: { alignSelf: "flex-start" },
              onClick: addReference
            },
            t("proposers.add_btn")
          ),
          React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4, borderTop: "1px solid var(--dsw-alias-border-l2)", paddingTop: 10 } },
            React.createElement(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 500 } },
              React.createElement("span", null, t("proposers.temp_label")),
              React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12 } }, t("proposers.temp_hint"))
            ),
            React.createElement(
              "div",
              { className: "moa-slider-row" },
              React.createElement("input", {
                type: "range",
                className: "moa-slider",
                min: "0",
                max: "2",
                step: "0.05",
                value: refTemp,
                onChange: (e) => setReferenceTemp(e.target.value)
              }),
              React.createElement("div", { className: "moa-slider-badge" }, refTemp)
            )
          )
        ),
        // --- src/client/100-card-stats.js ---
        /* ── SECTION 4: TELEMETRY & STATS SUMMARY ── */
        React.createElement(
          "div",
          { className: "moa-section-card" },
          React.createElement("div", { className: "moa-section-title" }, t("stats.title")),
          React.createElement("div", { className: "moa-section-desc" }, t("stats.desc")),
          React.createElement(
            "div",
            { className: "moa-grid-2" },
            React.createElement(
              "div",
              { className: "moa-stat-box" },
              React.createElement("div", { className: "moa-stat-val" }, String(presets.length)),
              React.createElement("div", { className: "moa-stat-lbl" }, t("stats.preset_count"))
            ),
            React.createElement(
              "div",
              { className: "moa-stat-box" },
              React.createElement("div", { className: "moa-stat-val" }, stats.totalRuns === null || stats.totalRuns === void 0 ? "\u2014" : String(stats.totalRuns)),
              React.createElement("div", { className: "moa-stat-lbl" }, t("stats.total_runs"))
            ),
            React.createElement(
              "div",
              { className: "moa-stat-box" },
              React.createElement("div", { className: "moa-stat-val" }, stats.avgCostUsd === null || stats.avgCostUsd === void 0 ? "\u2014" : `~$${stats.avgCostUsd.toFixed(4)}`),
              React.createElement("div", { className: "moa-stat-lbl" }, t("stats.avg_cost"))
            ),
            React.createElement(
              "div",
              { className: "moa-stat-box" },
              React.createElement("div", { className: "moa-stat-val" }, String(currentRefs.length)),
              React.createElement("div", { className: "moa-stat-lbl" }, t("stats.active_models"))
            )
          ),
          Array.isArray(leaderboard) && leaderboard.length > 0 && React.createElement(
            "div",
            { style: { marginTop: 12, display: "flex", flexDirection: "column", gap: 6 } },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" } },
              React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, t("leaderboard.title")),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 6 } },
                React.createElement(
                  "select",
                  {
                    className: "moa-select",
                    style: { height: 26, fontSize: 11, padding: "0 6px" },
                    value: leaderboardPresetFilter,
                    onChange: (e) => setLeaderboardPresetFilter(e.target.value)
                  },
                  React.createElement("option", { value: "all" }, t("leaderboard.filter_all")),
                  presets.map((p) => React.createElement("option", { key: p.name, value: p.name }, p.name))
                ),
                React.createElement(
                  "a",
                  {
                    href: `/dsh-moa/history/export?format=csv${leaderboardPresetFilter !== "all" ? "&preset=" + encodeURIComponent(leaderboardPresetFilter) : ""}`,
                    download: "moa-history.csv",
                    className: "moa-btn",
                    style: { height: 26, fontSize: 11, padding: "0 8px", textDecoration: "none", display: "inline-flex", alignItems: "center" }
                  },
                  t("leaderboard.export_csv") || "CSV"
                ),
                React.createElement(
                  "a",
                  {
                    href: `/dsh-moa/history/export?format=json${leaderboardPresetFilter !== "all" ? "&preset=" + encodeURIComponent(leaderboardPresetFilter) : ""}`,
                    download: "moa-history.json",
                    className: "moa-btn",
                    style: { height: 26, fontSize: 11, padding: "0 8px", textDecoration: "none", display: "inline-flex", alignItems: "center" }
                  },
                  t("leaderboard.export_json") || "JSON"
                )
              )
            ),
            React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginTop: -4 } }, t("leaderboard.desc")),
            React.createElement(
              "div",
              { style: { overflowX: "auto", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8 } },
              React.createElement(
                "table",
                { style: { width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" } },
                React.createElement(
                  "thead",
                  { style: { background: "var(--dsw-alias-bg-layer-2)", borderBottom: "1px solid var(--dsw-alias-border-l2)" } },
                  React.createElement(
                    "tr",
                    null,
                    React.createElement("th", { style: { padding: "6px 10px" } }, t("leaderboard.model")),
                    React.createElement("th", { style: { padding: "6px 8px" } }, t("leaderboard.runs")),
                    React.createElement("th", { style: { padding: "6px 8px" } }, t("leaderboard.wins")),
                    React.createElement("th", { style: { padding: "6px 8px" } }, t("leaderboard.winrate")),
                    React.createElement("th", { style: { padding: "6px 8px" } }, "Elo"),
                    React.createElement("th", { style: { padding: "6px 10px" } }, t("leaderboard.cost"))
                  )
                ),
                React.createElement(
                  "tbody",
                  null,
                  leaderboard.map(
                    (m, mIdx) => React.createElement(
                      "tr",
                      { key: mIdx, style: { borderBottom: mIdx < leaderboard.length - 1 ? "1px solid var(--dsw-alias-border-l2)" : "none" } },
                      React.createElement("td", { style: { padding: "6px 10px", fontWeight: 500, color: "var(--dsw-alias-label-primary)" } }, m.modelKey || m.model),
                      React.createElement("td", { style: { padding: "6px 8px", color: "var(--dsw-alias-label-secondary)" } }, String(m.runs)),
                      React.createElement("td", { style: { padding: "6px 8px", color: "var(--dsw-alias-state-success-primary)" } }, String(m.wins)),
                      React.createElement("td", { style: { padding: "6px 8px", fontWeight: 600 } }, (m.winRate ?? 0) + "%"),
                      React.createElement("td", { style: { padding: "6px 8px", fontWeight: 600, color: "var(--dsw-alias-state-brand-primary)" } }, String(m.elo ?? 1500)),
                      React.createElement("td", { style: { padding: "6px 10px", color: "var(--dsw-alias-label-secondary)" } }, m.avgCostUsd > 0 ? "$" + m.avgCostUsd.toFixed(4) : "Free")
                    )
                  )
                )
              )
            )
          )
        ),
        // --- src/client/105-card-diff.js ---
        /* ── SECTION 4b: CANDIDATE DIFF VIEWER ── */
        React.createElement(CandidateDiffSection, {
          t,
          currentRefs
        }),
        // --- src/client/106-card-workbench.js ---
        /* ── SECTION 4c: INTERACTIVE WORKBENCH (FILE PICK & MIX) ── */
        React.createElement(InteractiveWorkbenchSection, {
          t,
          currentRefs
        }),
        // --- src/client/110-card-updater.js ---
        /* ── PLUGIN UPDATES ── */
        React.createElement(
          "div",
          { className: "moa-section-card" },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
            React.createElement("div", { className: "moa-sec-title" }, "\u2728 " + (t("updater.title") || "Plugin Updates")),
            React.createElement(
              "div",
              { style: { display: "flex", gap: 8 } },
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "moa-btn moa-btn-sub",
                  disabled: updateState?.checking || updateState?.updating,
                  onClick: checkUpdates
                },
                updateState?.checking ? t("updater.checking") || "Checking..." : t("updater.btnCheck") || "Check Updates"
              ),
              updateState?.updateAvailable ? React.createElement(
                "button",
                {
                  type: "button",
                  className: "moa-btn moa-btn-sub moa-btn-primary",
                  disabled: updateState?.updating,
                  onClick: runUpdate
                },
                updateState?.updating ? t("updater.updating") || "Updating..." : (t("updater.btnUpdate") || "Update to v{version}").replace("{version}", updateState.latestVersion || "")
              ) : null
            )
          ),
          React.createElement(
            "div",
            { className: "moa-sec-desc", style: { marginBottom: 8 } },
            t("updater.desc") || "Check npm registry for new versions and update with one click."
          ),
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 10, fontSize: 12 } },
            React.createElement(
              "span",
              { style: { color: "var(--dsw-alias-label-secondary)" } },
              (t("updater.current") || "Current version: v{version}").replace("{version}", updateState?.currentVersion || "0.2.16")
            ),
            updateState?.checking ? React.createElement("span", { style: { color: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))" } }, t("updater.checking")) : updateState?.updateAvailable ? React.createElement(
              "span",
              { style: { color: "var(--dsw-alias-state-error-primary)", fontWeight: 600 } },
              (t("updater.available") || "Update available: v{version}").replace("{version}", updateState?.latestVersion || "")
            ) : updateState?.currentVersion && !updateState?.error ? React.createElement("span", { style: { color: "var(--dsw-alias-state-success-primary)" } }, "\u2713 " + (t("updater.upToDate") || "Up to date")) : null
          ),
          updateState?.notice ? React.createElement(
            "div",
            { className: "moa-alert-ok", style: { marginTop: 8 } },
            updateState.notice
          ) : null,
          updateState?.error ? React.createElement(
            "div",
            { className: "moa-alert-err", style: { marginTop: 8 } },
            updateState.error
          ) : null
        ),
        /* ── ENABLED TOGGLE ── */
        React.createElement(
          "label",
          { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, alignSelf: "flex-start" } },
          React.createElement("input", {
            type: "checkbox",
            checked: enabled !== false,
            onChange: (e) => setEnabled(e.target.checked),
            style: { accentColor: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))", cursor: "pointer" }
          }),
          t("config.enabled_label")
        ),
        /* ── FOOTER ACTIONS & SAVE ── */
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 4 } },
          React.createElement(
            "button",
            {
              type: "button",
              className: "moa-btn moa-btn-primary",
              style: { padding: "10px 24px", fontSize: 14, fontWeight: 600 },
              onClick: handleSave
            },
            saveStatus === t("actions.saving") ? t("actions.saving") : t("actions.save")
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "moa-btn",
              onClick: reload
            },
            t("actions.retry")
          ),
          saveStatus && React.createElement(
            "span",
            {
              className: saveStatus.startsWith("Error") ? "moa-alert-err" : "moa-alert-ok"
            },
            saveStatus
          )
        )
      );
    }
    const UNAVAILABLE_SNAPSHOT = Object.freeze({ status: "unavailable" });
    const LOADING_SNAPSHOT = Object.freeze({ status: "loading" });
    function useMoASettings(props) {
      const effectiveCtx = props && props.ctx || rootCtx;
      const t = typeof props?.t === "function" ? props.t : makeT(en, null);
      const scope = React.useMemo(() => {
        if (!effectiveCtx) return void 0;
        const s = effectiveCtx.get ? effectiveCtx.get("configForms") : effectiveCtx.configForms;
        return s && typeof s.get === "function" ? s.get(NS) : void 0;
      }, [effectiveCtx]);
      const getSnapshot = React.useCallback(() => scope ? scope.getSnapshot() : UNAVAILABLE_SNAPSHOT, [scope]);
      const getServerSnapshot = React.useCallback(() => LOADING_SNAPSHOT, []);
      const subscribe = React.useCallback((cb) => scope ? scope.subscribe(cb) : () => {
      }, [scope]);
      const snapshot = React.useSyncExternalStore ? React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) : null;
      const [status, setStatus] = React.useState("loading");
      const [presets, setPresets] = React.useState([]);
      const [defaultPreset, setDefaultPreset] = React.useState("default");
      const [availableModels, setAvailableModels] = React.useState([]);
      const [saveStatus, setSaveStatus] = React.useState("");
      const [updateState, setUpdateState] = React.useState({
        checking: false,
        updating: false,
        currentVersion: "0.2.16",
        latestVersion: void 0,
        updateAvailable: false,
        canAutoUpdate: true,
        notice: null,
        error: null
      });
      const checkUpdates = async () => {
        setUpdateState((prev) => ({ ...prev, checking: true, error: null, notice: null }));
        try {
          const res = await fetch("/api/dsh-moa/update", { cache: "no-store" });
          const data = await res.json();
          if (data && data.currentVersion) {
            setUpdateState((prev) => ({
              ...prev,
              checking: false,
              currentVersion: data.currentVersion,
              latestVersion: data.latestVersion,
              updateAvailable: Boolean(data.updateAvailable),
              canAutoUpdate: data.canAutoUpdate !== void 0 ? Boolean(data.canAutoUpdate) : prev.canAutoUpdate,
              error: data.latestCheckFailed ? t("updater.checkFailed") || "Registry check failed" : null
            }));
          } else {
            setUpdateState((prev) => ({ ...prev, checking: false, error: data?.error || "Check failed" }));
          }
        } catch (err) {
          setUpdateState((prev) => ({ ...prev, checking: false, error: String(err?.message || err) }));
        }
      };
      const runUpdate = async () => {
        setUpdateState((prev) => ({ ...prev, updating: true, error: null, notice: null }));
        try {
          const res = await fetch("/api/dsh-moa/update", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-dsh-plugin-update": "1" }
          });
          const data = await res.json();
          if (data && (data.updated || data.updatedVersion || data.restartRequired || data.ok)) {
            const nextVer = data.updatedVersion || data.latestVersion || data.currentVersion;
            setUpdateState((prev) => ({
              ...prev,
              updating: false,
              updateAvailable: false,
              currentVersion: nextVer,
              notice: (t("updater.success") || "Successfully updated to v{version}. Restart DSH to apply.").replace("{version}", nextVer)
            }));
          } else {
            setUpdateState((prev) => ({
              ...prev,
              updating: false,
              error: data?.error || data?.message || "Update failed"
            }));
          }
        } catch (err) {
          setUpdateState((prev) => ({ ...prev, updating: false, error: String(err?.message || err) }));
        }
      };
      const [enabled, setEnabled] = React.useState(true);
      const [hostStatus, setHostStatus] = React.useState("connecting");
      const [stats, setStats] = React.useState({ totalRuns: null, avgCostUsd: null });
      const [leaderboard, setLeaderboard] = React.useState([]);
      const [leaderboardPresetFilter, setLeaderboardPresetFilter] = React.useState("all");
      React.useEffect(() => {
        if (!scope || !snapshot) {
          setStatus("unavailable");
          return;
        }
        const snapStatus = snapshot.status || "unavailable";
        if (snapStatus === "ready") {
          const val = snapshot.value || {};
          if (Array.isArray(val.presets)) setPresets(val.presets);
          if (val.default_preset) setDefaultPreset(val.default_preset);
          if (typeof val.enabled === "boolean") setEnabled(val.enabled);
          setStatus("ready");
        } else if (snapStatus === "unavailable") {
          setStatus("unavailable");
        }
      }, [scope, snapshot]);
      const reload = React.useCallback(() => {
        if (!scope) setStatus("loading");
        fetch("/dsh-moa/status", { cache: "no-store" }).then((r) => r.json()).then((data) => {
          if (data && data.ok) {
            setHostStatus(data.enabled === false ? "disabled" : "online");
          } else {
            setHostStatus("offline");
          }
        }).catch(() => {
          setHostStatus("offline");
        });
        const lbUrl = leaderboardPresetFilter !== "all" ? `/dsh-moa/leaderboard?preset=${encodeURIComponent(leaderboardPresetFilter)}` : "/dsh-moa/leaderboard";
        fetch(lbUrl, { cache: "no-store" }).then((r) => r.json()).then((data) => {
          if (data && data.ok && Array.isArray(data.models)) {
            setLeaderboard(data.models.slice(0, 10));
          }
        }).catch((err) => {
          console.warn("[dsh-moa] Leaderboard fetch failed:", err);
        });
        fetch("/dsh-moa/history?limit=100", { cache: "no-store" }).then((r) => r.json()).then((data) => {
          if (data && data.ok && Array.isArray(data.runs)) {
            const runs = data.runs;
            const withCost = runs.filter((run) => typeof run.totalCostUsd === "number");
            const avgCostUsd = withCost.length > 0 ? withCost.reduce((acc, run) => acc + run.totalCostUsd, 0) / withCost.length : null;
            setStats({ totalRuns: data.total || runs.length, avgCostUsd });
          }
        }).catch((err) => {
          console.warn("[dsh-moa] History fetch failed:", err);
        });
        fetch("/dsh-moa/presets", { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }).then((data) => {
          if (data && data.ok) {
            setPresets(data.presets || []);
            setDefaultPreset(data.defaultPreset || "default");
            setStatus("ready");
          } else if (!scope) {
            setStatus("unavailable");
          }
        }).catch((err) => {
          console.warn("[dsh-moa] Presets fetch failed:", err);
          if (!scope) setStatus("unavailable");
        });
        fetch("/dsh-moa/models", { cache: "no-store" }).then((r) => r.json()).then((data) => {
          if (data && data.ok && Array.isArray(data.models)) {
            setAvailableModels(data.models);
          }
        }).catch((err) => {
          console.warn("[dsh-moa] Models fetch failed:", err);
        });
      }, [scope]);
      React.useEffect(() => {
        reload();
      }, [reload]);
      React.useEffect(() => {
        const lbUrl = leaderboardPresetFilter !== "all" ? `/dsh-moa/leaderboard?preset=${encodeURIComponent(leaderboardPresetFilter)}` : "/dsh-moa/leaderboard";
        fetch(lbUrl, { cache: "no-store" }).then((r) => r.json()).then((data) => {
          if (data && data.ok && Array.isArray(data.models)) {
            setLeaderboard(data.models.slice(0, 10));
          }
        }).catch((err) => {
          console.warn("[dsh-moa] Leaderboard fetch failed:", err);
        });
      }, [leaderboardPresetFilter]);
      const handleSave = () => {
        setSaveStatus(t("actions.saving"));
        if (scope && typeof scope.set === "function") {
          Promise.all([
            scope.set("enabled", enabled),
            scope.set("presets", presets),
            scope.set("default_preset", defaultPreset)
          ]).then(() => {
            setSaveStatus(t("actions.saved"));
            setTimeout(() => setSaveStatus(""), 3e3);
          }).catch((err) => {
            console.warn("[dsh-moa] scope.set failed, trying REST fallback:", err);
            doRestSave();
          });
          return;
        }
        doRestSave();
      };
      const doRestSave = () => {
        fetch("/dsh-moa/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled, presets, default_preset: defaultPreset })
        }).then((r) => r.json()).then((res) => {
          if (res && res.ok) {
            if (res.persisted === false) {
              setSaveStatus(t("actions.saved_memory_only"));
            } else {
              setSaveStatus(t("actions.saved"));
            }
            if (Array.isArray(res.presets)) setPresets(res.presets);
            if (res.defaultPreset) setDefaultPreset(res.defaultPreset);
            setTimeout(() => setSaveStatus(""), 3e3);
          } else {
            setSaveStatus((t("status.error_saving") || "Error saving: ") + (res?.error || "failed"));
          }
        }).catch((err) => {
          setSaveStatus((t("status.error_saving") || "Error saving: ") + (err?.message || String(err)));
        });
      };
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
        runUpdate
      };
    }
    class MoAErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }
      componentDidCatch(error, errorInfo) {
        console.error("[dsh-moa] MoAErrorBoundary caught error:", error, errorInfo);
      }
      render() {
        if (this.state.hasError) {
          const t = typeof this.props?.t === "function" ? this.props.t : typeof makeT === "function" ? makeT(en, null) : ((k) => k);
          return React.createElement(
            "div",
            {
              className: "moa-alert-err",
              style: { margin: "12px 0", padding: "14px", borderRadius: "8px" }
            },
            React.createElement("div", { style: { fontWeight: 600, marginBottom: "6px" } }, t("error_boundary.title") || "\u26A0\uFE0F MoA UI Error:"),
            React.createElement("div", { style: { fontSize: "12px", wordBreak: "break-all" } }, String(this.state.error?.message || this.state.error)),
            React.createElement(
              "button",
              {
                type: "button",
                className: "moa-btn",
                style: { marginTop: "10px", fontSize: "12px", padding: "4px 10px" },
                onClick: () => this.setState({ hasError: false, error: null })
              },
              t("error_boundary.retry") || "Retry"
            )
          );
        }
        return this.props.children;
      }
    }
    function MoACard(props) {
      ensureStyles();
      const state = useMoASettings(props);
      const page = !!(props && props.view === "page");
      const [open, setOpen] = React.useState(!!page);
      React.useEffect(() => {
        if (typeof ensureZhIfNeeded === "function") ensureZhIfNeeded();
      }, []);
      if (props && props.view === "summary") {
        return React.createElement("div", { className: "moa-sub" }, state.t("description") || SUBTITLE);
      }
      return React.createElement(
        page ? "div" : "li",
        { className: page ? "moa-page" : "moa-card" },
        React.createElement(
          "button",
          {
            type: "button",
            className: "moa-head",
            style: page ? { display: "none" } : void 0,
            "aria-expanded": open,
            onClick: () => setOpen(!open)
          },
          React.createElement(
            "div",
            null,
            React.createElement("div", { className: "moa-title" }, "\u{1F9E0} " + (state.t("title") || TITLE)),
            React.createElement("div", { className: "moa-sub" }, state.t("description") || SUBTITLE)
          ),
          React.createElement(Chevron, {
            className: open ? "moa-chev moa-chev-open" : "moa-chev"
          })
        ),
        open && React.createElement(
          "div",
          { className: "moa-body" },
          state.status === "loading" ? React.createElement("div", { style: { padding: "16px 0", color: "var(--dsw-alias-label-secondary)", fontSize: 13 } }, state.t("status.loading") || "Loading MoA settings\u2026") : state.status === "unavailable" ? React.createElement(
            "div",
            { style: { padding: "16px 0", display: "flex", flexDirection: "column", gap: 10 } },
            React.createElement("div", { className: "moa-alert-err" }, state.t("status.unavailable") || "MoA service temporarily unavailable"),
            React.createElement(
              "button",
              {
                type: "button",
                className: "moa-btn",
                style: { width: "fit-content" },
                onClick: state.reload
              },
              state.t("status.retry") || state.t("actions.retry")
            )
          ) : React.createElement(MoAEditor, state)
        )
      );
    }
    exports.inject = ["slots", "locale", "inputTriggers", "configForms"];
    exports.apply = function apply(ctx) {
      rootCtx = ctx;
      const addLocale = (locale, dictionary) => {
        try {
          if (ctx.locale && typeof ctx.locale.register === "function") {
            return ctx.locale.register(NS, locale, dictionary);
          }
        } catch {
          return () => {
          };
        }
        return () => {
        };
      };
      if (typeof ctx.effect === "function") {
        ctx.effect(() => {
          const undo = [addLocale("en", en)];
          let alive = true;
          let zhRequested = false;
          const wantsZh = () => {
            try {
              const snap = ctx.locale && typeof ctx.locale.getSnapshot === "function" ? ctx.locale.getSnapshot() : ctx.locale && ctx.locale.snapshot;
              const active = snap && snap.active;
              if (active && /^zh/i.test(String(active))) return true;
              if (typeof document !== "undefined" && document.documentElement && /^zh/i.test(String(document.documentElement.lang || ""))) return true;
              if (typeof navigator !== "undefined" && /^zh/i.test(String(navigator.language || ""))) return true;
              return false;
            } catch {
              return false;
            }
          };
          ensureZhIfNeeded = () => {
            if (!alive || zhRequested || typeof require.async !== "function") return;
            if (!wantsZh()) return;
            zhRequested = true;
            Promise.resolve().then(() => require.async("./client.zh.js")).then((mod) => {
              if (!alive || !mod || !mod.zh) return;
              undo.push(addLocale("zh", mod.zh));
            }).catch((err) => {
              zhRequested = false;
              console.warn("[dsh-moa] Failed to load zh locale chunk:", err);
            });
          };
          ensureZhIfNeeded();
          return () => {
            alive = false;
            ensureZhIfNeeded = null;
            for (const off of undo) {
              if (typeof off === "function") {
                try {
                  off();
                } catch (offErr) {
                }
              }
            }
          };
        }, "dsh-moa: dictionaries");
      } else {
        addLocale("en", en);
      }
      if (ctx.slots) {
        const registerCard = (slotName, key) => () => {
          try {
            ctx.slots.register(
              {
                name: slotName,
                key,
                order: 35,
                locale: NS,
                inject: () => ({ ctx })
              },
              (props) => React.createElement(MoAErrorBoundary, props, React.createElement(MoACard, props))
            );
          } catch (err) {
            console.warn("[dsh-moa] Failed to register " + slotName + ":", err);
          }
        };
        const registerItemSeat = () => {
          try {
            ctx.slots.register(
              {
                name: "plugins.item",
                id: ROW_ID,
                order: 35,
                label: () => "Mixture of Agents (MoA)",
                locale: NS,
                inject: () => ({ ctx })
              },
              (props) => React.createElement(MoAErrorBoundary, props, React.createElement(MoACard, props))
            );
          } catch (err) {
            console.warn("[dsh-moa] Failed to register plugins.item:", err);
          }
        };
        if (typeof ctx.slots.inject === "function") {
          ctx.slots.inject("plugins.item", registerItemSeat);
          ctx.slots.inject("plugins.row.config", registerCard("plugins.row.config", ROW_CONFIG_KEY));
          ctx.slots.inject("settings.plugin.item", registerCard("settings.plugin.item", NS));
        } else {
          registerItemSeat();
          registerCard("plugins.row.config", ROW_CONFIG_KEY)();
          registerCard("settings.plugin.item", NS)();
        }
      }
      ctx.effect(() => {
        const triggers = ctx.get ? ctx.get("inputTriggers") : ctx.inputTriggers;
        if (!triggers || typeof triggers.registerSource !== "function") return () => {
        };
        const dispose = triggers.registerSource({
          trigger: "/",
          name: "moa",
          order: 35,
          description: en["slash.desc"],
          candidates: (_session, req) => {
            if (req.position !== "leading") return Promise.resolve([]);
            const q = req.query.trim().toLowerCase();
            if (q !== "" && !"moa".startsWith(q)) return Promise.resolve([]);
            return Promise.resolve([
              {
                name: "moa",
                description: en["slash.desc"]
              }
            ]);
          },
          onPick: ({ candidate }) => ({
            text: "/" + candidate.name + " "
          }),
          matchSpace: (_session, token) => {
            if (token === "/moa") return { text: "/moa " };
            return void 0;
          },
          matchEnter: (_session, _line) => {
            return Promise.resolve(void 0);
          }
        });
        return () => {
          if (typeof dispose === "function") dispose();
        };
      }, "dsh-moa: slash command trigger");
    };
    return module.exports;
  }
});
