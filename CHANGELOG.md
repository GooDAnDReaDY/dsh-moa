# Changelog

Notable changes to `@goodandready/dsh-moa`.

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
