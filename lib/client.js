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
      "aggregator.mutation_gate_desc": "Injects synthetic faults into candidate code to test test-suite robustness, eliminating tautological and weak tests."
    };
    const zh = {
      title: "\u667A\u80FD\u4F53\u6DF7\u5408 (MoA)",
      description: "\u591A\u6A21\u578B\u534F\u540C\u7F16\u6392\uFF1A\u901A\u8FC7 /moa <\u63D0\u793A\u8BCD> \u8FDB\u884C\u5019\u9009\u6A21\u578B\u5E76\u884C\u63D0\u6848\u4E0E\u4E3B\u88C1\u5224\u7EFC\u5408\u3002",
      "header.title": "\u667A\u80FD\u4F53\u6DF7\u5408 (MoA) \u7F16\u6392\u7CFB\u7EDF",
      "header.sub": "\u7531\u591A\u4E2A\u5019\u9009\u63D0\u6848\u6A21\u578B\u5E76\u884C\u751F\u6210\u65B9\u6848\uFF0C\u518D\u7531\u9886\u5148\u7684\u805A\u5408\u88C1\u5224\u6A21\u578B\u8FDB\u884C\u7EC8\u5BA1\u8BC4\u6D4B\u4E0E\u4EE3\u7801\u63D0\u62D4\u3002\u5B8C\u6210\u540E\u81EA\u52A8\u5207\u56DE\u60A8\u7684\u4F1A\u8BDD\u6A21\u578B\u3002",
      "badge.online": "MoA \u5DF2\u542F\u7528",
      "badge.offline": "\u4E3B\u673A\u4E0D\u53EF\u8FBE",
      "badge.preset": "\u9884\u8BBE\uFF1A{name}",
      "badge.models": "{count} \u4E2A\u53EF\u7528\u6A21\u578B",
      "badge.candidates": "{count} \u4E2A\u63D0\u6848\u6A21\u578B",
      "presets.title": "\u{1F4CB} \u9884\u8BBE\u7BA1\u7406",
      "presets.desc": "\u9009\u62E9\u5F53\u524D\u6D3B\u52A8\u9884\u8BBE\u6216\u9488\u5BF9\u7279\u5B9A\u4EFB\u52A1\uFF08\u5982\u4EE3\u7801\u5BA1\u67E5\u3001\u6570\u5B66\u63A8\u6F14\u3001\u5FEB\u901F\u5206\u6D41\uFF09\u521B\u5EFA\u81EA\u5B9A\u4E49\u914D\u7F6E\u3002",
      "presets.active_badge": "\u9ED8\u8BA4\u6FC0\u6D3B",
      "presets.set_default": "\u8BBE\u4E3A\u9ED8\u8BA4",
      "presets.new_btn": "+ \u65B0\u5EFA\u9884\u8BBE",
      "presets.del_btn": "\u5220\u9664",
      "presets.del_confirm": "\u786E\u5B9A\u8981\u5220\u9664\u9884\u8BBE\u201C{name}\u201D\u5417\uFF1F",
      "presets.create": "\u521B\u5EFA",
      "presets.cancel": "\u53D6\u6D88",
      "presets.name_placeholder": "\u65B0\u9884\u8BBE\u540D\u79F0\uFF08\u4F8B\u5982\uFF1Afast-audit\uFF09",
      "aggregator.title": "\u2696\uFE0F \u9886\u5148\u6A21\u578B / \u88C1\u5224\uFF08\u7EFC\u5408\u4E0E\u5BA1\u8BA1\uFF09",
      "aggregator.desc": "\u5BF9\u6BD4\u5019\u9009\u65B9\u6848\uFF0C\u6D88\u9664\u5DEE\u5F02\uFF0C\u8FC7\u6EE4\u5E7B\u89C9\uFF0C\u5E76\u7EFC\u5408\u751F\u6210\u6700\u7EC8\u751F\u4EA7\u7EA7\u89E3\u51B3\u65B9\u6848\u3002",
      "aggregator.temp_label": "\u88C1\u5224\u91C7\u6837\u6E29\u5EA6 (Temperature)",
      "aggregator.temp_hint": "\u63A8\u8350\uFF1A0.2 \u2013 0.4\uFF0C\u4EE5\u786E\u4FDD\u4E25\u683C\u7684\u9A8C\u8BC1\u548C\u786E\u5B9A\u6027\u7684\u4EE3\u7801\u7EFC\u5408\u3002",
      "aggregator.criteria_label": "\u88C1\u5224\u8BC4\u6D4B\u6807\u51C6\uFF08\u53EF\u9009\uFF09\uFF1A",
      "aggregator.criteria_placeholder": "\u4F8B\u5982\uFF1A\u4F18\u5148\u8003\u8651\u9AD8\u6027\u80FD\u3001\u96F6\u5916\u90E8\u4F9D\u8D56\u3001\u5B8C\u5584\u7684\u8FB9\u754C\u5F02\u5E38\u5904\u7406...",
      "aggregator.questions_label": "\u5BF9\u4E8E\u5BBD\u6CDB\u4EFB\u52A1\u5148\u63D0\u51FA\u6F84\u6E05\u95EE\u9898\uFF08\u9700\u6C42\u95EE\u5377\uFF09",
      "aggregator.questions_hint": "\u542F\u7528\u65F6\uFF1A\u5BF9\u4E8E\u7B80\u77ED\u6216\u6A21\u7CCA\u7684\u4EFB\u52A1\uFF0C\u88C1\u5224\u5728\u751F\u6210\u4EE3\u7801\u524D\u4F1A\u5148\u7EFC\u5408\u4E00\u4EFD\u5305\u542B 2\u20134 \u4E2A\u95EE\u9898\u7684\u9009\u9879\u6E05\u5355\u3002",
      "aggregator.curator_label": "\u7B56\u5C55\u4EBA\u7EFC\u5408\u4E0E\u4E3B\u7EC4\u88C5\u6A21\u578B\u5EFA\u8BAE",
      "aggregator.curator_hint": "\u542F\u7528\u65F6\uFF1A\u7B56\u5C55\u4EBA\u4F1A\u63D0\u70BC\u6BCF\u4E2A\u5019\u9009\u65B9\u6848\u7684\u7CBE\u534E\u90E8\u5206\uFF0C\u5E94\u7528\u53CD\u6A21\u5F0F\u6E05\u5355\uFF0C\u5E76\u5EFA\u8BAE\u7531\u54EA\u4E2A\u667A\u80FD\u4F53\u6A21\u578B\u7EC4\u88C5\u6700\u7EC8\u65B9\u6848\u3002",
      "aggregator.stream_label": "\u5B9E\u65F6\u6D41\u5F0F\u4F20\u8F93\u88C1\u5224/\u7B56\u5C55\u4EBA\u601D\u8003\u8FC7\u7A0B",
      "aggregator.stream_hint": "\u5C06\u88C1\u5224\u751F\u6210\u7684\u601D\u8003\u8FC7\u7A0B\u5B9E\u65F6\u63A8\u9001\u5230\u804A\u5929\u6846\uFF0C\u5B9E\u73B0\u96F6\u5EF6\u8FDF\u9996\u5B57\u54CD\u5E94\u3002",
      "aggregator.peer_label": "\u51B3\u7B56\u8BC4\u8BAE\u4F1A\uFF1A\u5019\u9009\u6A21\u578B\u4EA4\u53C9\u4E92\u8BC4\uFF08\u7B2C\u4E8C\u8F6E Consilium\uFF09",
      "aggregator.peer_hint": "\u5728\u4E3B\u88C1\u5224\u7EC8\u5BA1\u524D\uFF0C\u5404\u5019\u9009\u6A21\u578B\u4E92\u76F8\u5BA1\u9605\u5E76\u6539\u8FDB\u5F7C\u6B64\u7684\u65B9\u6848\u4EE3\u7801\u3002",
      "aggregator.override_label": "\u5141\u8BB8\u624B\u52A8\u5019\u9009\u65B9\u6848\u63D0\u62D4\u64CD\u4F5C (Override)",
      "aggregator.override_hint": "\u5728 .moa \u76EE\u5F55\u4E2D\u4FDD\u7559\u5019\u9009\u6A21\u578B\u7684\u5DE5\u4F5C\u533A\uFF0C\u5141\u8BB8\u901A\u8FC7\u804A\u5929\u547D\u4EE4\u63D0\u62D4\u4EFB\u610F\u5019\u9009\u6A21\u578B\u7684\u6587\u4EF6\u3002",
      "aggregator.test_gate_label": "\u6D4B\u8BD5\u95E8\u7981 (\u6C99\u7BB1\u81EA\u52A8\u5316\u6D4B\u8BD5)",
      "aggregator.test_gate_hint": "\u5728\u88C1\u5224\u8BC4\u5BA1\u524D\u5728\u5019\u9009\u6C99\u7BB1\u4E2D\u6267\u884C\u6D4B\u8BD5\u5957\u4EF6\uFF0C\u771F\u5B9E\u6D4B\u8BD5\u7ED3\u679C\u5C06\u6307\u5BFC\u83B7\u80DC\u8005\u8BC4\u9009\u3002",
      "aggregator.test_cmd_placeholder": "\u4F8B\u5982 npm test \u6216 node --test",
      "aggregator.test_timeout_label": "\u6D4B\u8BD5\u8D85\u65F6\u65F6\u95F4 (\u79D2):",
      "proposers.role_label": "\u5DE5\u7A0B\u89D2\u8272\u753B\u50CF\uFF1A",
      "proposers.role_general": "\u901A\u7528\u5E73\u8861 (General)",
      "proposers.role_minimalist": "\u6781\u7B80\u6807\u51C6\u5E93 (Minimalist)",
      "proposers.role_robustness": "\u9632\u5FA1\u9C81\u68D2 (Robustness)",
      "proposers.role_performance": "\u6781\u81F4\u6027\u80FD (Performance)",
      "proposers.role_tester": "\u6D4B\u8BD5\u9A71\u52A8 (Tester)",
      "leaderboard.filter_all": "\u5168\u90E8\u9884\u8BBE",
      "leaderboard.export_csv": "\u5BFC\u51FA CSV",
      "leaderboard.export_json": "\u5BFC\u51FA JSON",
      "aggregator.blind_label": "\u76F2\u5BA1\u6A21\u5F0F\uFF08\u5BF9\u88C1\u5224\u9690\u85CF\u5019\u9009\u6A21\u578B\u540D\u79F0\uFF09",
      "aggregator.blind_hint": "\u542F\u7528\u65F6\uFF1A\u4ECE\u88C1\u5224\u63D0\u793A\u8BCD\u4E2D\u533F\u540D\u5316\u5019\u9009\u6A21\u578B\u7684\u63D0\u4F9B\u5546\u548C\u540D\u79F0\uFF0C\u675C\u7EDD\u54C1\u724C\u504F\u89C1\u3002",
      "aggregator.timeout_label": "\u88C1\u5224\u7EFC\u5408\u8D85\u65F6\u65F6\u957F\uFF08\u79D2\uFF09\uFF1A",
      "proposers.timeout_label": "\u5019\u9009\u6A21\u578B\u751F\u6210\u8D85\u65F6\u65F6\u957F\uFF08\u79D2\uFF09\uFF1A",
      "leaderboard.title": "\u{1F3C6} \u6A21\u578B\u80DC\u7387\u6392\u884C\u699C",
      "leaderboard.desc": "\u57FA\u4E8E\u5386\u53F2\u8BB0\u5F55\u7684 MoA \u88C1\u5224\u8BC4\u6D4B\u5224\u51B3\u6570\u636E\u7EDF\u8BA1\u6307\u6807\u3002",
      "leaderboard.model": "\u6A21\u578B",
      "leaderboard.runs": "\u8FD0\u884C\u6B21\u6570",
      "leaderboard.wins": "\u80DC\u51FA\u6B21\u6570",
      "leaderboard.winrate": "\u80DC\u7387",
      "leaderboard.cost": "\u5E73\u5747\u6210\u672C",
      "leaderboard.empty": "\u6682\u65E0\u5386\u53F2\u8FD0\u884C\u8BB0\u5F55\u3002",
      "aggregator.fallbacks_title": "\u5907\u7528\u88C1\u5224\u94FE",
      "aggregator.fallbacks_desc": "\u5F53\u4E3B\u88C1\u5224\u89E6\u53D1\u901F\u7387\u9650\u5236\u6216\u670D\u52A1\u4E0D\u53EF\u7528\u65F6\uFF0C\u81EA\u52A8\u987A\u5E8F\u8C03\u7528\u7684\u5907\u7528\u6A21\u578B\u3002",
      "aggregator.add_fallback_btn": "+ \u6DFB\u52A0\u5907\u7528\u88C1\u5224",
      "proposers.quorum_label": "\u6CD5\u5B9A\u4EBA\u6570\u5FEB\u8FDB\uFF08\u9632\u62D6\u5C3E\u6A21\u578B\u673A\u5236\uFF09",
      "proposers.quorum_hint": "\u5F53 67% \u4EE5\u4E0A\u5019\u9009\u6A21\u578B\u5B8C\u6210\u65F6\uFF0C\u5F00\u542F\u7F13\u51B2\u5B9A\u65F6\u5668\uFF08\u9ED8\u8BA4 10 \u79D2\uFF09\uFF0C\u4E0D\u518D\u6B7B\u7B49\u5361\u987F\u7684\u6A21\u578B\u3002",
      "proposers.grace_label": "\u7F13\u51B2\u7B49\u5F85\u65F6\u957F\uFF08\u79D2\uFF09\uFF1A",
      "proposers.title": "\u{1F465} \u5019\u9009\u63D0\u6848\u6A21\u578B (Proposers)",
      "proposers.desc": "\u5E76\u884C\u751F\u6210\u4E92\u76F8\u72EC\u7ACB\u7684\u89E3\u51B3\u65B9\u6848\uFF0C\u6700\u5927\u5316\u601D\u8DEF\u591A\u6837\u6027\u4E0E\u89E3\u7A7A\u95F4\u8986\u76D6\u5EA6\u3002",
      "proposers.parallel_count": "\u5E76\u884C\u63D0\u6848\u6A21\u578B\u6570\u91CF",
      "proposers.candidate": "\u5019\u9009\u6A21\u578B",
      "proposers.add_btn": "+ \u6DFB\u52A0\u5019\u9009\u6A21\u578B",
      "proposers.temp_label": "\u5019\u9009\u6A21\u578B\u91C7\u6837\u6E29\u5EA6 (Temperature)",
      "proposers.temp_hint": "\u63A8\u8350\uFF1A0.6 \u2013 0.8\uFF0C\u9F13\u52B1\u521B\u9020\u6027\u3001\u53D1\u6563\u6027\u7684\u72EC\u7ACB\u63A2\u7D22\u3002",
      "proposers.temperature_gradient": "\u6E29\u5EA6\u68AF\u5EA6\u63A2\u7D22\uFF08\u5019\u9009\u6A21\u578B\u91C7\u6837\u6E29\u5EA6\u4ECE 0.2 \u5230 0.9 \u9012\u589E\uFF09",
      "proposers.candidate_temp_tooltip": "\u5019\u9009\u6A21\u578B\u91C7\u6837\u6E29\u5EA6\uFF08\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4/\u68AF\u5EA6\uFF09",
      "stats.title": "\u{1F4C8} MoA \u6570\u636E\u5206\u6790\u4E0E\u9065\u6D4B",
      "stats.desc": "\u4F1A\u8BDD\u9065\u6D4B\u3001\u5386\u53F2\u8FD0\u884C\u8FFD\u8E2A\u53CA\u6A21\u578B\u80DC\u7387\u7EDF\u8BA1\u3002",
      "stats.total_runs": "\u603B\u8FD0\u884C\u6B21\u6570",
      "stats.avg_cost": "\u5E73\u5747\u6BCF\u6B21\u6210\u672C",
      "stats.active_models": "\u5DF2\u914D\u7F6E\u6A21\u578B\u6570",
      "stats.preset_count": "\u9884\u8BBE\u603B\u6570",
      "picker.select": "\u9009\u62E9\u6A21\u578B\u2026",
      "picker.search_placeholder": "\u6309\u540D\u79F0\u6216\u63D0\u4F9B\u5546\u641C\u7D22\u6A21\u578B\u2026",
      "picker.found": "\u627E\u5230",
      "picker.of": "\u5171",
      "picker.clear": "\u6E05\u9664",
      "picker.none": "\u672A\u627E\u5230\u5339\u914D\u7684\u6A21\u578B\u3002",
      "picker.custom": "\u4F7F\u7528\u81EA\u5B9A\u4E49\uFF1A",
      "actions.save": "\u4FDD\u5B58\u914D\u7F6E",
      "actions.saving": "\u6B63\u5728\u4FDD\u5B58\u2026",
      "actions.saved": "\u914D\u7F6E\u5DF2\u6210\u529F\u4FDD\u5B58\uFF01",
      "actions.saved_memory_only": "\u5DF2\u4FDD\u5B58\u5230\u4F1A\u8BDD\u5185\u5B58\uFF08\u672A\u6301\u4E45\u5316\u5230\u78C1\u76D8\uFF09",
      "actions.retry": "\u91CD\u65B0\u52A0\u8F7D\u914D\u7F6E",
      "badge.disabled": "MoA \u5DF2\u7981\u7528",
      "config.enabled_label": "\u542F\u7528 MoA\uFF08\u659C\u6760\u547D\u4EE4\u4E0E\u8F6E\u6B21\u62E6\u622A\u8DEF\u7531\uFF09",
      "slash.desc": "\u4F7F\u7528\u667A\u80FD\u4F53\u6DF7\u5408 (MoA) \u534F\u540C\u7EFC\u5408\u8FD0\u884C\u6B64\u8F6E\u6B21 (/moa [\u9884\u8BBE] <\u63D0\u793A\u8BCD>)",
      "updater.title": "\u63D2\u4EF6\u5728\u7EBF\u66F4\u65B0",
      "updater.desc": "\u68C0\u67E5 npm \u955C\u50CF\u6E90\u4E0A\u7684\u6700\u65B0\u7248\u672C\u5E76\u652F\u6301\u4E00\u952E\u65E0\u611F\u5347\u7EA7\u3002",
      "updater.btnCheck": "\u68C0\u67E5\u66F4\u65B0",
      "updater.btnUpdate": "\u5347\u7EA7\u81F3 v{version}",
      "updater.checking": "\u6B63\u5728\u68C0\u67E5\u7248\u672C...",
      "updater.updating": "\u6B63\u5728\u6267\u884C\u66F4\u65B0...",
      "updater.current": "\u5F53\u524D\u7248\u672C\uFF1Av{version}",
      "updater.available": "\u53D1\u73B0\u65B0\u7248\u672C\uFF1Av{version}",
      "updater.upToDate": "\u5DF2\u662F\u6700\u65B0\u7248\u672C",
      "updater.checkFailed": "\u68C0\u67E5\u7248\u672C\u5931\u8D25",
      "diff.title": "\u5019\u9009\u65B9\u6848\u5DEE\u5F02\u67E5\u770B\u5668 (Diff Viewer)",
      "diff.desc": "\u5728\u9879\u76EE\u5DE5\u4F5C\u533A\u4E2D\u53EF\u89C6\u5316\u68C0\u67E5\u5019\u9009\u65B9\u6848\u4E0E\u88C1\u5224\u5408\u6210\u65B9\u6848\u4E4B\u95F4\u7684\u6587\u4EF6\u5DEE\u5F02\u3002",
      "diff.select_from": "\u57FA\u51C6\u65B9\u6848\uFF1A",
      "diff.select_to": "\u5BF9\u6BD4\u76EE\u6807\uFF1A",
      "diff.select_file": "\u6587\u4EF6\uFF1A",
      "diff.no_files": "\u5728\u5019\u9009\u5DE5\u4F5C\u533A (.moa) \u4E2D\u672A\u53D1\u73B0\u6587\u4EF6\u3002\u8BF7\u5148\u8FD0\u884C /moa \u751F\u6210\u5019\u9009\u4EE3\u7801\u3002",
      "diff.refresh": "\u5237\u65B0\u5DEE\u5F02",
      "diff.loading": "\u6B63\u5728\u52A0\u8F7D\u5DEE\u5F02...",
      "diff.curator": "\u88C1\u5224\u5408\u6210 (Curator Synthesis)",
      "diff.candidate": "\u5019\u9009\u65B9\u6848 {num}",
      "diff.empty": "\u9009\u4E2D\u7684\u6587\u4EF6\u5B8C\u5168\u4E00\u81F4\uFF08\u65E0\u5DEE\u5F02\uFF09\u3002",
      // Multi-Judge
      "aggregator.multi_judge_title": "\u591A\u88C1\u5224\u59D4\u5458\u4F1A\u4E0E\u5171\u8BC6\u6295\u7968",
      "aggregator.multi_judge_desc": "\u90E8\u7F72\u591A\u4E2A\u88C1\u5224\u6A21\u578B\u5BF9\u5019\u9009\u65B9\u6848\u6253\u5206\u5E76\u901A\u8FC7\u5171\u8BC6\u6295\u7968\u8BC4\u5B9A\u83B7\u80DC\u8005\u3002",
      "aggregator.voting_strategy_label": "\u6295\u7968\u7B56\u7565\uFF1A",
      "aggregator.voting_majority": "\u591A\u6570\u51B3",
      "aggregator.voting_highest_score": "\u6700\u9AD8\u5206",
      "aggregator.voting_unanimous": "\u5168\u7968\u901A\u8FC7",
      "aggregator.judge_models_title": "\u88C1\u5224\u6A21\u578B\u5217\u8868",
      "aggregator.judge_models_desc": "\u6307\u5B9A 2 \u4E2A\u6216\u66F4\u591A\u88C1\u5224\u6A21\u578B\u4EE5\u5B9E\u73B0\u59D4\u5458\u4F1A\u5171\u8BC6\u3002",
      "aggregator.add_judge_btn": "+ \u6DFB\u52A0\u88C1\u5224\u6A21\u578B",
      "aggregator.judge_badge": "\u88C1\u5224 #{num}",
      "aggregator.judge_models_empty": "\u5171\u8BC6\u6295\u7968\u81F3\u5C11\u9700\u8981\u914D\u7F6E 2 \u4E2A\u88C1\u5224\u6A21\u578B\u3002",
      // Composite
      "aggregator.composite_title": "\u6DF7\u5408\u590D\u5408\u7EFC\u5408 (AST / \u4EE3\u7801\u5757\u5408\u5E76)",
      "aggregator.composite_desc": "\u4ECE\u591A\u4E2A\u5019\u9009\u65B9\u6848\u4E2D\u63D0\u53D6\u6A21\u5757\u5316\u4EE3\u7801\u5757\u3001\u7C7B\u578B\u5B9A\u4E49\u4E0E\u7B97\u6CD5\u5E76\u7EFC\u5408\u4E3A\u7EDF\u4E00\u65B9\u6848\u3002",
      // Budget
      "aggregator.budget_title": "\u6210\u672C\u9884\u7B97\u62A4\u680F\u4E0E\u81EA\u52A8\u5206\u6D41",
      "aggregator.budget_desc": "\u9650\u5236\u5355\u6B21\u6700\u9AD8\u82B1\u8D39\uFF1B\u81EA\u52A8\u524A\u51CF\u5019\u9009\u6A21\u578B\u6216\u4E2D\u6B62\u4EE5\u9632\u6B62\u8D85\u989D\u6D88\u8017\u3002",
      "aggregator.budget_max_usd": "\u6700\u9AD8\u91D1\u989D ($):",
      "aggregator.budget_action": "\u5904\u7F6E\u65B9\u5F0F\uFF1A",
      "aggregator.budget_action_trim": "\u524A\u51CF\u5019\u9009",
      "aggregator.budget_action_abort": "\u4E2D\u6B62\u8FD0\u884C",
      // Reports
      "aggregator.report_title": "\u81EA\u52A8\u5316\u57FA\u51C6\u4E0E\u590D\u76D8\u62A5\u544A",
      "aggregator.report_desc": "\u751F\u6210\u53EF\u4E0B\u8F7D\u7684 Markdown \u4E0E JSON \u62A5\u544A\uFF0C\u8BE6\u7EC6\u8BB0\u5F55\u5019\u9009\u65B9\u6848\u8017\u65F6\u3001\u4E00\u81F4\u6027\u3001\u6D4B\u8BD5\u95E8\u7981\u4E0E\u6210\u672C\u5206\u5E03\u3002",
      // Local Fallback
      "aggregator.local_fallback_title": "\u4F18\u96C5\u964D\u7EA7\u4E0E\u672C\u5730\u5907\u7528\u6A21\u578B",
      "aggregator.local_fallback_desc": "\u5728\u7EBF\u5019\u9009\u6A21\u578B API \u6545\u969C\u65F6\u81EA\u52A8\u964D\u7EA7\u5230\u672C\u5730 Ollama / MiniPC \u6A21\u578B\u3002",
      "aggregator.local_models_title": "\u672C\u5730\u5907\u7528\u6A21\u578B\u5217\u8868",
      "aggregator.local_models_desc": "\u4E91\u7AEF\u5019\u9009 API \u5F02\u5E38\u65F6\u8C03\u7528\u7684\u672C\u5730\u79BB\u7EBF\u6A21\u578B\u3002",
      "aggregator.add_local_btn": "+ \u6DFB\u52A0\u672C\u5730\u6A21\u578B",
      "aggregator.local_badge": "\u672C\u5730 #{num}",
      "aggregator.local_models_empty": "\u8BF7\u81F3\u5C11\u914D\u7F6E\u4E00\u4E2A\u672C\u5730\u5907\u7528\u6A21\u578B\uFF08\u4F8B\u5982 Ollama\uFF09\u3002",
      // Smart Routing Model
      "config.smart_routing_title": "\u667A\u80FD\u63D0\u793A\u8BCD\u5206\u6D41",
      "config.smart_routing_desc": "\u5206\u6790\u4EFB\u52A1\u590D\u6742\u5EA6\u5E76\u81EA\u52A8\u5339\u914D\u6700\u4F73\u9884\u8BBE\u3002",
      "config.smart_routing_model": "\u5206\u6D41\u51B3\u7B56\u6A21\u578B\uFF1A",
      // Multi-Turn Context
      "aggregator.context_pruning_title": "\u2702\uFE0F \u5019\u9009\u8DE8\u6A21\u578B\u4E0A\u4E0B\u6587\u7CBE\u7B80 (Judge \u4EC5\u5DEE\u5F02\u8865\u4E01)",
      "aggregator.context_pruning_desc": "\u5728 Judge \u63D0\u793A\u8BCD\u4E2D\u5C06\u672A\u4FEE\u6539\u7684\u57FA\u7840\u9879\u76EE\u6587\u4EF6\u66FF\u6362\u4E3A\u7D27\u51D1\u7684\u7EDF\u4E00\u5DEE\u5F02\u5757 (---/+++)\uFF0C\u5728\u5927\u6587\u4EF6\u573A\u666F\u4E0B\u524A\u51CF\u9AD8\u8FBE 85% \u7684\u63D0\u793A\u8BCD Token\u3002",
      "aggregator.context_pruning_lines": "\u5DEE\u5F02\u4E0A\u4E0B\u6587\u884C\u6570:",
      "aggregator.semantic_cache_title": "\u26A1 \u5019\u9009\u751F\u6210\u8BED\u4E49\u7F13\u5B58",
      "aggregator.semantic_cache_desc": "\u901A\u8FC7\u786E\u5B9A\u7684 SHA-256 \u6307\u7EB9\u5728\u672C\u5730\u6301\u4E45\u5316\u5019\u9009\u6A21\u578B\u4E2D\u95F4\u8F93\u51FA\uFF0C\u5728\u91CD\u8BD5\u6216\u91CD\u590D\u8FED\u4EE3\u4E2D\u6D88\u9664\u5197\u4F59 API \u8D39\u7528\u3002",
      "aggregator.semantic_cache_ttl": "\u7F13\u5B58\u6709\u6548\u671F (\u5C0F\u65F6):",
      "aggregator.multi_turn_title": "\u591A\u8F6E\u5BF9\u8BDD\u4E0A\u4E0B\u6587\u4E0E\u5DEE\u5F02\u526A\u679D",
      "aggregator.multi_turn_desc": "\u8DE8\u8F6E\u6B21\u4FDD\u7559\u5BF9\u8BDD\u4E0A\u4E0B\u6587\u5E76\u526A\u679D\u91CD\u590D\u4EE3\u7801\u5757\u3002",
      // UI States & Errors
      "status.loading": "\u6B63\u5728\u52A0\u8F7D MoA \u8BBE\u7F6E\u2026",
      "status.unavailable": "MoA \u670D\u52A1\u6682\u4E0D\u53EF\u7528",
      "status.retry": "\u91CD\u8BD5",
      "status.error_saving": "\u4FDD\u5B58\u5931\u8D25\uFF1A",
      "error_boundary.title": "\u26A0\uFE0F MoA \u754C\u9762\u9519\u8BEF\uFF1A",
      "error_boundary.retry": "\u91CD\u8BD5",
      // Diff Viewer
      "diff.select_run": "\u8FD0\u884C\u8BB0\u5F55\uFF1A",
      "diff.latest_run": "\u6700\u65B0 / \u5F53\u524D\u5DE5\u4F5C\u533A",
      "updater.success": "\u6210\u529F\u66F4\u65B0\u81F3 v{version}\uFF0C\u8BF7\u91CD\u542F DSH \u4F7F\u5176\u751F\u6548\u3002",
      // Interactive Workbench (#251)
      "aggregator.workbench_title": "\u{1F6E0}\uFE0F \u4EA4\u4E92\u5F0F\u5DE5\u4F5C\u53F0 (1-10\u5206\u6587\u4EF6\u6253\u5206\u4E0E\u6700\u4F18\u6A21\u578B\u7C98\u5408)",
      "aggregator.workbench_desc": "\u88C1\u5224\u4E3A\u6BCF\u4E2A\u5019\u9009\u6587\u4EF6\u6253\u5206 (1-10) \u5E76\u6807\u6CE8\u4F18\u7F3A\u70B9\u3002\u5728 UI \u4E2D\u81EA\u7531\u7EC4\u5408\u5404\u5019\u9009\u6587\u4EF6\uFF0C\u7531\u5F53\u8F6E\u6700\u9AD8\u5206\u6A21\u578B\u8FDB\u884C\u4EE3\u7801\u7C98\u5408\u7EDF\u4E00\uFF0C\u6700\u7EC8\u7531\u88C1\u5224\u590D\u5BA1\u3002",
      "aggregator.workbench_companion": "\u914D\u5957\u63D2\u4EF6\uFF1A",
      "aggregator.workbench_companion_note": "\u6587\u4EF6\u63D0\u5347\u524D\u5B89\u5168\u521B\u5EFA\u5F71\u5B50 Git \u5FEB\u7167",
      "aggregator.preflight_syntax_title": "\u{1F50D} \u8BC4\u5BA1\u524D\u672C\u5730\u8BED\u6CD5\u68C0\u67E5\u95E8\u7981\uFF08\u96F6Token\u5F00\u9500\uFF09",
      "aggregator.preflight_syntax_desc": "\u5728\u8C03\u7528\u88C1\u5224\u6A21\u578B\u524D\u5BF9\u5019\u9009\u4EE3\u7801\u8FDB\u884C\u672C\u5730\u8BED\u6CD5\u68C0\u67E5\uFF0C\u96F6Token\u5254\u9664\u8BED\u6CD5\u7834\u635F\u4EE3\u7801\u3002",
      "aggregator.early_consensus_title": "\u26A1 \u8BED\u4E49\u5171\u8BC6\u5FEB\u901F\u76F4\u51FA\uFF08Early Exit\uFF09",
      "aggregator.early_consensus_desc": "\u5F53\u591A\u5019\u9009\u6A21\u578B\u751F\u6210\u4E00\u81F4\u4EE3\u7801\uFF08\u76F8\u4F3C\u5EA6\u8FBE\u6807\uFF09\u65F6\uFF0C\u76F4\u63A5\u8FD4\u56DE\u5171\u8BC6\u89E3\uFF0C\u8DF3\u8FC7\u88C1\u5224\u9636\u6BB5\u8282\u7EA6Token\u4E0E\u8017\u65F6\u3002",
      "workbench.title": "\u{1F6E0}\uFE0F \u4EA4\u4E92\u5F0F\u5408\u6210\u5DE5\u4F5C\u53F0",
      "workbench.desc": "\u67E5\u770B\u5019\u9009\u6A21\u578B\u7684\u6587\u4EF6\u8D28\u91CF\u6253\u5206 (1\u201310)\uFF0C\u81EA\u7531\u6DF7\u642D\u7EC4\u5408\u76EE\u6807\u6587\u4EF6\uFF0C\u7531\u6700\u9AD8\u5206\u6A21\u578B\u7C98\u5408\u7EDF\u4E00\u5E76\u6267\u884C\u6700\u7EC8\u88C1\u5224\u590D\u5BA1\u3002",
      "workbench.select_run": "MoA \u8FD0\u884C\uFF1A",
      "workbench.latest_run": "\u9009\u62E9\u8FD0\u884C\u8BB0\u5F55\u2026",
      "workbench.no_runs": "\u6682\u65E0\u751F\u6210\u6587\u4EF6\u7684 MoA \u8BB0\u5F55\u3002",
      "workbench.empty_files": "\u6B64\u8FD0\u884C\u8BB0\u5F55\u672A\u53D1\u73B0\u5019\u9009\u6587\u4EF6\u3002",
      "workbench.file_header": "\u9879\u76EE\u6587\u4EF6",
      "workbench.candidate_header": "\u5019\u9009\u7248\u672C\u4E0E\u8BC4\u5206 (1-10)",
      "workbench.instructions_label": "\u7C98\u5408\u534F\u540C\u6307\u4EE4\uFF08\u53EF\u9009\uFF09\uFF1A",
      "workbench.instructions_placeholder": "\u4F8B\u5982\uFF1A\u5BF9\u9F50\u5BFC\u5165\u8DEF\u5F84\u3001\u7EDF\u4E00 TypeScript \u7C7B\u578B\u3001\u89C4\u8303\u5BFC\u51FA\u63A5\u53E3...",
      "workbench.assemble_btn": "\u{1F680} \u7C98\u5408\u4E0E\u88C5\u914D (\u6700\u4F18\u6A21\u578B)",
      "workbench.assembling": "\u23F3 \u6B63\u5728\u901A\u8FC7\u6700\u4F18\u6A21\u578B\u534F\u540C\u7C98\u5408\u6587\u4EF6...",
      "workbench.recheck_title": "\u2696\uFE0F \u88C1\u5224\u590D\u5BA1\u5224\u5B9A",
      "workbench.audit_passed": "\u901A\u8FC7 (PASSED)",
      "workbench.audit_failed": "\u672A\u901A\u8FC7 (FAILED)",
      "workbench.promote_btn": "\u63D0\u5347\u7C98\u5408\u7ED3\u679C\u81F3\u9879\u76EE\u6839\u76EE\u5F55",
      "workbench.promoted_ok": "\u2705 \u7C98\u5408\u65B9\u6848\u5DF2\u6210\u529F\u63D0\u5347\u81F3\u9879\u76EE\u5DE5\u4F5C\u533A\uFF01",
      "workbench.pros": "\u4F18\u52BF\uFF1A",
      "workbench.cons": "\u4E0D\u8DB3\uFF1A",
      "aggregator.self_consistency_title": "\u{1F3B2} \u5355\u6A21\u578B\u81EA\u6D3D\u6027\u6E29\u5EA6\u91C7\u6837 (Self-Consistency)",
      "aggregator.self_consistency_desc": "\u5728\u4EC5\u914D\u7F6E\u5355\u6A21\u578B\u65F6\uFF0C\u751F\u6210\u4E0D\u540C\u6E29\u5EA6\u4E0E\u89D2\u8272\u7684\u591A\u4E2A\u5E76\u884C\u5019\u9009\u65B9\u6848\uFF0C\u8BA9\u672C\u5730 Ollama \u6216\u5355 Key \u4E5F\u4EAB\u6709 MoA \u805A\u5408\u4F18\u52BF\u3002",
      "aggregator.self_consistency_samples": "\u91C7\u6837\u6570:",
      "aggregator.escalation_title": "\u2696\uFE0F \u52A8\u6001\u5171\u8BC6\u9608\u503C\u4E0E\u88C1\u5224\u5347\u7EA7 (Judge Escalation)",
      "aggregator.escalation_desc": "\u68C0\u6D4B\u5019\u9009\u65B9\u6848\u95F4\u7684\u5206\u6B67\u5EA6\u3002\u5F53\u5171\u8BC6\u8F83\u5F31\u65F6\uFF0C\u81EA\u52A8\u5347\u7EA7\u81F3\u9AD8\u9636\u65D7\u8230\u88C1\u5224\u6216\u7EC4\u5EFA 3 \u88C1\u5224\u591A\u6570\u5E2D\u3002",
      "aggregator.escalation_policy": "\u5347\u7EA7\u7B56\u7565:",
      "aggregator.escalation_policy_single": "\u6807\u51C6\u5355\u88C1\u5224 (\u4E0D\u5347\u7EA7)",
      "aggregator.escalation_policy_upgrade": "\u5206\u6B67\u65F6\u81EA\u52A8\u5347\u7EA7\u81F3\u9AD8\u9636\u88C1\u5224",
      "aggregator.escalation_policy_council": "\u5206\u6B67\u65F6\u7EC4\u5EFA 3 \u88C1\u5224\u591A\u6570\u51B3\u7B56\u5E2D",
      "aggregator.escalation_threshold": "\u5206\u6B67\u9608\u503C:",
      "aggregator.escalation_judge_label": "\u9AD8\u9636\u88C1\u5224\u6A21\u578B:",
      "aggregator.stack_personas_title": "\u{1F4E6} \u57FA\u4E8E\u9879\u76EE\u914D\u7F6E\u6E05\u5355\u7684\u611F\u77E5\u89D2\u8272\u6F14\u5316 (Stack-Aware Personas)",
      "aggregator.stack_personas_desc": "\u81EA\u52A8\u626B\u63CF\u9879\u76EE\u6E05\u5355 (package.json, Cargo.toml, pyproject.toml, go.mod) \u5E76\u4E3A\u5404\u5019\u9009\u69FD\u4F4D\u6307\u6D3E\u4E13\u5C5E\u4E13\u4E1A\u89D2\u8272\u3002",
      "aggregator.preferences_title": "\u{1F9E0} \u81EA\u5B66\u4E60\u5F00\u53D1\u8005\u4EE3\u7801\u504F\u597D\u5143\u63D0\u793A\u8BCD (Developer Preferences)",
      "aggregator.preferences_desc": "\u5C06\u5F00\u53D1\u8005\u504F\u597D\uFF08\u4E25\u683C\u7C7B\u578B\u3001\u51FD\u6570\u4E0D\u53EF\u53D8\u6027\u3001\u9632\u5FA1\u6027\u9519\u8BEF\u5904\u7406\u7B49\uFF09\u6CE8\u5165\u88C1\u5224\u7EFC\u5408\u8BC4\u5BA1\u9636\u6BB5\u3002",
      "aggregator.security_gate_title": "\u{1F6E1}\uFE0F \u5BF9\u6297\u6027\u767D\u5E3D\u5B89\u5168\u6A21\u7CCA\u6D4B\u8BD5\u5173\u5361",
      "aggregator.security_gate_desc": "\u7EA2\u961F\u5B89\u5168\u5BA1\u8BA1\u5668\u68C0\u67E5\u5019\u9009\u65B9\u6848\u4E2D\u7684 SQLi\u3001XSS\u3001ReDoS\u3001\u547D\u4EE4\u6CE8\u5165\u548C\u8DEF\u5F84\u7A7F\u8D8A\u6F0F\u6D1E\uFF0C\u5E76\u5728\u53D1\u73B0\u4E25\u91CD\u6F0F\u6D1E\u65F6\u89E6\u53D1 SECURITY_VETO \u5426\u51B3\u3002",
      "aggregator.cove_gate_title": "\u{1F50D} \u9A8C\u8BC1\u94FE (CoVe) \u4EE3\u7801\u4E8B\u5B9E\u4E0E API \u6838\u67E5\u5173\u5361",
      "aggregator.cove_gate_desc": "\u751F\u6210 API \u5B58\u5728\u6027\u4E0E\u65B9\u6CD5\u7B7E\u540D\u6838\u9A8C\u95EE\u9898\uFF0C\u81EA\u52A8\u60E9\u7F5A\u6216\u53D6\u6D88\u4F7F\u7528\u865A\u6784\u5E7B\u89C9\u65B9\u6CD5\u7684\u5019\u9009\u65B9\u6848\u3002",
      "aggregator.profiler_gate_title": "\u26A1 \u81EA\u52A8\u8FD0\u884C\u65F6 CPU \u4E0E\u5185\u5B58\u6027\u80FD\u5206\u6790\u5173\u5361",
      "aggregator.profiler_gate_desc": "\u5728\u9694\u79BB\u6C99\u7BB1\u4E2D\u8FD0\u884C\u5FAE\u57FA\u51C6\u6D4B\u8BD5\uFF0C\u7CBE\u786E\u5EA6\u91CF\u6267\u884C\u5EF6\u8FDF\u3001\u541E\u5410\u91CF (ops/sec) \u548C\u5806\u5185\u5B58\u5206\u914D\u3002",
      "aggregator.mutation_gate_title": "\u{1F9EC} \u5019\u9009\u6D4B\u8BD5\u5957\u4EF6\u8FD0\u884C\u65F6\u53D8\u5F02\u6D4B\u8BD5\u5173\u5361",
      "aggregator.mutation_gate_desc": "\u5411\u4EE3\u7801\u6CE8\u5165\u5408\u6210\u6545\u969C\u5E76\u9A8C\u8BC1\u6D4B\u8BD5\u7684\u6355\u83B7\u80FD\u529B\uFF0C\u5254\u9664\u540C\u4E49\u53CD\u590D\u4E0E\u65E0\u6548\u7684\u865A\u5047\u6D4B\u8BD5\u3002"
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
    function CandidateDiffSection({ t, currentRefs = [] }) {
      const [fromCandidate, setFromCandidate] = React.useState("1");
      const [toCandidate, setToCandidate] = React.useState("curator-synthesis");
      const [selectedFile, setSelectedFile] = React.useState("");
      const [files, setFiles] = React.useState([]);
      const [diff, setDiff] = React.useState([]);
      const [fromSize, setFromSize] = React.useState(0);
      const [toSize, setToSize] = React.useState(0);
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [hasFetched, setHasFetched] = React.useState(false);
      const [historyRuns, setHistoryRuns] = React.useState([]);
      const [selectedRunId, setSelectedRunId] = React.useState("");
      React.useEffect(() => {
        fetch("/dsh-moa/history?limit=30", { cache: "no-store" }).then((r) => r.json()).then((data) => {
          if (data && data.ok && Array.isArray(data.runs)) {
            setHistoryRuns(data.runs);
          }
        }).catch(() => {
        });
      }, []);
      const selectedRun = historyRuns.find((r) => r.id === selectedRunId);
      const candidateCount = selectedRun && Array.isArray(selectedRun.candidates) && selectedRun.candidates.length > 0 ? selectedRun.candidates.length : Math.max(currentRefs.length || 0, 2);
      const candidateOptions = [];
      for (let i = 1; i <= candidateCount; i++) {
        candidateOptions.push({
          value: String(i),
          label: (t("diff.candidate") || "Candidate {num}").replace("{num}", String(i))
        });
      }
      const loadDiff = React.useCallback((targetFile = selectedFile) => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (selectedRunId) params.set("runId", selectedRunId);
        if (fromCandidate) params.set("from", fromCandidate);
        if (toCandidate) params.set("to", toCandidate);
        if (targetFile) params.set("file", targetFile);
        fetch("/dsh-moa/diff?" + params.toString(), { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then((data) => {
          setLoading(false);
          setHasFetched(true);
          if (data && data.ok) {
            const fileList = Array.isArray(data.files) ? data.files : [];
            setFiles(fileList);
            setDiff(Array.isArray(data.diff) ? data.diff : []);
            setFromSize(data.fromSize || 0);
            setToSize(data.toSize || 0);
            if (data.selectedFile && data.selectedFile !== targetFile) {
              setSelectedFile(data.selectedFile);
            }
          } else {
            setError(data?.error || "Failed to load diff");
          }
        }).catch((err) => {
          setLoading(false);
          setHasFetched(true);
          setError(err.message || String(err));
        });
      }, [fromCandidate, toCandidate, selectedFile, selectedRunId]);
      React.useEffect(() => {
        loadDiff();
      }, [fromCandidate, toCandidate, selectedRunId]);
      const handleFileChange = (e) => {
        const nextFile = e.target.value;
        setSelectedFile(nextFile);
        loadDiff(nextFile);
      };
      const adds = diff.filter((d) => d.type === "added").length;
      const dels = diff.filter((d) => d.type === "removed").length;
      return React.createElement(
        "div",
        { className: "moa-section-card" },
        React.createElement("div", { className: "moa-section-title" }, t("diff.title") || "\u{1F50D} Candidate Diff Viewer"),
        React.createElement("div", { className: "moa-section-desc" }, t("diff.desc") || "Visually inspect differences between candidate solutions and judge synthesis in the project workspace."),
        React.createElement(
          "div",
          { className: "moa-diff-container" },
          /* Controls bar */
          React.createElement(
            "div",
            { className: "moa-diff-controls" },
            /* Run selector dropdown (#179) */
            React.createElement(
              "label",
              { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary)" } },
              t("diff.select_run") || "Run:",
              React.createElement(
                "select",
                {
                  className: "moa-diff-select",
                  value: selectedRunId,
                  onChange: (e) => setSelectedRunId(e.target.value)
                },
                React.createElement("option", { value: "" }, t("diff.latest_run") || "Latest / Active Workspace"),
                historyRuns.map((r) => {
                  const label = `${r.preset || "default"} [${(r.id || "").slice(0, 8)}] ${(r.prompt || "").slice(0, 24)}...`;
                  return React.createElement("option", { key: r.id, value: r.id }, label);
                })
              )
            ),
            React.createElement(
              "label",
              { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary)" } },
              t("diff.select_from") || "Base:",
              React.createElement(
                "select",
                {
                  className: "moa-diff-select",
                  value: fromCandidate,
                  onChange: (e) => setFromCandidate(e.target.value)
                },
                candidateOptions.map((opt) => React.createElement("option", { key: opt.value, value: opt.value }, opt.label)),
                React.createElement("option", { value: "curator-synthesis" }, t("diff.curator") || "Curator Synthesis")
              )
            ),
            React.createElement(
              "label",
              { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary)" } },
              t("diff.select_to") || "Compare with:",
              React.createElement(
                "select",
                {
                  className: "moa-diff-select",
                  value: toCandidate,
                  onChange: (e) => setToCandidate(e.target.value)
                },
                React.createElement("option", { value: "curator-synthesis" }, t("diff.curator") || "Curator Synthesis"),
                candidateOptions.map((opt) => React.createElement("option", { key: opt.value, value: opt.value }, opt.label))
              )
            ),
            files.length > 0 && React.createElement(
              "label",
              { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary)" } },
              t("diff.select_file") || "File:",
              React.createElement(
                "select",
                {
                  className: "moa-diff-select",
                  value: selectedFile || files[0] || "",
                  onChange: handleFileChange
                },
                files.map((f) => React.createElement("option", { key: f, value: f }, f))
              )
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "moa-btn moa-btn-sub",
                onClick: () => loadDiff(),
                disabled: loading
              },
              loading ? t("diff.loading") || "Loading..." : t("diff.refresh") || "Refresh Diff"
            ),
            diff.length > 0 && React.createElement(
              "div",
              { style: { fontSize: 12, display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" } },
              adds > 0 && React.createElement("span", { className: "moa-diff-stat-add" }, `+${adds}`),
              dels > 0 && React.createElement("span", { className: "moa-diff-stat-del" }, `-${dels}`),
              fromSize > 0 && toSize > 0 && React.createElement(
                "span",
                { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 11 } },
                `(${fromSize}B \u2192 ${toSize}B)`
              )
            )
          ),
          /* Error state */
          error && React.createElement(
            "div",
            { className: "moa-alert-err", style: { fontSize: 12, padding: "8px 12px" } },
            error
          ),
          /* Empty files state */
          !error && !loading && hasFetched && files.length === 0 && React.createElement(
            "div",
            { style: { padding: "16px 12px", textAlign: "center", color: "var(--dsw-alias-label-secondary)", fontSize: 13, background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8 } },
            t("diff.no_files") || "No files found in candidate workspaces (.moa). Run a task with /moa to generate candidate code."
          ),
          /* Identical content state */
          !error && !loading && files.length > 0 && diff.length > 0 && adds === 0 && dels === 0 && React.createElement(
            "div",
            { style: { padding: "12px", textAlign: "center", color: "var(--dsw-alias-state-success-primary)", fontSize: 12, background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8 } },
            t("diff.empty") || "Selected files are identical (zero diff)."
          ),
          /* Diff lines display */
          !error && files.length > 0 && diff.length > 0 && (adds > 0 || dels > 0) && React.createElement(
            "div",
            { className: "moa-diff-box" },
            diff.map((item, idx) => {
              const isAdd = item.type === "added";
              const isDel = item.type === "removed";
              const lineClass = isAdd ? "moa-diff-line moa-diff-line-add" : isDel ? "moa-diff-line moa-diff-line-del" : "moa-diff-line moa-diff-line-same";
              const prefix = isAdd ? "+" : isDel ? "-" : " ";
              return React.createElement(
                "div",
                { key: idx, className: lineClass },
                React.createElement("span", { className: "moa-diff-prefix" }, prefix),
                React.createElement("span", { className: "moa-diff-content" }, item.line)
              );
            })
          )
        )
      );
    }
    function InteractiveWorkbenchSection({ t, currentRefs = [] }) {
      const [historyRuns, setHistoryRuns] = React.useState([]);
      const [selectedRunId, setSelectedRunId] = React.useState("");
      const [workbenchData, setWorkbenchData] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [selections, setSelections] = React.useState({});
      const [instructions, setInstructions] = React.useState("");
      const [assembling, setAssembling] = React.useState(false);
      const [assembleResult, setAssembleResult] = React.useState(null);
      const [assembleError, setAssembleError] = React.useState(null);
      const [promoting, setPromoting] = React.useState(false);
      const [promoted, setPromoted] = React.useState(false);
      React.useEffect(() => {
        fetch("/dsh-moa/history?limit=30", { cache: "no-store" }).then((r) => r.json()).then((data) => {
          if (data && data.ok && Array.isArray(data.runs)) {
            setHistoryRuns(data.runs);
            if (!selectedRunId && data.runs.length > 0) {
              const runWithFiles = data.runs.find((r) => r.candidates?.some((c) => c.files?.length > 0)) || data.runs[0];
              if (runWithFiles?.id) setSelectedRunId(runWithFiles.id);
            }
          }
        }).catch(() => {
        });
      }, []);
      React.useEffect(() => {
        if (!selectedRunId) return;
        setLoading(true);
        setError(null);
        setAssembleResult(null);
        setAssembleError(null);
        setPromoted(false);
        fetch("/dsh-moa/runs/" + encodeURIComponent(selectedRunId) + "/workbench", { cache: "no-store" }).then(async (r) => {
          if (!r.ok) {
            const errJson = await r.json().catch(() => ({}));
            throw new Error(errJson.error || "HTTP " + r.status);
          }
          return r.json();
        }).then((data) => {
          setWorkbenchData(data);
          const initial = {};
          if (data && data.fileScores && data.fileScores.byFile) {
            for (const [file, scores] of Object.entries(data.fileScores.byFile)) {
              if (Array.isArray(scores) && scores.length > 0) {
                const sorted = [...scores].sort((a, b) => (b.score || 0) - (a.score || 0));
                initial[file] = sorted[0].candidateIndex;
              }
            }
          } else if (data && Array.isArray(data.candidates)) {
            for (const cand of data.candidates) {
              for (const f of cand.files || []) {
                if (!initial[f.relativePath]) initial[f.relativePath] = cand.index;
              }
            }
          }
          setSelections(initial);
        }).catch((err) => {
          setError(err?.message || String(err));
        }).finally(() => setLoading(false));
      }, [selectedRunId]);
      const handleAssemble = () => {
        if (!selectedRunId || Object.keys(selections).length === 0) return;
        setAssembling(true);
        setAssembleResult(null);
        setAssembleError(null);
        setPromoted(false);
        const selArray = Object.entries(selections).map(([file, candidateIndex]) => ({
          file,
          candidateIndex: Number(candidateIndex)
        }));
        fetch("/dsh-moa/runs/" + encodeURIComponent(selectedRunId) + "/workbench/assemble", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selections: selArray,
            instructions,
            autoPromote: false
          })
        }).then(async (r) => {
          const resJson = await r.json().catch(() => ({}));
          if (!r.ok || !resJson.ok) {
            throw new Error(resJson.error || "HTTP " + r.status);
          }
          return resJson;
        }).then((data) => {
          setAssembleResult(data);
        }).catch((err) => {
          setAssembleError(err?.message || String(err));
        }).finally(() => setAssembling(false));
      };
      const handlePromote = () => {
        if (!selectedRunId) return;
        setPromoting(true);
        fetch("/dsh-moa/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: selectedRunId,
            candidate: "workbench-glue",
            force: true
          })
        }).then(async (r) => {
          const resJson = await r.json().catch(() => ({}));
          if (!r.ok || !resJson.ok) throw new Error(resJson.error || "HTTP " + r.status);
          setPromoted(true);
        }).catch((err) => {
          setAssembleError("Promotion failed: " + (err?.message || String(err)));
        }).finally(() => setPromoting(false));
      };
      const allFiles = [];
      if (workbenchData?.fileScores?.byFile) {
        for (const file of Object.keys(workbenchData.fileScores.byFile)) {
          allFiles.push(file);
        }
      } else if (Array.isArray(workbenchData?.candidates)) {
        const fileSet = /* @__PURE__ */ new Set();
        for (const c of workbenchData.candidates) {
          for (const f of c.files || []) fileSet.add(f.relativePath);
        }
        allFiles.push(...Array.from(fileSet));
      }
      return React.createElement(
        "div",
        { className: "moa-section-card", style: { marginTop: 12 } },
        React.createElement("div", { className: "moa-section-title" }, t("workbench.title") || "\u{1F6E0}\uFE0F Interactive Synthesis Workbench"),
        React.createElement("div", { className: "moa-section-desc" }, t("workbench.desc") || "Inspect 1\u201310 file scores across candidate models, pick & mix desired files, harmonize with top-model glue, and execute judge re-audit."),
        /* Run Selection Bar */
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" } },
          React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary)" } }, t("workbench.select_run") || "MoA Run:"),
          React.createElement(
            "select",
            {
              className: "moa-select",
              style: { height: 28, fontSize: 12, padding: "0 8px", minWidth: 260, maxWidth: "100%" },
              value: selectedRunId,
              onChange: (e) => setSelectedRunId(e.target.value)
            },
            historyRuns.length === 0 && React.createElement("option", { value: "" }, t("workbench.no_runs") || "No runs recorded"),
            historyRuns.map((r) => {
              const fileCount = (r.candidates || []).reduce((acc, c) => acc + (c.files?.length || 0), 0);
              const label = `${(r.prompt || "").slice(0, 36)}... [${fileCount} files, winner: ${r.winnerModel || "none"}]`;
              return React.createElement("option", { key: r.id, value: r.id }, label);
            })
          ),
          /* Companion Plugin Badge */
          React.createElement(
            "div",
            { style: { marginLeft: "auto", fontSize: 11, color: "var(--dsw-alias-label-tertiary)", display: "flex", alignItems: "center", gap: 4 } },
            "\u{1F517} Companion: ",
            React.createElement(
              "a",
              {
                href: "https://github.com/goodandready/dsh-time-machine",
                target: "_blank",
                rel: "noopener noreferrer",
                style: { color: "var(--dsw-alias-state-brand-primary)", textDecoration: "underline" }
              },
              "dsh-time-machine"
            )
          )
        ),
        loading && React.createElement("div", { style: { padding: "16px 0", fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, "\u23F3 Loading workbench data..."),
        error && React.createElement("div", { style: { padding: "8px 12px", background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)", color: "var(--dsw-alias-state-error-primary)", border: "1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent)", borderRadius: 6, fontSize: 12, marginTop: 8 } }, error),
        /* File Matrix */
        !loading && !error && allFiles.length === 0 && React.createElement(
          "div",
          { style: { padding: "14px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: 8, fontSize: 12, color: "var(--dsw-alias-label-secondary)", marginTop: 8 } },
          t("workbench.empty_files") || "No candidate files found for this run."
        ),
        !loading && !error && allFiles.length > 0 && React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12 } },
          allFiles.map((file) => {
            const fileScores = workbenchData?.fileScores?.byFile?.[file] || [];
            const selectedCand = selections[file];
            return React.createElement(
              "div",
              {
                key: file,
                style: {
                  padding: "10px 12px",
                  background: "var(--dsw-alias-bg-layer-2)",
                  borderRadius: 8,
                  border: "1px solid var(--dsw-alias-border-l2)"
                }
              },
              /* File Title Bar */
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } },
                React.createElement(
                  "span",
                  { style: { fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))" } },
                  "\u{1F4C4} " + file
                ),
                React.createElement(
                  "span",
                  { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)" } },
                  fileScores.length + " candidate proposal(s)"
                )
              ),
              /* Candidate Choices for this file */
              React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6 } },
                fileScores.map((scoreItem) => {
                  const isChecked = selectedCand === scoreItem.candidateIndex;
                  const scoreVal = scoreItem.score || 7;
                  const scoreBg = scoreVal >= 8 ? "var(--dsw-alias-state-success-primary)" : scoreVal >= 5 ? "var(--dsw-alias-state-warning-primary)" : "var(--dsw-alias-state-error-primary)";
                  return React.createElement(
                    "label",
                    {
                      key: scoreItem.candidateIndex,
                      style: {
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        cursor: "pointer",
                        padding: "6px 8px",
                        background: isChecked ? "color-mix(in srgb, var(--dsw-alias-state-brand-primary) 8%, transparent)" : "transparent",
                        borderRadius: 6,
                        border: isChecked ? "1px solid var(--dsw-alias-state-brand-primary)" : "1px solid transparent"
                      }
                    },
                    React.createElement("input", {
                      type: "radio",
                      name: "file-" + file,
                      checked: isChecked,
                      onChange: () => setSelections((prev) => ({ ...prev, [file]: scoreItem.candidateIndex })),
                      style: { marginTop: 3, accentColor: "var(--dsw-alias-state-brand-primary)" }
                    }),
                    React.createElement(
                      "div",
                      { style: { flex: 1, fontSize: 12 } },
                      React.createElement(
                        "div",
                        { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
                        React.createElement("span", { style: { fontWeight: 600 } }, scoreItem.candidateLabel || "Candidate " + scoreItem.candidateIndex),
                        React.createElement(
                          "span",
                          {
                            style: {
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#fff",
                              background: scoreBg,
                              padding: "1px 6px",
                              borderRadius: 4
                            }
                          },
                          "Score: " + scoreVal + "/10"
                        )
                      ),
                      scoreItem.pros && React.createElement(
                        "div",
                        { style: { fontSize: 11, color: "var(--dsw-alias-state-success-primary)", marginTop: 2 } },
                        "\u2B50 " + (t("workbench.pros") || "Pros:") + " " + scoreItem.pros
                      ),
                      scoreItem.cons && React.createElement(
                        "div",
                        { style: { fontSize: 11, color: "var(--dsw-alias-state-error-primary)", marginTop: 1 } },
                        "\u26A0\uFE0F " + (t("workbench.cons") || "Cons:") + " " + scoreItem.cons
                      )
                    )
                  );
                })
              )
            );
          }),
          /* Harmonization Instructions Input */
          React.createElement(
            "div",
            { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 4 } },
            React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary)" } }, t("workbench.instructions_label") || "Harmonization Instructions (Optional):"),
            React.createElement("input", {
              type: "text",
              className: "moa-input",
              style: { height: 32, fontSize: 12, padding: "0 8px" },
              placeholder: t("workbench.instructions_placeholder") || "e.g. Ensure all imports match, unify TypeScript types, align function signatures...",
              value: instructions,
              onChange: (e) => setInstructions(e.target.value)
            })
          ),
          /* Action Button */
          React.createElement(
            "button",
            {
              className: "moa-btn moa-btn-primary",
              style: { height: 36, fontSize: 13, fontWeight: 600, marginTop: 6 },
              disabled: assembling || Object.keys(selections).length === 0,
              onClick: handleAssemble
            },
            assembling ? t("workbench.assembling") || "\u23F3 Harmonizing files with Top Model..." : t("workbench.assemble_btn") || "\u{1F680} Harmonize & Assemble (Top-Model Glue)"
          ),
          assembleError && React.createElement(
            "div",
            { style: { padding: "8px 12px", background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)", color: "var(--dsw-alias-state-error-primary)", border: "1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent)", borderRadius: 6, fontSize: 12, marginTop: 8 } },
            assembleError
          ),
          /* Harmonization Result Card */
          assembleResult && React.createElement(
            "div",
            {
              style: {
                marginTop: 10,
                padding: "12px",
                background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 40%, transparent)",
                borderRadius: 8
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } },
              React.createElement("div", { style: { fontWeight: 700, fontSize: 13, color: "var(--dsw-alias-state-success-primary)" } }, "\u2728 Harmonization Complete! Top Model: " + (assembleResult.topModel || "Master")),
              React.createElement(
                "span",
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    background: assembleResult.judgeAudit?.passed ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-state-error-primary)",
                    padding: "2px 8px",
                    borderRadius: 4
                  }
                },
                "Judge: " + (assembleResult.judgeAudit?.rawVerdict || (assembleResult.judgeAudit?.passed ? "PASSED" : "FAILED")) + " (" + (assembleResult.judgeAudit?.score || 8) + "/10)"
              )
            ),
            /* Audit notes */
            assembleResult.judgeAudit?.notes && React.createElement(
              "div",
              { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)", marginBottom: 8, background: "var(--dsw-alias-bg-layer-2)", padding: "6px 8px", borderRadius: 4 } },
              assembleResult.judgeAudit.notes
            ),
            /* Glued files */
            React.createElement(
              "div",
              { style: { fontSize: 11, color: "var(--dsw-alias-label-primary)", marginBottom: 8 } },
              "Glued Files: " + (assembleResult.gluedFiles || []).map((f) => `${f.relativePath} (${f.size}B)`).join(", ")
            ),
            /* Promotion Button */
            !promoted && React.createElement(
              "button",
              {
                className: "moa-btn moa-btn-success",
                style: { height: 32, fontSize: 12, fontWeight: 600 },
                disabled: promoting,
                onClick: handlePromote
              },
              promoting ? "\u23F3 Promoting to workspace..." : t("workbench.promote_btn") || "Promote Harmonized Files to Workspace"
            ),
            promoted && React.createElement(
              "div",
              { style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-state-success-primary)", marginTop: 4 } },
              t("workbench.promoted_ok") || "\u2705 Harmonized deliverable promoted to workspace root!"
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
              // --- src/client/86-card-aggregator-ext2.js ---
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
        }).catch(() => {
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
        }).catch(() => {
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
          const undo = [addLocale("en", en), addLocale("zh", zh)];
          return () => {
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
