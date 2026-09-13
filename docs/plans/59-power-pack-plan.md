# Plan 59: MoA Power Pack v0.2.13

## Objectives
Implement the 5 approved feature expansions for `@goodandready/dsh-moa`:
1. User Candidate Override (`allow_candidate_override: boolean`).
2. 10 specialized built-in presets + candidate role personas (`role_persona`).
3. Syntax Pre-check Gate with Judge Auto-Fix Directive.
4. Consilium / Peer Critique Round 2 (`peer_critique_enabled: boolean`).
5. Analytics filtering by preset and CSV/JSON export.

---

## Technical Specifications

### 1. User Candidate Override
- **Schema**: `PresetSchema` field `allow_candidate_override: z.boolean().default(false)`.
- **Backend**:
  - `writeCandidateWorkspace` stores candidates in `.moa-workspaces/<runId>/candidate-<index>`.
  - Add API route `POST /dsh-moa/promote` with `{ runId, candidateIndex }` that promotes specified candidate files to the project root.
  - In `formatMoAResponse`, if enabled, render interactive action hints:
    `🔄 Alternative Candidate Override: /moa promote <runId> <candidateIndex>`
- **Client**: Add toggle in Section 1 / Section 3 of `lib/client.js`.

### 2. 10 Built-in Presets & Candidate Role Personas
- **Presets**:
  1. `default`: General MoA ensemble.
  2. `code-review`: Zero regressions, backward compatibility, edge cases.
  3. `fast-audit`: Quorum mitigation, low latency.
  4. `deep-architect`: System architecture, API contracts, curator synthesis.
  5. `bug-hunter`: Concurrency, race conditions, memory leaks, null safety.
  6. `refactor-cleanup`: Ponytail minimalism, stdlib first, zero external dependencies.
  7. `frontend-ui`: Ergonomics, DSH design tokens, responsive layout, no AI slop.
  8. `security-audit`: OWASP Top 10, input sanitization, safe error handling.
  9. `math-logic`: Algorithmic correctness, asymptotic proofs.
  10. `creative-brainstorm`: High divergence, alternative architectures.
- **Candidate Roles (`role_persona`)**:
  - `minimalist`: Ponytail style, stdlib only, fewest lines.
  - `robustness`: Paranoid validation, edge cases, defensive typing.
  - `performance`: Memory efficiency, asymptotic complexity.
  - `tester`: TDD, unit test coverage, mock isolation.
  - `general`: Standard expert proposer.

### 3. Syntax Pre-check Gate with Judge Auto-fix Directive
- **Checker**:
  - JS/MJS/CJS: `new vm.Script(code)` from built-in `node:vm` (instant, memory-safe).
  - JSON: `JSON.parse(code)`.
  - Python: `python3 -m py_compile`.
- **Judge Directive**:
  - If a candidate has a syntax warning, inform the judge:
    `CRITICAL JUDGE DIRECTIVE: If Candidate X has the best overall architecture or solution despite this syntax error, DO NOT reject them! You MUST correct the syntax error directly during final code synthesis and declare Candidate X the winner.`

### 4. Consilium / Peer Critique Round 2
- **Schema**: `peer_critique_enabled: z.boolean().default(false)`.
- **Pipeline**:
  - If enabled and `candidates.length >= 2`, run Round 2:
    - Pass anonymized candidate proposals to each proposer.
    - Collect refined solutions with peer critique.
    - Supply improved proposals to Judge/Curator.

### 5. Analytics Filtering & CSV/JSON Export
- **Leaderboard Filter**: `getMoaLeaderboard(historyFilePath, limit, filterPreset)`.
- **Export Endpoints**:
  - `GET /dsh-moa/leaderboard?preset=<name>&format=json|csv`.
- **Client UI**:
  - Dropdown filter by preset in Section 4.
  - `Export CSV` / `Export JSON` action buttons.

---

## Verification
- Unit tests for all 5 features in `test/moa-power-pack.test.mjs`.
- Total test suite passing with 0 regressions.
- Live deployment to `/home/vadim/.dsh/profiles/web` on MiniPC and endpoint verification.
