# AGENTS.md for dsh-moa

## Project Scope
- Plugin: @goodandready/dsh-moa
- Architecture: DeepSeek Harness Cordis plugin + Web client
- Base Directory: dhsplugins/dsh-moa

## Rules
- Tests must pass: 
ode --test test/*.test.mjs
- Settings registered only via settings.plugin.item card format with key: 'dsh-moa'.
- All CSS classes must use moa- prefix.
- Use only --dsw-alias-* theme variables.
- One-shot turns must guarantee model restoration in inally.
- No hardcoded paths, credentials or machine identities.
