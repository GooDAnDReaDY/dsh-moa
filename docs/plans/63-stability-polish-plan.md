# Implementation Plan - Issue #63: Pipeline Stability and Quality Polish

## 1. Context & Objectives
Polish runtime stability, error recovery, token efficiency, and file generation integrity across `@goodandready/dsh-moa`:
1. **Refinement Context & Heuristic**: Fix `isRefinementTask` parameter handling in `moa-runner.js` and format collected files into Markdown code fences via `formatProjectContext(files)`, preventing `[object Object]` prompt injection.
2. **Round 2 Workspace Sync**: Save refined files to `.moa/candidate-N/` in Consilium Round 2 so promoted winner files contain peer-critiqued code rather than stale Round 1 drafts.
3. **End-to-End AbortSignal Propagation**: Propagate `signal` from `streamMoATurn` through `runMoAPipeline`, `runReferencesParallel`, Round 2 calls, and judge synthesis, cancelling in-flight requests and preventing token waste.
4. **Context Window Protection**: Apply `stripOrSummarizeCode` in Round 2 peer review and judge synthesis prompts when candidate outputs exceed threshold.
5. **Architectural Standard**: Maintain file size of `lib/moa-runner.js` strictly under 800 lines.

## 2. Modules Impacted
- `lib/file-workspace.js`: Add `formatProjectContext`, enhance `isRefinementTask`.
- `lib/moa-prompts.js`: Context protection in `buildPeerCritiquePrompt` & `buildSynthesisPrompt`.
- `lib/moa-runner.js`: `signal` propagation, Round 2 workspace persistence, refinement context formatting.
- `test/`: Add regression tests for all fixes.
