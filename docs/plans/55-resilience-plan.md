# Task Plan: MoA Resilience, Async I/O, Configurable Timeouts and Modularization

Issue: #55
Branch: `feat/moa-resilience-refactor`
Worktree: `/mnt/external/Project/DEV/dhsplugins/dsh-moa/.worktrees/feat/moa-resilience-refactor`

## Objectives
1. Modularize `lib/moa-runner.js` into clean, focused modules under 800 lines:
   - `lib/moa-prompts.js`: Rubric, system prompts, synthesis and questionnaire prompts.
   - `lib/moa-parser.js`: Output parsing, winner extraction, recommended assembler, file block extraction.
   - `lib/moa-runner.js`: Focused pipeline orchestrator.
2. Optimize storage in `lib/history.js`:
   - Non-blocking async append via `fs.promises.appendFile`.
   - File size rotation (>10MB or >5000 lines -> `.jsonl.1` backup).
   - Fast tail reader for paginated history to avoid loading gigantic files in memory.
3. Configurable timeouts in `lib/index.js` and `PresetSchema`:
   - `reference_timeout_sec` (default: 60s).
   - `aggregator_timeout_sec` (default: 180s).
   - Forward timeouts into `callLlm` and `AbortController`.
4. Fallback recovery on malformed judge output:
   - When judge output is empty or truncated, cleanly fall back to `aggregator_fallbacks` before degrading.
5. Verification & Tests:
   - Add unit tests in `test/moa-resilience.test.mjs`.
   - Verify existing 60/60 tests pass without regression.
   - Update `docs/design/DESIGN.md` and README files.

## Phases
- [x] Phase 1: Planning & Setup (Issue #55, isolated worktree created, test suite verified)
- [ ] Phase 2: Modularization of moa-runner (`lib/moa-prompts.js`, `lib/moa-parser.js`)
- [ ] Phase 3: History Storage Rotation & Async I/O (`lib/history.js`)
- [ ] Phase 4: Configurable Timeouts & Fallback Recovery (`lib/index.js`, `lib/moa-runner.js`)
- [ ] Phase 5: Test Coverage & Verification (`test/moa-resilience.test.mjs`)
- [ ] Phase 6: Documentation, PR, Merge, Release & Deploy
