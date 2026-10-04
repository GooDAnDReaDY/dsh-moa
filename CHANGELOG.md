# Changelog

## 0.2.45

### Fixed
- **Multi-Phase Upfront and In-Flight Budget Guardrails** (#158): Upfront cost estimation now factors in base system prompt overhead, Round 2 peer critique input tokens, and downstream judge synthesis tokens, preventing runs configured with a tight budget (e.g., $0.001) from overrun. Added phase-by-phase runtime guardrails before Round 2 and before Judge synthesis to abort or trim execution when in-flight consumption approaches budget limits.
- **Test Gate Process Tree Containment & Script Path Scanning** (#161): Replaced path-only command checks with recursive script content path scanning across test commands and package.json scripts, rejecting scripts attempting to access paths outside candidate workspaces. Added an ephemeral Node.js fence module (`NODE_OPTIONS="--require .moa-fence-*.cjs"`) that intercepts child process invocations (`spawn`, `execFile`, `execFileSync`) to enforce sandbox boundaries across the process tree.
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
