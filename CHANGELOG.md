# Changelog

Notable changes to `@goodandready/dsh-moa`.

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
