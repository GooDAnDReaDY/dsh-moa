# AGENTS.md for dsh-moa

## Project Scope
- Plugin: @goodandready/dsh-moa
- Architecture: DeepSeek Harness Cordis plugin + Web client
- Base Directory: dhsplugins/dsh-moa

## Rules
- Tests must pass: `node --test test/*.test.mjs`
- Test runs must never write to the real `~/.dsh/moa-history.jsonl`: pass a
  temp `historyFilePath` to `runMoAPipeline` / `streamMoATurn` in tests.
- Settings registered only via settings.plugin.item card format with key: 'dsh-moa'.
- All CSS classes must use moa- prefix.
- Use only --dsw-alias-* theme variables (tints via color-mix on theme vars).
- English is the canonical source language for UI strings; the ru translation
  is provided by the DSH translation plugin, not bundled here.
- One-shot turns must guarantee model restoration in finally.
- No hardcoded paths, credentials or machine identities.
