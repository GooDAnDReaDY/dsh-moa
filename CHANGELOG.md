# Changelog

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
