# AGENTS.md for dsh-moa

## Project Scope
- Plugin: @goodandready/dsh-moa
- Architecture: DeepSeek Harness Cordis plugin + Web client
- Base Directory: dhsplugins/dsh-moa

## Rules
- Tests must pass: `npm test` (runs `build-client.mjs --check`, `pack-check.mjs`, and `node --test test/*.test.mjs`).
- Packaging hygiene: never leave `*.tgz` release archives inside the repository checkout; always build tarballs outside checkout via `npm pack --pack-destination /tmp`. `npm test` fails on any `*.tgz` in the root or any packed file > 262,144 bytes (warns at >= 256,000 bytes).
- Internal files (`AGENTS.md`, `index.md`, `deploy.sh`) are tracked in Gitea for reproducibility, but excluded from `git archive` (`.gitattributes export-ignore`), `npm` (`package.json.files` allowlist), and GitHub (`scripts/publish-github.sh`).
- Client fragments: edit source modules under `src/client/`, `src/client-panels/`, or `src/client-zh/`, and rebuild with `npm run build:client` (never hand-edit `lib/client*.js`).
- Test runs must never write to the real `~/.dsh/moa-history.jsonl`: pass a temp `historyFilePath` to `runMoAPipeline` / `streamMoATurn` in tests.
- Settings registered only via `settings.plugin.item` card format with `key: 'dsh-moa'` (plus `plugins.item` and `plugins.row.config`).
- All CSS classes must use `moa-` prefix.
- Use only `--dsw-alias-*` theme variables (tints via `color-mix` on theme vars).
- English is the canonical source language for UI strings; Simplified Chinese (`zh`) is loaded lazily from `lib/client.zh.js`, and Russian translation is provided by `dsh-russian-lang`.
- One-shot turns must guarantee model restoration in `finally`.
- No hardcoded paths, credentials, or machine identities.
