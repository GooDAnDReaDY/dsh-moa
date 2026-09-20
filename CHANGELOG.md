# Changelog

Notable changes to `@goodandready/dsh-moa`.

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
