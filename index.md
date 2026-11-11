# dsh-moa

Mixture of Agents (MoA) plugin for DeepSeek Harness with `/moa` slash command.

- Status: maintained (`@goodandready/dsh-moa`)
- Tests & Guards: `npm test` (`node scripts/build-client.mjs --check && node scripts/pack-check.mjs && node --import ./test/_setup.mjs --test test/*.test.mjs`)
- Client Build: `npm run build:client` (builds `lib/client.js`, `lib/client.panels.js`, `lib/client.zh.js`)
- Pack outside checkout: `npm pack --pack-destination /tmp`
- Deploy: `./deploy.sh` (pre-deploy checks; `--install` installs the published npm version into a DSH profile)
- [Design Contract](docs/design/DESIGN.md)
- [AGENTS Guide](AGENTS.md)
- [README](README.md)
