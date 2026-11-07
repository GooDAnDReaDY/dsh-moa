# Changelog

## 0.2.86 (2026-11-07)

### Security & Hardening
- **Preflight and Security Audit Hardening (#338)**:
  - Eliminated bare empty catch blocks across `lib/services.js` with documented exception handlers preventing silent failures and satisfying preflight static analysis.
  - Hardened Cordis service resolution (`service(ctx, name)`, `getWebServer(ctx)`, `getWebServerPort(ctx)`) against context proxy traps in un-injected and test mock environments.
  - Verified full route authorization (`assertAuthorizedRequest` and `isSafeWriteRequest`) across all mutating API endpoints.
  - Verified line budgets (all source files <= 600 lines) and bundle size constraints (client bundle < 256 KiB).
  - Achieved 100% preflight pass (`FAIL=0`) and verified all 551 unit and integration tests passing.

## 0.2.79 (2026-11-06)

### Features
- **Cost/Quality Pareto Frontier Slider (#307)**: Added `lib/pipeline/pareto-frontier.js`, `getParetoProfile`, `calculateParetoEnsemble`, `applyParetoAdjustment`, and `pareto_slider_enabled`, `pareto_slider_position` (0–100%, default: 50) preset settings. Reactive trade-off slider balancing financial cost ($), consensus quality, and latency across 4 frontier tiers: Local Free Edge (0–25%), Economic (26–50%), Balanced Production (51–75%), and Ultra-Rigorous Consensus (76–100%). Dynamically estimates turn expenses and latency, automatically assigning curated reference and aggregator models. Emits `moa/pareto-adjusted` Cordis events.
- **Hard Token Budget Guard with Dynamic Auto-Scaling (#319)**: Added `lib/pipeline/budget-guard.js`, `evaluateHardBudgetLimit`, and `hard_budget_guard_enabled`, `hard_budget_limit_usd` (default: `0.02`), `hard_budget_policy` (`auto_downgrade` vs `fail_closed`) preset options. Pre-calculates projected turn costs against a strict monetary ceiling. Under `auto_downgrade`, dynamically substitutes costly cloud slots with zero-cost local edge models or economic tiers and scales candidate counts to stay strictly below the ceiling. Under `fail_closed`, halts execution immediately to prevent billing surprises. Emits `moa/budget-scaled` Cordis events.
- **Client WebUI Controls & Localizations (#307, #319)**: Added interactive slider and budget configuration inputs in `src/client/86-card-aggregator-ext2.js` with complete English, Chinese, and Russian localization.

## 0.2.78 (2026-11-06)

### Features
- **Hybrid Private Edge MoA & Cloud Judge Sanitizer (#306)**: Added `lib/pipeline/privacy-sanitizer.js`, `sanitizeSensitiveText`, `sanitizeCandidatesForCloudJudge`, `formatPrivacyDirective`, and `hybrid_edge_privacy_enabled`, `cloud_judge_sanitization_enabled`, `redact_paths`, `redact_secrets`, `redact_ips` preset settings. Scrubs internal absolute file paths (`/home/...`, `C:\Users\...`), private network IP addresses (`192.168.x.x`, `10.x.x.x`), API secrets (`sk-...`, JWTs, Bearer tokens, private keys), and personal emails before forwarding prompts or candidate proposals to external Cloud Judges, while preserving pristine originals locally for safe workspace promotion. Emits `moa/privacy-sanitized` Cordis events.
- **Heterogeneous Speculative Decoding with Local Draft & Cloud Verifier (#317)**: Added `lib/pipeline/speculative-verifier.js`, `estimateTokens`, `runSpeculativeVerification`, `createSpeculativeCallLlm`, and `speculative_draft_enabled`, `speculative_block_size` (default: `256`) preset options. Employs a rapid local edge model (e.g. Qwen 2.5 Coder 3B/7B via Ollama/MiniPC) to generate an initial high-throughput token draft block, which a powerful cloud verifier model validates, patches, and completes in a single fast pass. Accelerates response latency by 2–3x, measures effective tokens/sec throughput and speedup factors, and emits `moa/speculative-draft` Cordis events.
- **Client WebUI Controls & Localizations (#306, #317)**: Added interactive configuration controls for Hybrid Private Edge MoA and Heterogeneous Speculative Decoding in `src/client/86-card-aggregator-ext2.js` with complete English, Chinese, and Russian localization.

## 0.2.77 (2026-11-06)

### Features
- **Runtime CPU & Memory Profiler Gate (#315)**: Added `lib/pipeline/runtime-profiler.js`, `profileCodeExecution`, `runProfilerGate`, `formatProfilerDirective`, and `profiler_gate_enabled`, `profiler_iterations` (default: `100`), `profiler_timeout_ms` (default: `2000`) preset settings. Micro-benchmarks candidate JavaScript implementations in an isolated sandbox with hard timeout protection to measure execution latency, ops/sec throughput, and heap memory footprint. Injects objective performance telemetry directly into Judge arbitration to favor algorithmically optimal solutions. Emits `moa/profiler-complete` Cordis events.
- **Mutation Testing Gate for Candidate Tests (#316)**: Added `lib/pipeline/mutation-tester.js`, `generateMutants`, `auditCandidateMutations`, `runMutationGate`, `formatMutationDirective`, and `mutation_testing_enabled`, `min_mutation_score` (default: `0.70`) preset settings. Injects deterministic AST-level fault mutations (inverting relational operators, strict equality, arithmetic signs, boolean literals, and return statements) into candidate code and executes test suites against each mutant. Calculates Mutation Score (killed vs survived mutants) to expose tautological and false-positive tests, guiding the Judge to resilient implementations. Emits `moa/mutation-complete` Cordis events.
- **Client WebUI Controls & Localizations (#315, #316)**: Added configuration toggles for Runtime Profiler Gate and Mutation Testing Gate in `src/client/86-card-aggregator-ext2.js` with English, Russian, and Chinese localization.

## 0.2.76 (2026-11-06)

### Features
- **Adversarial White-Hat Security Fuzzing Gate (#302)**: Added `lib/pipeline/security-fuzzer.js`, `auditCodeSecurity`, `runSecurityAuditGate`, `formatSecurityAuditDirective`, and `security_gate_enabled` / `security_gate_strict_veto` preset settings. Runs an automated Red Team security auditor over candidate solutions prior to Judge arbitration, inspecting code for SQLi (CWE-89), OS Command Injection (CWE-78), DOM XSS (CWE-79), Path Traversal (CWE-22), ReDoS (CWE-400), Prototype Pollution (CWE-1321), Hardcoded Secrets (CWE-798), and TOCTOU races (CWE-362). Emits `moa/security-audit` Cordis events, calculates security scores (0–100), and issues blocking `SECURITY_VETO` directives to prevent adopting vulnerable code.
- **Chain-of-Verification (CoVe) Fact-Checking Gate for Code (#314)**: Added `lib/pipeline/cove-verifier.js`, `generateCoveQuestions`, `verifyCoveQuestion`, `auditCandidateCove`, `runCoveVerificationGate`, `formatCoveDirective`, and `cove_verification_enabled` / `cove_max_questions` preset settings. Generates 3–5 targeted factual API and module existence verification questions per candidate solution, verifying calls against Node.js standard libraries and declared project dependencies. Detects hallucinated APIs (e.g. `fs.readAllText`, `path.combine`, `crypto.generateRandomUuidString`), emits `moa/cove-verified` Cordis events, deducts hallucination penalties, and injects fact-checking guidance to Judge arbitration.
- **Client WebUI Controls & Localizations (#302, #314)**: Added interactive configuration toggles for the Adversarial Security Gate and Chain-of-Verification Fact-Checking Gate in `src/client/86-card-aggregator-ext2.js` with English, Russian, and Chinese localization.

## 0.2.75 (2026-11-06)

### Features
- **Stack-Aware Dynamic Persona Evolution from Project Manifests (#308)**: Added `lib/pipeline/manifest-stack.js`, `detectProjectStack`, `assignStackAwarePersonas`, `formatStackAwareDirective`, and `stack_aware_personas_enabled` (default: `false`) preset option. Automatically parses workspace manifests (`package.json`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`, `go.mod`) to infer primary language, frameworks, and libraries. Dynamically specializes candidate proposers into complementary expert roles (e.g. React Optimization, TypeScript Strict Safety, Accessibility, FastAPI Async) to maximize hypothesis diversity. Emits `moa/stack-detected` Cordis event bus notifications.
- **Self-Learning Developer Preferences Metaprompt (#309)**: Added `lib/pipeline/developer-preferences.js`, persistent rule storage in `~/.dsh/moa/preferences.json`, `developer_preferences_enabled` (default: `false`), and `formatPreferencesDirective`. Injects developer coding principles and architectural preferences (strict typing, functional immutability, error boundaries) into the Judge synthesis prompt. Emits `moa/preferences-applied` Cordis event bus notifications.
- **Developer Preferences REST API Endpoints (#309)**: Added `lib/routes/preferences.js` mounting `GET /dsh-moa/preferences` to list active rules, `POST /dsh-moa/preferences` to add/update/toggle rules, and `DELETE /dsh-moa/preferences/:id` to remove rules.
- **Client UI Modularization & Localizations (#308, #309)**: Added settings toggles for Stack-Aware Personas and Developer Preferences in `src/client/86-card-aggregator-ext2.js` with English, Russian, and Chinese localization. Cleanly modularized aggregator card fragments to remain strictly below the 600-line limit per file.

## 0.2.74 (2026-11-06)

### Features
- **Dynamic Consensus Threshold & Multi-Judge Escalation (#300)**: Added `lib/pipeline/escalation.js`, `escalation_policy` (`single`, `auto_upgrade`, `council_majority`), `escalation_disagreement_threshold` (default: `0.40`), and `escalation_judge` preset settings. Measures pairwise candidate solution divergence (Disagreement Metric, 0.0–1.0) and automatically escalates when consensus is weak by upgrading to a senior flagship judge (`auto_upgrade`) or convening a 3-judge panel (`council_majority`). Emits `moa/judge-escalation` Cordis events and displays escalation decisions in client progress telemetry.
- **Self-Consistency Temperature Sampling for Single Models (#301)**: Added `lib/pipeline/self-consistency.js`, `self_consistency_enabled` (default: `false`), `self_consistency_samples` (default: `3`), and `self_consistency_temperatures` (default: `[0.2, 0.6, 0.9]`) preset options. Automatically expands single-model setups (e.g. local Ollama/vLLM or single API key) into parallel candidate slots with distinct sampling temperatures and complementary reasoning personas (`proposer`, `challenger`, `minimalist`), followed by majority agreement scoring and full MoA synthesis. Emits `moa/self-consistency-expand` Cordis events.
- **WebUI Controls & Localizations (#300, #301)**: Added interactive configuration sliders and selectors for Self-Consistency Sampling and Judge Escalation in preset settings card (`src/client/85-card-aggregator-ext.js`), complete with English, Russian, and Chinese localization.

## 0.2.73 (2026-11-05)

### Features
- **Cross-Candidate Unchanged Base Context Pruning (#305)**: Added `lib/pipeline/context-pruner.js`, `context_pruning_enabled` (default: `true`), and `context_pruning_diff_lines` (default: `5`) preset options to replace large, mostly-unchanged project base files in the Judge prompt with unified diff patches (---/+++ hunks), slashing Judge prompt tokens by 70–85% while preserving 100% of candidate files on disk for winner promotion.
- **Semantic Caching for Intermediate Candidate Generations (#318)**: Added `lib/pipeline/semantic-cache.js`, `createCachingCallLlm`, `semantic_cache_enabled` (default: `false`), and `semantic_cache_ttl_hours` (default: `168`) preset options to persist candidate model outputs locally by deterministic SHA-256 fingerprint, eliminating redundant API token costs during iterative testing and retry requests.
- **Semantic Cache Management HTTP Endpoints (#318)**: Added `GET /dsh-moa/cache` to inspect cache entries, saved tokens, and disk footprint, and `POST /dsh-moa/cache/clear` to purge cached entries.
- **Pipeline Events & Telemetry**: Added `moa/context-pruning` and `moa/cache-hit` Cordis event bus notifications, streaming live token savings directly to client progress telemetry.

## 0.2.72 (2026-11-05)

### Features
- **Zero-Token Local Pre-Judge Syntax Filter (#303)**: Added `lib/pipeline/syntax-filter.js` and `local_preflight_check` preset toggle (default: `true`) to validate code blocks, brackets, and syntax (JavaScript, TypeScript, JSON, Python) across all candidate outputs locally before passing them to the Judge LLM, filtering out malformed candidates or annotating syntax errors without consuming model tokens.
- **Early Exit upon Semantic Consensus (#299)**: Added `lib/pipeline/early-consensus.js`, `early_exit_consensus_enabled` (default: `false`), and `early_exit_threshold` (default: `0.95`) preset settings to compare normalized candidate outputs via Sørensen-Dice token similarity, automatically promote the winning solution when high consensus is detected, bypass the Judge synthesis phase, and record skipped token savings in execution telemetry.

## 0.2.71 (2026-10-31)

### Features
- **AST-Level Composite Merge via `dsh-context-lens` (#248)**: Added `lib/moa-ast-merge.js` and `ast_composite_merge_enabled` preset toggle to deduplicate imports and semantically merge JSDoc, type signatures, and function declarations across candidates using `@goodandready/dsh-context-lens` with clean fallback.
- **Speculative MoA with Fast-Draft & Multi-Auditor Diffs (#247)**: Added `lib/moa-speculative.js` (`speculative_moa_enabled`, `speculative_draft_model`) to generate a fast initial draft, dispatch parallel diff audits across reference models, apply valid SEARCH/REPLACE and diff hunks, and fall back to standard parallel MoA if the draft model fails.
- **Adversarial TDD Loop with Auto-Generated Unit Test Gate (#246)**: Added `lib/moa-adversarial-tdd.js` and `adversarial_tdd_enabled` preset toggle to synthesize edge-case unit test suites via a Red-Team Test Engineer model, execute them in isolated candidate sandboxes, and inject the verification report into the Judge context.

## 0.2.70 (2026-10-31)

### Features
- **Multimodal Visual MoA Consensus (#250)**: Added `lib/moa-visual-consensus.js` and `visual_moa_enabled` preset toggle to render UI/Frontend candidates in `@goodandready/dsh-live-canvas`, capture screenshots, and evaluate layout fidelity via `@goodandready/dsh-vision-bridge` with graceful fallback to text evaluation.
- **Empirical Elo Rating & Active Learning Leaderboard (#249)**: Added `lib/moa-elo.js` and `elo_ranking_enabled` preset toggle to compute pairwise Elo ratings segmented by task category (`frontend`, `backend`, `refactoring`, `testing`, `sql`, `general`), display Elo in the WebUI leaderboard, and weight Smart Routing preset selection by historical category Elo.

## 0.2.69 (2026-10-31)

### Features
- **Quota-Aware Provider Balancing (#253)**: Added `lib/moa-quota-balancer.js` and `quota_aware_balancing_enabled` preset toggle to query `@goodandready/dsh-key-limits` and `@goodandready/dsh-subscriptions` before Layer 1 generation and substitute low-quota slots with healthy fallback models.
- **Self-Healing Post-Promotion Build Loop (#252)**: Added `lib/moa-self-healing.js` (`self_healing_enabled`, `self_healing_max_retries`, `self_healing_command`) to verify promoted workspace files, request automated hotfix patches from the aggregator on build/test failure, and perform unconditional rollback via `@goodandready/dsh-time-machine` if retries are exhausted.

## 0.2.68 (2026-10-31)

### Features
- **MoA-to-Subagents Swarm with Isolated Git Worktrees (#255)**: Added `lib/moa-swarm.js`, `subagent_swarm_enabled` preset toggle, and `--swarm` CLI flag to provision isolated worktrees/sandboxes per candidate, execute autonomous subagent passes, collect git diffs, and guarantee worktree cleanup.
- **Prompt-Adaptive Dynamic Persona Synthesis (#254)**: Added `lib/moa-adaptive-personas.js` and `adaptive_personas_enabled` preset toggle to classify prompt domains (database, frontend, security, performance, testing, backend) and dynamically assign distinct complementary engineering personas to each proposer slot.

## 0.2.67

### Features & Terminal Interface
- **DSH Terminal User Interface (TUI) Settings Support via `tuiSettingsSections`** (#277):
  - Created `lib/tui-settings.js` implementing `buildTuiSection({ live })` and `applyTuiSettings(ctx, { live })` with dynamic Cordis injection `ctx.inject(['tuiSettingsSections'], ...)`.
  - Added interactive TUI settings controls for `enabled`, `default_preset` (with dynamic preset options), `interactive_workbench_enabled`, `ask_clarifying_questions`, `test_gate_enabled`, `smart_routing_enabled`, and `uncertainty_scoring_enabled`.
  - Added unit test suite `test/issue-277-tui-settings.test.mjs`.

### Hallucination Detection & Consensus Quality
- **Token-Level Uncertainty and Entropy Scoring for Hallucination Detection** (#256):
  - Created `lib/moa-uncertainty.js` implementing Shannon entropy calculation (`calculateTokenEntropy`) across `top_logprobs` distributions and scalar `logprob` surprisal.
  - Added `analyzeCandidateUncertainty` and `formatUncertaintyAnnotations` to detect high-entropy token spans (e.g. hallucinated method calls or signatures) and inject structured warnings into the Judge synthesis prompt when `uncertainty_scoring_enabled: true`.
  - Added `uncertainty_scoring_enabled` to `PresetSchema` and `Config`.
  - Added unit test suite `test/issue-256-uncertainty-scoring.test.mjs`.

## 0.2.66

### Build System & Client Quality Assurance
- **Modernized Client Builder `build-client` with esbuild, Atomic Writes, and no-undef Checks** (#276):
  - Refactored `scripts/build-client.mjs` following canonical `dsh-clinebot` architecture.
  - Integrated `esbuild.transformSync` for syntax validation and legal comments stripping.
  - Implemented atomic file generation via `tempOut -> renameSync`, eliminating race conditions during parallel testing.
  - Added automated validation for official DSH Store package limits (strictly $le 256$ KiB; current bundle 169 KiB).
  - Enforced `eslint --rule no-undef: 2` verification across the assembled client bundle with environment globals (`window`, `document`, `fetch`, `URLSearchParams`, `structuredClone`, etc.).
  - Added automated drift check (`build-client.mjs --check`) to the `npm test` pipeline.
  - Added test suite `test/issue-276-build-client.test.mjs`.

### Reliability & Preset Diagnostics
- **Dynamic Preset Model Validation via `ctx.llm` Provider Registry** (#283):
  - Created `lib/moa-model-validator.js` (241 lines) providing provider and model introspection:
    - `getActiveLlmProviders(ctx)`: inspects registered and configurable LLM providers from `ctx.llm`.
    - `getActiveLlmModels(ctx, providers)`: queries model catalogs per provider with timeout guardrails.
    - `validateSlot(slot, role, activeProviders, modelMap)`: identifies missing providers, unregistered providers, and dead models.
    - `validatePreset(preset, options)`: inspects reference candidates, aggregator model, and fallbacks.
    - `validateAllPresets(presets, ctx)`: aggregates diagnostic summaries and logs structured warnings (`logger.warn`).
  - Added `ctx.moa.validatePresets(presets)` and `ctx.moa.getActiveProviders()` to `MoaService`.
  - Integrated dynamic validation into `GET /dsh-moa/presets` and `POST /dsh-moa/presets` HTTP responses for real-time UI alerting.
  - Added comprehensive test suite `test/issue-283-model-validation.test.mjs`, expanding test suite to 351 tests (100% pass rate).

## 0.2.65

### Features & CLI / Chat Integration
- **Official Slash-Command `/moa` Registration via `dsh-commands`** (#275):
  - Created `lib/commands.js` (83 lines) implementing dynamic injection `ctx.inject(['commands'], ...)` and command registration via `commands.register(...)`.
  - Registered official slash command with `name: 'moa'`, `definitionId: '@goodandready/dsh-moa'`, input hint `[presets|history|status|<prompt>]`, description, and both handler and execute lifecycle methods.
  - Added introspection and convenience subcommands:
    - `/moa presets`: lists active configured MoA presets with advisor counts.
    - `/moa history`: inspects recent runs, winners, and token costs from history.
    - `/moa status`: returns active plugin enablement and default preset.
    - `/moa help`: displays command usage guide.
    - `/moa <prompt>`: dispatches MoA turn with real-time streaming consensus.
  - Added comprehensive unit tests in `test/issue-275-slash-commands.test.mjs`.

### Resilience & Error Handling
- **Centralized LLM Error Taxonomy and Candidate Failover Mechanism** (#282):
  - Created `lib/errors.js` (176 lines) establishing a comprehensive domain error hierarchy:
    - Base `MoaError` with `code`, `status`, `isRetryable`, and `fallbackEligible`.
    - Typed subclasses: `RateLimitError` (HTTP 429), `ContextOverflowError` (HTTP 400), `AuthenticationError` (HTTP 401/403), `ModelNotFoundError` (HTTP 404), `TransientNetworkError` (HTTP 502/503/504 / ECONNRESET / timeout).
    - `classifyLlmError(err)` helper parsing HTTP status codes, error messages, and codes.
    - `isFailoverEligible(err)` guard protecting against retrying or failing over non-recoverable errors (e.g. invalid API key).
  - Integrated candidate model failover in `lib/moa-candidates.js`:
    - Automatically redirects failed candidate queries to candidate-specific `slot.fallbacks`, global `options.fallback_models`, or `options.local_fallback_models` on rate limits (429), context overflows, and network timeouts.
    - Immediate fast-fail without wasted failover attempts on `AuthenticationError`.
    - Records `was_fallback: true` and `failoverReason` in candidate telemetry.
  - Enhanced `callWithTransientRetry` to leverage `classified.isRetryable` from the centralized taxonomy.
  - Added unit test suite `test/issue-282-error-failover.test.mjs`, bringing the test suite to 341 tests (100% pass rate).

## 0.2.64

### Features & Ecosystem Integration
- **Native Cordis Service ctx.moa** (#280):
  - Created MoaService class (lib/moa-service.js, 155 lines) providing in-process consensus pipeline execution and configuration introspection for peer plugins.
  - Registered ctx.provide("moa", moaService) and ctx.moa = moaService on the Cordis Context, enabling consumers to inject moa via ctx.inject(["moa"], ...) or direct property access.
  - Provided core in-process methods:
    - ctx.moa.run(options): in-process execution with preset routing, progress callbacks, stream delta dispatch, workspace containment, and time machine integration.
    - ctx.moa.getPresets(): returns active configured presets.
    - ctx.moa.getPreset(idOrName): returns a specific preset with fallback to default.
    - ctx.moa.getHistory(limit, offset): returns history runs and summary statistics.
    - ctx.moa.resolvePresetForPrompt(prompt): resolves the most suitable preset for a prompt.
    - ctx.moa.on(event, listener) & ctx.moa.emit(event, payload): event listeners and dispatch forwards.
  - Added comprehensive test suite test/issue-280-moa-service.test.mjs.

- **Cordis Event Bus Integration ctx.emit** (#281):
  - Introduced lib/events.js (30 lines) defining standard lifecycle events MOA_EVENTS:
    - moa/run-start: { runId, prompt, preset, candidatesCount, timestamp }
    - moa/candidate-complete: { runId, round, model, success, durationMs, tokens }
    - moa/critique-complete: { runId, critiquesCount }
    - moa/judge-verdict: { runId, winningIndex, winningModel, scores }
    - moa/run-finish: { runId, durationMs, totalTokens, totalCostUsd, promotedFiles, winnerIndex }
  - Integrated event emission into lib/pipeline/runner.js, lib/pipeline/fast-mode.js, lib/pipeline/promotion.js, and lib/moa-candidates.js with duration and model telemetry.
  - Ensured best-effort error isolation (emitEvent): listener crashes or missing event dispatchers never interrupt pipeline execution.
  - Added comprehensive test suite test/issue-281-event-bus.test.mjs, extending test suite to 331 tests (100% pass rate).

## 0.2.63

### Refactoring & Architecture
- **Pipeline Stage Pattern for `runMoAPipeline`** (#279):
  - Decomposed monolithic `lib/moa-runner.js` (593 lines, 7 lines from 600-line budget limit) into a clean, modular Pipeline Stage Pattern in `lib/pipeline/`:
    - `lib/pipeline/context.js` (107 lines): context collection, refinement detection, prompt enrichment, multi-turn history pruning, and budget guardrails.
    - `lib/pipeline/candidates.js` (99 lines): parallel fan-out to advisor models, workspace isolation, candidate syntax checks, and test execution gate.
    - `lib/pipeline/questions.js` (79 lines): clarifying questionnaire synthesis branch with transient retry and history logging.
    - `lib/pipeline/fast-mode.js` (100 lines): single-candidate direct bypass, workspace promotion, and live preview generation.
    - `lib/pipeline/peer-critique.js` (113 lines): Consilium Round 2 peer critique, opponent solution synthesis, and re-test gating.
    - `lib/pipeline/multi-judge.js` (37 lines): multi-judge consensus panel execution and budget checkpointing.
    - `lib/pipeline/synthesis.js` (150 lines): judge synthesis prompt building, fallback judge chain execution, and streaming delta dispatch.
    - `lib/pipeline/promotion.js` (114 lines): winning candidate evaluation, workspace promotion, live canvas previews, benchmark report generation, and async history recording.
    - `lib/pipeline/runner.js` (163 lines): lightweight stage coordinator orchestrating the full pipeline lifecycle.
  - Replaced `lib/moa-runner.js` with an 8-line re-export barrel ensuring 100% backward compatibility for all programmatic callers.
- **Dynamic Cordis Service Injection & Resilience** (#274):
  - Reduced static `export const inject` in `lib/index.js` from `['webServer', 'llm', 'sessions', 'tools']` to minimal `['llm']`.
  - Created `lib/services.js` (40 lines) with safe accessor `service(ctx, name)` and `getWebServerPort(ctx)` preventing Cordis Strict Proxy Guard crashes on un-injected properties.
  - Migrated web server surfaces and one-click updater endpoints to dynamic on-demand injection (`ctx.inject(['webServer'], ...)`), enabling graceful degradation and seamless execution in headless environments, CLI scripts, and minimal test runners.
  - Added test suites `test/issue-274-dynamic-injection.test.mjs` and `test/issue-279-pipeline-stages.test.mjs`, extending tests to 321 tests (100% pass rate).

## 0.2.61

### Refactoring & Architecture
- **Decompose `lib/routes.js` into Modular Subrouters** (#273):
  - Split monolithic `lib/routes.js` (586 lines, near 600-line budget limit) into cohesive domain subrouters in `lib/routes/`:
    - `lib/routes/presets.js` (241 lines): `/dsh-moa/status`, `/dsh-moa/models`, `/dsh-moa/presets`, `/dsh-moa/route-preset`.
    - `lib/routes/workbench.js` (197 lines): `/dsh-moa/promote`, `/dsh-moa/diff`, `/dsh-moa/runs/:id/workbench`, `/dsh-moa/runs/:id/workbench/assemble`.
    - `lib/routes/pipeline.js` (91 lines): `/dsh-moa/run`.
    - `lib/routes/history.js` (81 lines): `/dsh-moa/history`, `/dsh-moa/leaderboard`, `/dsh-moa/history/export`.
  - Replaced `lib/routes.js` with a lightweight 21-line dispatcher maintaining 100% backward compatibility for all route registrations and exports.
- **Decompose `lib/file-workspace.js` into Modular Submodules** (#278):
  - Split monolithic `lib/file-workspace.js` (594 lines, near 600-line budget limit) into cohesive domain modules in `lib/workspace/`:
    - `lib/workspace/fs.js` (284 lines): candidate workspace isolation, file blocks extraction, candidate promotion and cleanup.
    - `lib/workspace/scanner.js` (100 lines): project context scanning, file collection, and refinement task detection.
    - `lib/workspace/diff.js` (94 lines): line diff computation and file syntax verification.
    - `lib/workspace/security.js` (80 lines): safe relative path assertions, boundary confinement, and loopback URL checks.
    - `lib/workspace/checkpoint.js` (51 lines): pre-promotion checkpoints with `dsh-time-machine`.
  - Replaced `lib/file-workspace.js` with a 34-line re-export module preserving 100% API compatibility for both internal modules and external consumers.


## 0.2.60

### Bug Fixes
- **Admit Genuine Loopback and In-Process Callers without Session Cookies** (#271, GitHub #2):
  - Fixed a regression from `0.2.53` where non-browser loopback clients (such as adjacent DSH plugins or local CLI callers) calling `POST /dsh-moa/run` were rejected with `401 {"ok":false,"error":"Authentication required"}` when DSH connection service was active.
  - In `lib/access.js` (`getReadRejectionStatus`), verified genuine local socket connections (`127.0.0.1`, `::1`, `localhost`) not forwarded from remote proxies (`!isForwardedRemote`) are admitted directly, preserving connection service session validation for remote and forwarded LAN traffic.
  - Added strict Origin/Host validation preventing cross-origin requests from targeting loopback while permitting valid same-origin test/proxy hosts.
  - Re-exported `runMoAPipeline` in `lib/index.js` enabling programmatic in-process pipeline execution without HTTP transport overhead.
  - Added regression test suite `test/issue-271-loopback-auth.test.mjs` verifying loopback admission, remote LAN 401 rejection, forwarded proxy validation, and in-process export. Full test suite extended to 311 tests (100% pass rate).

## 0.2.59

### Bug Fixes
- **Missing React DevDependencies for Test Suite on Clean Clones** (#268):
  - Added `"react": "^18.3.1"` and `"react-dom": "^18.3.1"` to `devDependencies` in `package.json` and updated `package-lock.json`.
  - Resolved `ERR_MODULE_NOT_FOUND` in test #187 (`test/audit-pack-232.test.mjs`) when running on clean environments lacking global/parent React installations.
  - Satisfies preflight rule #13 (`devDependencies ⊆ peerDependencies`).

### Refactoring & UI Debt
- **Eliminate Color Hardcoding in Workbench Viewer and Prune Dead Exports** (#269):
  - **DSH Theme Parity**: Replaced 21 hardcoded hex (`#...`) and `rgba(...)` color values across `src/client/56-workbench-viewer.js`, `src/client/30-ui-primitives.js`, and `src/client/80-card-aggregator.js` with DSH semantic CSS variables (`var(--dsw-alias-state-...)`, `var(--dsw-alias-label-...)`) and `color-mix(...)`.
  - **Dark Theme Error Badge**: Fixed white/light error badge (`#fee2e2` / `#b91c1c`) blinding users in dark theme by adopting `color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)` with matching semi-transparent border and semantic text color.
  - **Pruned Dead Exports**: Removed unused synchronous `recordMoaRun` from `lib/history.js` (migrated test callers to non-blocking `recordMoaRunAsync`, freeing 27 lines and bringing `lib/history.js` comfortably down to 567 lines <= 600 limit).
  - **Pruned Uncalled Server Helpers**: Moved test-only `callConfigEquals` from `lib/moa-llm.js` directly into `test/llm-contracts.test.mjs`; integrated `resetMemoryCatalog()` call in `lib/pricing.js` `loadCachedCatalog()` cache-invalidation handler.
  - **Preflight Cleanliness**: Preflight reports `хардкода цветов нет` (0 hardcoded colors) and 0 uncalled exports.

## 0.2.58

### Bug Fixes
- **Normalize Message Content to Content-Block Array for DSH 0.2.x Adapter Compatibility** (#265):
  - **Adapter Contract Compatibility**: Fixed `TypeError: content.some is not a function` (which wraps as `DeepSeek Messages transport failed` in DeepSeek adapter) on DSH 0.2.x (`@deepseek-ai/dsh-llm-pi-ai`, `@deepseek-ai/dsh-llm-deepseek`, etc.) when advisor prompts are sent with string `content`.
  - **Unified Dispatcher Normalization in `lib/moa-llm.js`**: Added `toContentBlocks` and `toLlmMessages` in `createLlmCaller`, automatically normalizing messages across all pipeline phases (`moa-prompts`, `moa-candidates`, `moa-runner`, `moa-workbench`) into standard content-block arrays (`[{ type: 'text', text: '...' }]`) before passing to `prep.stream({ messages })`.
  - **Robust Type Handling**: Normalizer safely handles plain strings, existing content-block arrays, objects (`{ text }` or `{ content }`), empty strings, numbers, and null/undefined values without throw.
  - **Architectural Line Budget**: `lib/moa-llm.js` extended to 188 lines, strictly adhering to the architectural budget ceiling (<= 600 lines).
  - **Regression Test Coverage**: Added contract tests in `test/llm-contracts.test.mjs` verifying message block normalization and adapter `m.content.some(...)` invocation. All 308 tests pass.

## 0.2.57

### Features
- **Interactive Workbench with 1-10 File Scoring, Pick & Mix Selection, Top-Model Glue and Judge Re-Check** (#251):
  - **Candidate File Scoring (1-10)**: Judge evaluates each generated candidate file from 1 to 10 with key pros and cons. Structured parsing supports both JSON code comments and Markdown tables. File scores are recorded in run history and exposed via REST APIs.
  - **Interactive WebUI Matrix**: Added `InteractiveWorkbenchSection` in WebUI displaying candidate files by path with color-coded score badges (green $\ge 8$, amber 5-7, red $< 5$), pros/cons, radio buttons for picking desired files across candidates, and customizable harmonization instructions.
  - **Top-Model Glue Pipeline**: Identifies top reference model from turn ratings and invokes it to harmonize imports, interfaces, contracts, and type declarations into a unified codebase. Glued files are saved to `.moa/<runId>/workbench-glue`.
  - **Judge Re-Audit**: Aggregator/judge performs a final validation audit of the glued composite (checking cross-file imports, contracts, and antipatterns) before promoting files to the project root.
  - **Companion Plugin Integration**: Added links to companion plugin `dsh-time-machine` (https://github.com/goodandready/dsh-time-machine) near settings toggle and in workbench header for safe shadow Git pre-promotion checkpoints.
  - **Dedicated Workbench Module & Strict Server Line Limit**: Factored workbench scoring, top-model glue, judge re-check, and REST routes into `lib/moa-workbench.js` (473 lines). All server files in `lib/*.js` strictly remain $\le 600$ lines.
  - **Regression Test Suite**: Added `test/audit-issue-251.test.mjs` (10 tests) verifying score directives, JSON/table parsing, top-model selection, assemble execution, judge re-audit, schema defaults, and endpoint access control. Full test suite extended to 304 tests with 100% pass rate.

## 0.2.56

### Security
- **Test-Gate Child Process Sandbox Escape Prevention** (#260): Strictly omitted `--allow-child-process` from Node.js permissions when running candidate tests without OS-level container isolation (bubblewrap), preventing untrusted test scripts from spawning child processes with stripped `NODE_OPTIONS` to bypass filesystem boundaries and leak host secrets.
- **Dedicated Sandbox & Evasion Detection Module** (#260): Created `lib/moa-sandbox.js` (287 lines) housing OS sandbox probing (`isOsSandboxAvailable`), permission flags building (`buildPermOpts`), package manager command resolution (`resolveTestCommand`), runtime fence generation (`generateFenceCode`), and environment scrubbing (`getScrubbedEnv`). Reduced `lib/moa-test-gate.js` from 569 to 460 lines (<= 600).
- **Direct Test Runner Command Resolution** (#260): Implemented `resolveTestCommand` mapping `npm test`, `npm run test`, and `pnpm test` directly to the underlying `scripts.test` in `package.json`, enabling test execution under Node permission model without requiring `npm` child process invocation.
- **Fail-Closed Security Environment Defense** (#260): Guarded `child_process` methods in runtime fence with `ERR_ACCESS_DENIED`, and added detection of `NODE_OPTIONS` stripping attempts (`env -u`, `unset NODE_OPTIONS`, `export NODE_OPTIONS=`) in test commands and candidate `package.json`.
- **Comprehensive Regression Suite** (#260): Added `test/audit-issue-260.test.mjs` (6 tests) verifying child process denial, PoC exploit prevention, path containment, and command resolution. Full test suite expanded to 294 tests with 100% pass rate.

## 0.2.55

### Security
- **Fail-Closed DSH Connection Authentication & Reverse-Proxy Defense on All Endpoints** (#257): Guarded all HTTP read-endpoints (`/dsh-moa/status`, `/dsh-moa/models`, `/dsh-moa/presets`, `/dsh-moa/history`, `/dsh-moa/leaderboard`, `/dsh-moa/diff`, `/dsh-moa/history/export`, `/dsh-moa/runs/*`) and write-endpoints with authoritative `assertAuthorizedRequest(req, res, ctx)`. Unauthenticated remote network callers on LAN/WAN receive immediate HTTP 401 (`Authentication required`) or 403 (`Forbidden`), completely preventing leakage of user prompts, agent memory context, workspace filesystem paths, and candidate code solutions.
- **Reverse Proxy Injected AutoAuth Protection** (#257): Implemented `cookieNameForAuthority`, `isLoopbackCookieName`, and `hasClientCredentials` in `lib/access.js`. When requests are forwarded through reverse proxies (e.g. `dsh-lanmode` on port 3080 with `x-forwarded-for`), proxy-injected loopback cookies are excluded from client credential evaluation. Only authentic client session cookies or tokens grant admission.
- **Prefix Route Registration Fix** (#257): Standardized prefix route `/dsh-moa/runs` without trailing slash, ensuring exact and prefix matching in `dsh-host-webserver` functions correctly.
- **Dedicated Access Control Module & Strict Server Line Limits** (#257): Factored authentication evaluation, connection discovery (`getConnection`), `writeJson`, `readBody`, and workspace isolation validation (`isAllowedWorkspace`) into `lib/access.js` (202 lines), keeping `lib/routes.js` at 572 lines and strictly maintaining all server files below the 600-line architectural ceiling.
- **Comprehensive Regression Suite** (#257): Added `test/audit-issue-257.test.mjs` verifying connection service delegation, proxy forwarding rejection, cookie isolation, remote LAN rejection, cross-site CSRF blocking, and authenticated passthrough. Full test suite extended to 288 tests with 100% pass rate.

## 0.2.53

### Security
- **Workspace Boundary Containment & Pre-Promotion Checkpoint Enforcement** (#244): Validated `payload.cwd` in `/dsh-moa/run` against allowed workspaces boundary via `isAllowedWorkspace` and enforced `force: false, checkpoint: true` on pipeline execution to prevent uncheckpointed file overwrites.
- **Fail-Closed CSRF Defense on Socketless Requests** (#244): Strengthened `isSafeWriteRequest` to fail closed when socket remote address is absent.
- **Canonical Path Containment in Directory Cleanup** (#244): Confined `cleanMoaWorkspaces` via `assertPathContained` before recursively removing `.moa` directories.

## 0.2.52

### Fixed
- **Complete Token Accounting for Test Gate Logs and Multi-Judge Panel Post-Panel Abort** (#242): Expanded `calcSynthesisPromptTokens` to support both object and positional signatures while accounting for candidate `testResult.output` logs. Extended `createBudgetAbortPayload` to aggregate tokens and costs across all candidates and multi-judge panel runs.

## 0.2.51

### Fixed
- **Full React Lifecycle Verification for Client Component Hooks** (#187): In `test/audit-pack-232.test.mjs`, upgraded test `#187` from shallow element inspection to complete lifecycle verification of the client component (`MoACard` with `useMoASettings`) executed via React 18 Concurrent Root reconciler (`react-dom/client` `createRoot`) and `React.act`. Verified that component mounting triggers `React.useSyncExternalStore` subscription (`subscribeCount === 1`, 1 active listener in Set) and initial state snapshotting; verified that external store updates trigger React re-renders and re-snapshotting with updated configuration; and verified that component unmount cleanly runs hook cleanup, invoking unsubscribe (`unsubscribeCount === 1`, 0 listeners).

## 0.2.50

### Fixed
- **Filesystem Isolation Defense against Segmented / Computed Shell Evasion in Test Gate** (#161): Hardened `COMPUTED_SHELL_EVASION` regex in both `lib/moa-test-gate.js` and ephemeral preload fence `.moa-fence-*.cjs` to intercept command substitutions (`$(printf ...`, `$(echo ...`, `\`printf ...\``), segmented path concatenation (`printf %s '/' 'mnt'...`), and variable file sinks (`cat "$p"`, `printf ... > "$p"`, `>> "$p"`). Extended `scanPathTokensForLeak` to reconstruct segmented path string arguments assembled via `printf %s` and verify them against `allowedRoots`. Candidate test commands and scripts attempting outside reads or writes are strictly blocked before execution (`FAIL (code 1)`). Server file line count strictly preserved (569 lines <= 600).
- **Elimination of False Positives on Inert Base64 Data in Test Gate** (#225): Removed broad global base64 string decoding from `decodeEscapedStrings`, restricting static string normalization strictly to octal (`\ooo`) and hex (`\xHH`) string escape sequences. Inert base64 data strings (such as `Buffer.from("...", "base64")`) are no longer falsely converted into filesystem path tokens, allowing benign data processing to pass the test gate without compromising runtime path containment enforced by Node.js Permission Model and `.moa-fence-*.cjs`.
- **Elimination of Vacuous Assertions and Hardening of Contract Tests** (#187): In `test/issues-pack-234-236.test.mjs`, removed conditional guard around Fast Mode assertions in test `#215`, unconditionally verifying candidate trimming, single-candidate references, `isFastMode: true`, and non-failure status. Adjusted budget threshold to $0.01 so pipeline legitimately trims to one candidate and exercises direct Fast Mode. In test `#235`, increased history file rows to 160 (exceeding the 100 tail lines window) to guarantee cold fallback execution and verify negative caching. In `test/audit-pack-232.test.mjs`, upgraded test `#187` to load and execute the actual `lib/client.js` bundle, verifying `useSyncExternalStore` contract, store subscription lifecycle, referential stability of snapshots, and React component element validity.
- **Negative Caching and O(1) History Lookup for Missing IDs** (#235): Enhanced `getMoaRunById` in `lib/history.js` with negative caching (`cache.runsById.set(runId, null)`) and a `cache.fullyIndexed` flag set upon cold fallback scanning. Repeated lookups for missing run IDs now return `null` immediately from memory with 0 bytes read and 0 synchronous `readFileSync` calls, eliminating repeated multi-megabyte disk I/O on unindexed IDs. Server file line count strictly maintained at 594 lines (<= 600).

## 0.2.49

### Fixed
- **Strict Loopback Defense for State-Changing Write Endpoints** (#234): In `lib/updater.js`, hardened `isSafeWriteRequest` to unconditionally require a loopback remote address (`!isLoop => return false`). Non-loopback clients attempting to spoof `Origin == Host` (e.g. from local network) are strictly rejected with HTTP 403 on `/dsh-moa/run`, `/dsh-moa/promote`, `/presets`, and `/route-preset`.
- **In-Memory Caching and Tail Reading in History Lookup** (#235): Optimized `getMoaRunById` in `lib/history.js` to reuse `_historyCache` with an in-memory `runsById` map for O(1) repeat retrievals. For large history logs (>64KB), tail lines are read and indexed backwards via `readTailLinesSync` without parsing the entire multi-megabyte file. Preserved strict server line ceiling (593 lines $\le 600$).
- **Cleanup of Stale Archive Artifacts** (#236): Removed 10 obsolete `.tgz` archives (versions 0.2.17 through 0.2.43) from the DEV root workspace.
- **Dynamic Fast Mode Activation on Single-Candidate Budget Trim** (#215): In `lib/moa-runner.js`, when budget guard action `'trim'` reduces reference models to a single candidate and `!curator_synthesis`, `isFastMode` is dynamically set to `true`, directly returning the single model output and avoiding redundant downstream judge execution and empty peer critique.
- **Rate Limit Window Protection on Malformed / Empty Prompts** (#218): Moved `_lastRunTimestamp = now` in `lib/routes.js` after initial prompt validation (`if (!prompt.trim()) return 400`), ensuring invalid or empty requests do not consume the 1000ms cooldown window.
- **Clarification of Functional NLP Intent Classifier Tokens** (#219): Documented in `docs/design/DESIGN.md` that multilingual keyword lists (`fresh` and `mod`) in `isRefinementTask` are functional classifier tokens for detecting task intent on natural language inputs, not UI localization strings.
- **Confirmation of Workspace Path Containment** (#222): Documented in `docs/design/DESIGN.md` that candidate workspace file writes are strictly confined to the project directory via `assertPathContained` and `realpathSync` resolution in `lib/file-workspace.js`, preventing directory traversal and external path leaks.

## 0.2.48

### Fixed
- **Full-Context Synthesis Prompt in Budget Guard** (#158): Reordered pipeline synthesis phase in `lib/moa-runner.js` so that `synthesisPrompt` is materialized before evaluating downstream cost against remaining budget. `calcSynthesisPromptTokens` in `lib/moa-budget.js` incorporates actual test gate candidate output logs (~2035 chars per candidate) and multi-turn merge options. If projected judge execution cost exceeds `max_budget_usd` ($0.002), the pipeline immediately aborts with `createBudgetAbortPayload` without invoking the primary judge or fallback models.
- **Computed Shell & Node.js Evasion Defense in Test Gate** (#161): Added `decodeEscapedStrings(str)` in `lib/moa-test-gate.js` to normalize octal (`\057`), hex (`\x2f`), and base64 strings prior to token leakage scanning and CJS preload injection. Hardened `COMPUTED_SHELL_EVASION` regex and `.moa-fence-*.cjs` monkeypatches across `child_process` and `fs` methods, preventing sandbox breakout through dynamic escape sequences in shell or Node.js.
- **Refined Path Scanner to Eliminate False Positives on Route Literals and Base64 Data** (#225): Tightened `UNIX_ROOT_PREFIX` from broad `/run/user` to `run/(?:user/\d+|systemd|...)`, preventing false positive leak detections on legitimate HTTP route literals like `/run/user`. Restricted `COMPUTED_SHELL_EVASION` to piped shell command execution (`| sh`, `| bash`), allowing safe base64 data decoding (e.g. `result="$(printf T0s= | base64 -d)"`).
- **Comprehensive Regression & Contract Test Suite** (#187): Added `test/audit-pack-232.test.mjs` verifying all 7 boundary probe scenarios from audit #232 alongside real `useSyncExternalStore` contract requirements (referential stability of snapshots, listener subscriptions, and updates). Test suite passes 261/261 tests on Node 22 and 24.

## 0.2.47

### Fixed
- **REST Promote Candidate Version Pinning** (#230): In `POST /dsh-moa/promote`, when `runId` is omitted, the route resolves the latest recorded run and passes `runId: recordedRun.id` to `promoteCandidateWorkspace`, ensuring candidate files from the actual latest execution are promoted rather than legacy files from unversioned directory `.moa/candidate-N`.
- **Safe HTTP Route Literals in Test Gate Path Scanner** (#225): Refined `UNIX_ROOT_PREFIX` in `lib/moa-test-gate.js` and `.moa-fence-*.cjs` so system path checking specifically targets `/run/(?:user|systemd|lock|credentials|secrets|udev|initramfs|mount|shm|dbus|sshd|motd)` instead of all `/run/*` paths, and checks `/Users/(?:[a-zA-Z0-9_-]+)`, eliminating false-positive path leak denials on safe REST route literals like `"/run/job"` and `"/users/me"`.
- **Computed Shell & Node Evasion Prevention in Test Gate** (#161): Added `COMPUTED_SHELL_EVASION` regex intercepting base64 decoding (`base64 -d`), dynamic eval execution (`eval "$(..."`), xxd hex reversal (`xxd -r`), and piped shell commands, while hooking `child_process` and `node:fs` synchronous and asynchronous methods in `.moa-fence-*.cjs` to prevent escaping the workspace sandbox. Also added NVM directory support to allowed read roots for multi-node environments.
- **Full-Context Synthesis Budget Guard & Multi-Judge Capping** (#158): Upfront and phase-by-phase budget guards now accurately account for full context tokens including `judge_criteria` and synthesis template overhead (`calcSynthesisPromptTokens`). Multi-judge panels are capped at 2048 `maxTokens` per judge and budget-checked before fan-out (`runMultiJudgePhase`), preventing cost overflow beyond `max_budget_usd`.
- **Multi-Judge Panel Usage Accounting in Budget Aborts** (#168): Updated `createBudgetAbortPayload` in `lib/moa-budget.js` to preserve and aggregate multi-judge panel token counts and costs (`usage.totalTokens`, `usage.multiJudge`), ensuring reported token metrics accurately reflect all consumed tokens.
- **Memory-Only Settings Persistence Notification** (#213): Added distinct UI feedback `actions.saved_memory_only` ("Saved (in-memory only)" / "Сохранено (только в памяти)" / "已保存（仅内存）") in `useMoASettings` and client locales when server returns `persisted: false`, avoiding misleading "saved" confirmations when configuration is not durably persisted to disk.
- **Comprehensive Audit-47 Regression & Contract Test Suite** (#187): Added `test/re-audit-pack-47.test.mjs` verifying all 7 audit scenarios with 253/253 passing tests across Node 22 and 24, including triple parallel runs.

## 0.2.46

### Fixed
- **Large Diff V8 Call Stack Protection** (#227): Rewrote `computeLineDiff` large file linear fallback (>= 2000 lines) to pre-allocate result arrays and use `Array.prototype.concat` rather than spreading massive arrays into `push(...)`, eliminating `RangeError: Maximum call stack size exceeded` on 150k+ line files.
- **SSRF Redirect Hardening on Checkpoint Endpoint** (#210): Added explicit `redirect: 'error'` to `createPrePromotionCheckpoint` fetch options, preventing HTTP 307/308 redirects from escaping the local loopback boundary.
- **Fail-Closed Candidate Promotion & Workspace Authorization** (#208): In `POST /dsh-moa/promote`, enforced strict fail-closed checks on unrecorded `runId` (404), empty history (400), and caller-supplied `cwd` mismatches against recorded run `cwd` (403), ensuring promotion never writes to unauthorized workspaces.
- **Fail-Closed Candidate Diff on Empty History** (#211): In `GET /dsh-moa/diff`, returned 404 when history is empty or `runId` is unknown, and rejected mismatched query `cwd` with 403, preventing caller-selected directory reads.
- **Judge Fallback Chain Budget Guard Enforcement** (#158): Enforced phase budget check across each judge in `aggregator_fallbacks` before execution; when downstream judge execution cannot fit within remaining budget, expensive fallback models are skipped and the pipeline returns a structured budget abort payload within `max_budget_usd`.
- **Test Gate Route Literal Path Tokenizer Refinement** (#225): Refined `scanPathTokensForLeak` to only treat system root directories (`/home`, `/root`, `/etc`, `/var`, `/tmp`, etc.) as absolute host paths, eliminating false-positive sandbox access denials on safe route string literals (e.g. `"/health"`, `"/api/v1"`).
- **Test Gate Recursive Workspace & Fence Argument Inspection** (#161): Enabled recursive directory scanning (`readdirSync(..., { recursive: true })`) in candidate test staging to inspect nested scripts (e.g. `scripts/payload.sh`), and enhanced the `.moa-fence-*.cjs` security monkeypatch with `scanStringForPaths` to inspect command strings in `cp.spawn`, `cp.exec`, and `cp.spawnSync`.
- **In-Memory Settings Synchronization & Persistence Diagnostics** (#213): Updated in-memory config object in place within `saveConfig` while preserving dynamic getters, and included `persisted: false/true` diagnostic in `POST /dsh-moa/presets` to accurately report whether settings were durably written to a settings service.
- **Contract & Regression Test Suite Expansion** (#187): Added comprehensive `test/re-audit-pack-46.test.mjs` verifying all 9 audit defect scenarios; full test suite passing with 243/243 green tests across Node 22 and Node 24, including triple parallel runs.

## 0.2.45

### Fixed
- **Budget Action 'trim' Round 2 Reassignment Fix** (#224): Resolved a `TypeError: Assignment to constant variable` crash in `lib/moa-runner.js` when `budget_action: 'trim'` skips Round 2 peer critique. Round 2 is now cleanly skipped and pipeline execution proceeds to consensus synthesis within budget.
- **Test Gate Path Tokenizer Sanitization** (#225): Sanitized absolute URL schemes (`http://`, `https://`) and standard module schemes (`node:`, `file:`, `npm:`) in `scanPathTokensForLeak`, preventing false-positive access violations on safe URLs and standard relative package scripts (e.g., `node test/suite.cjs`).
- **Runtime Judge Synthesis Budget Enforcement** (#158): Prevented projected cost overruns in Judge Synthesis under `action: 'trim'`; if downstream judge execution cannot fit within the remaining budget, the pipeline safely terminates with a structured budget abort payload rather than exceeding `max_budget_usd`.
- **Test Gate Process Tree & Nested Script Hardening** (#161): Intercepted nested shell script execution within candidate workspaces and hooked `child_process.spawnSync`, `execSync`, and `exec` inside the ephemeral test gate fence (`.moa-fence-*.cjs`) to prevent sandbox escapes.
- **Space-Safe Path Placeholder Replacement** (#216): Enclosed expanded `{candidateDir}`, `{baseDir}`, and `{stageDir}` placeholders containing whitespace in quotes, preserving single-argument tokenization across test commands.
- **Accurate Peer Critique Error Logging** (#214): Corrected error classification in Round 2 catch block to report provider and critique failures accurately rather than mislabeling them as cost estimation errors.
- **SSRF Protection on Time Machine Endpoint** (#210): Enforced loopback host restrictions on `timeMachineUrl` across `/dsh-moa/run` and `createPrePromotionCheckpoint`, rejecting non-local target URLs.
- **Authorized Workspace Verification on Candidate Diff & Promotion** (#211): Verified that supplied `cwd` matches recorded run `cwd` in `/dsh-moa/diff` and `/dsh-moa/promote`, returning 403 Forbidden on directory mismatches.
- **JSON Payload Cleanup** (#217): Removed unsupported `checkpointFn` deserialization from `POST /dsh-moa/run`.
- **Standard `npm test` Support inside Test Gate** (#206): Enabled `--allow-child-process` with restricted executable roots and isolated `.moa-home`, allowing package managers like npm (`@npmcli/promise-spawn`) to execute local test runners (e.g. `node check.cjs`) without failing with `ERR_ACCESS_DENIED`.
- **Fast Mode Checkpoint Failure Telemetry & History Preservation** (#207): Preserved accumulated candidate token usage, dollar cost, and reference metadata upon promotion/checkpoint failures in fast mode, and persisted failed run records with error details to history rather than resetting usage to zero.
- **Contract & Regression Test Suite Hardening** (#187): Removed swallowed exceptions in test client hooks (`useEffect`) and created `test/re-audit-pack-45.test.mjs` verifying exact auditor reproductions for budget limits, sandbox host escape blocking, standard npm test containment, and fast mode failure usage accounting.

## 0.2.44

### Fixed
- **Fast Mode Checkpoint Failure Propagation** (#201): Fast mode with a single candidate now strictly propagates workspace promotion failures instead of swallowing them, returning a failed pipeline result and HTTP 500 when promotion errors occur.
- **Read-Only GET Diff & Workspace Safety** (#202): Removed filesystem mutation (`unlinkSync`) from candidate path resolution (`resolveCandidateFolder`), preventing unexpected deletion of external `.moa` symlinks during read operations and diff queries.
- **Project Context Budget Guardrails** (#158): Shifted project context collection ahead of upfront budget validation, ensuring large workspace contexts and refined prompts are factored into cost estimation before initiating LLM calls.
- **Test Gate Sandboxing Hardening** (#161): Removed `--allow-child-process` and excluded sensitive user paths (such as `~/.npmrc`) from test gate execution, while adding directory confinement checks to block unauthorized host file execution.
- **Settings Locale Parity** (#175): Replaced raw untranslated error messages in settings persistence with localized keys (`status.error_saving`), ensuring full English and Chinese locale parity.
- **Node 22 Event Loop & Parallel Test Resilience** (#187): Eliminated premature test cancellation under Node 22 (`cancelledByParent`) by keeping candidate timers referenced and actively managed, and isolated temporary pricing cache paths to prevent parallel test runner races.

## 0.2.37

### Fixed
- **DSH 0.2.0-rc.2 Prepared-Call Contract Parity** (#155): Assembled full `LlmCallConfig` (`provider`, `model`, `temperature`, `maxTokens`, `stop`, `reasoningEffort`) prior to `prepareCall` and forwarded `prep.config` to `prep.stream`, satisfying strict `callConfigEquals` validation in DSH 0.2.0-rc.2 while maintaining legacy positional fallback.
- **AbortSignal Stream Interruption & Promotion Guard** (#156): Connected external `signal` to LLM streaming via `combineSignals` (`AbortSignal.any`) and added strict cancellation checks across all phase boundaries in `moa-runner.js`, preventing late workspace writes and file promotions on cancelled turns.
- **Terminal Error & Stream Failure Classification** (#157): Replaced silent acceptance of empty text upon model error with explicit detection of `finish(error)`, `finish(aborted)`, `type: 'error'`, and `EMPTY_RESPONSE`, throwing typed exceptions with original failure codes to trigger retry/fallback policies.
- **Dedicated Timeout & Isolated Controller for Local Fallbacks** (#163): Provided independent timeout budget and fresh `AbortController` linked to the turn signal for each local fallback candidate, resolving an issue where cloud timeouts starved local models of execution time.

### Added
- **Strict Integration Contract Tests** (#187): Added `test/llm-contracts.test.mjs` verifying runtime contracts for prepared calls, in-flight abort propagation, late promotion blockage, stream error chunk classification, and isolated local fallback execution.

## 0.2.36

### Fixed
- **Settings Persistence** (#147): Preserved existing `prices`, `smart_routing_enabled`, and `smart_routing_model` when saving updated presets via `POST /dsh-moa/presets`.
- **Stream Generator Resilience** (#149): Ensured candidate workspaces (`.moa/`) are cleanly removed even if the streaming async generator is cancelled or terminated early, using an internal AbortController with duck-typed signal support.
- **Pricing Catalog Cleanup** (#150, #151): Removed unused static `CACHE_FILE` export and purged non-standard proprietary model entries (`deepseek-v4-flash`, `deepseek-v4-pro`) from `DIRECT_VENDOR_RATES`.
- **Worktree Hygiene** (#152): Removed stale `.worktrees/fix/settings-contract` left behind after PR #145.

### Refactored
- **Core Facade Decoupling** (#148): Extracted Schemastery schemas and `plainConfig` into `lib/moa-schema.js` and LLM dispatcher into `lib/moa-llm.js`, reducing `lib/index.js` from 452 lines to 253 lines (well under the 300-line standard).

## 0.2.34

### Fixed
- **Settings Contract** (#145): Standardized settings schema contract and resolved profile settings box leaks.

## 0.2.33

### Fixed
- **Peer gate on DSH 0.2.0-rc.1** (#58): DSH skips a profile bundle whose `peerDependencies` exclude the running version, so this plugin was absent from the profile with no error in the UI. Every `@deepseek-ai/dsh-*` peer now names both the 0.1.7-rc.2 and 0.2.0-rc.1 lines, because semver does not admit a prerelease of the next minor into a range that does not name it.

Notable changes to `@goodandready/dsh-moa`.

## 0.2.32

### Fixed
- **UI & Web Client Stability**:
  - Fixed runtime `ReferenceError: allModels is not defined` when rendering Fallback Judges in CardAggregator (#137).
  - Corrected `SearchableModelPicker` contract and prop forwarding (`provider`, `model`, `onChange`, `availableModels`, `t`) in fallback judge selector (#137).
  - Fully eliminated proprietary model names (`opencode-go`, `gpt-5.6-sol`, `deepseek-v4-flash`, `codex`) across all `src/client/` fragments and regenerated `lib/client.js` (#138).
- **Core Lifecycle & Session Safety**:
  - Wrapped `agent/pre-step` and `agent/request` listeners in `ctx.effect` to ensure clean unregistration on plugin reload (#139).
  - Added session timer cleanup in `ctx.on('dispose')` to avoid memory and interval leaks (#139).
  - Avoided duplicate `.dsh/.dsh` directory nesting when `DSH_HOME` already ends with `.dsh` in `lib/pricing.js` and `lib/history.js` (#140).
  - Cleaned unused imports (`os`, `runMoAPipeline`, `isSafeWriteRequest` in `lib/index.js`; `join`, `homedir` in `lib/moa-runner.js`) (#142, #130).
- **Context, Streaming & Pricing Accuracy**:
  - Made `maxHistoryTokens` budget active in `pruneMultiTurnMessages` within `lib/moa-context.js` (#129).
  - Accurately aggregated `totalInputTokens` and `totalOutputTokens` in `summarizeMoAUsage` and forwarded to `streamMoATurn` (#141).
  - Removed dead exports and unused `getHistoryFilePath`, `DEFAULT_HISTORY_DIR`, `DEFAULT_HISTORY_FILE` in `lib/history.js` (#128).
- **Test Infrastructure**:
  - Isolated test client builds to temporary destinations in `scripts/build-client.mjs`, avoiding test-time file overwrite races (#127).

## 0.2.30

### Fixed
- **Test History Isolation & Production Clean-Up**:
  - Isolated test suite execution from production `~/.dsh` directory via `DSH_HOME`, `DSH_HISTORY_DIR`, and test environment auto-detection (#132).
  - Cleaned existing production `moa-history.jsonl` of 1007 test runs with backup at `~/.dsh/moa-history.jsonl.bak-audit-clean-20260928` (#132).
  - Added protective regression test verifying real user history is never modified during test runs (#132).
- **Provider Sanitization & Default Model Fallback**:
  - Eliminated hardcoded proprietary models (`opencode-go`, `gpt-5.6-sol`, `grok`, `jev`) from schemas, presets, client and READMEs (#133).
  - Implemented dynamic agent default model fallback for unconfigured model slots (#133).
  - Removed `hermes-agent` keyword from `package.json` (#133).
- **Time-Machine Checkpoint Port Resolution & Safety Guard**:
  - Resolved time-machine checkpoint endpoint dynamically via `ctx.webServer.port` and direct `timeMachineEngine` Cordis service (#131).
  - Eliminated `x-dsh-trusted: 1` header from HTTP checkpoint requests (#131).
  - Blocked candidate file promotion without a verified snapshot unless `force: true` is explicitly passed (#131).
- **Self-Updater Lock Recovery & Concurrency Guard**:
  - Prevented dangling `package.json.lock` by cleaning up dead PID locks on updater timeout (#135).
  - Added PID liveness check returning HTTP 409 Conflict when another plugin installation is in progress (#135).

## 0.2.25

### Fixed
- **Provider-Scoped and Specific Model Rate Resolution**:
  - Refactored `resolveModelRates` in `lib/pricing.js` to eliminate arbitrary substring collision where generic model queries returned rates from unrelated models of the same family (#100).
  - Prioritized exact `fullKey` and exact `model` matches case-insensitively, followed by provider-scoped suffix matches (#100).
  - Implemented candidate scoring prioritizing the requested provider and selecting the longest matching ID for model revisions and variants (#100).
  - Added safe fallback rate when ambiguous queries match multiple distinct models with differing tariffs (#100).
  - Added regression test suite in `test/pricing.test.mjs` verifying exact match priority, revision scoring, and collision prevention (#100).

## 0.2.23

### Fixed
- Settings no longer wait on the removed settingsScope service. The client uses configForms (#105).

## 0.2.22

### Fixed
- **DSH 0.1.7 Settings Architecture Migration**:
  - Completely removed deprecated `sctx.settings.register` API call and masking try/catch block, eliminating boot warnings on `@deepseek-ai/dsh@0.1.7-alpha.1` (#98).
  - Config schema and all editable fields (`enabled`, `default_preset`, `prices`, `presets`) declared `.volatile()` conforming to DSH 0.1.7 `@deepseek-ai/dsh-settings` `volatileForm` specification (#98).
  - Added optional policy hook `settings.configure({ auto: false }, ctx.fiber)` to suppress duplicate auto-generated settings forms in favour of custom interactive plugin cards in `settings.plugin.item` (#98).
  - Decoupled plugin business logic from `settings` service dependency so the plugin runs autonomously in any DSH environment (#98).
  - Added schema validation, in-memory live updates, and DSH settings persistence via `saveConfig` in `POST /dsh-moa/presets` (#98).
  - Added automated test suite `test/dsh-017-settings.test.mjs` verifying schema volatility, absence of legacy register calls, independent startup without settings service, and REST persistence (#98).

## 0.2.21

### Performance & Security
- **In-Memory Leaderboard Aggregation Cache & Chunked History**: Added mtime-invalidated `_historyCache` and `readTailLinesSync` to parse only recent runs in 64 KB chunks backwards from EOF, eliminating event loop blocking and full-file memory allocations on 10MB JSONL logs (#91).
- **LCS Diff Prefix/Suffix Trimming**: Optimized `computeLineDiff` with common prefix/suffix trimming before LCS matrix construction, reducing DP allocation by >99% for localized edits on large files (>2000 lines) and eliminating the full-file replacement fallback (#92).
- **Sandboxed Workspace Path Traversal Sanitization**: Hardened file workspace operations (`writeCandidateWorkspace`, `promoteCandidateWorkspace`, `readCandidateFiles`, `/dsh-moa/diff`) against directory traversal attacks via `isSafeRelativePath` and `assertPathContained` (#93).
- **Immediate Socket Termination on Candidate Timeout**: Added `abortControllers[i].abort()` directly within candidate timeout handlers in `runReferencesParallel` to prevent leaked sockets and wasted token generation (#94).
- **Reactive Preset Leaderboard Filtering in Web UI**: Integrated reactive `useEffect` on `leaderboardPresetFilter` in settings hook, ensuring the leaderboard table updates immediately when switching presets (#95).
- **Concurrent Provider Resolution & Caching**: Parallelized `/dsh-moa/models` queries across providers using `Promise.allSettled` with individual 2s timeouts and 60s in-memory caching (#96).

## 0.2.20

### Added
- **Candidate Diff Viewer**: Interactive side-by-side and unified visual difference inspector (`src/client/55-diff-viewer.js`, `GET /dsh-moa/diff`) comparing proposals from any advisor candidate or the judge's synthesized deliverable, powered by an in-memory LCS line diff algorithm with zero external dependencies (#84).
- **Specialist Candidate Personas (`role_persona`)**: Proposer archetypes (`minimalist`, `robustness`, `performance`, `tester`, `general`) with explicit judge focus awareness during peer review and Round 2 Consilium evaluation (#85).
- **Pre-Promotion Git Checkpoints**: Best-effort automatic shadow Git snapshots via `dsh-time-machine` (`POST /dsh-time-machine/create`) before promoting candidate workspace files to prevent data loss (#86).
- **Modularized Client Architecture**: Decomposed client codebase into 17 single-responsibility modules in `src/client/*.js` with deterministic build script `scripts/build-client.mjs` (`npm run build:client`) and automated build validation (#83).
- **Sanitized Mirror Publication**: Automated GitHub mirror synchronization script `scripts/publish-github.sh` with strict `--check` dry-run validation, enforcing product allowlist and rejecting internal/sensitive files (#81).

## 0.2.19

### Fixed
- **Settings reachable again on the plugin's own page**: the current DSH core
  (0.1.6-alpha.2) renders a plugin's configuration page only for entries registered
  in the plugin-list seat `plugins.item`. The view-aware card is now registered there
  too (`id: 'dsh-moa'`, order 35, static label) — registered on its own rather than
  through the keyed helper, because that seat needs an `id` instead of a `key`; the
  row seat and the legacy card stay as fallbacks.
- The client contract test now expects the three seats in order.

## 0.2.18

### Fixed
- **Settings reachable again**: the card registered into `settings.plugin.item`, a
  slot the current DSH core (0.1.6-alpha.2) no longer renders, so the plugin's
  settings were unreachable. The surface now registers into the Plugins page row
  seat `plugins.row.config`, keyed `@goodandready/dsh-moa#dsh-moa`
  (`rowConfigKey(package, rowId)`): the plugin's row gains a configure control whose
  page is the settings form (`view: 'page'`, expanded and without our card chrome —
  the host page draws the title, icon, crumb and padding) plus a one-line state for
  `view: 'summary'`. The legacy seat stays registered as a fallback for older cores.

### Changed
- `test/client-contract.test.mjs` now expects both seats in order (row seat first)
  and checks the row key.
