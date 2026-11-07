// Plugin Settings Card (settings.plugin.item).
//
// Aligned with dsh-clinebot design language:
// - Header with real status chips (host online/offline/disabled via /dsh-moa/status)
// - Clean section cards (.moa-section-card) using native DSH design tokens (--dsw-alias-*)
// - Segmented preset selectors and count pills
// - Refined temperature sliders and searchable model picker
// - Telemetry summary grid fed by /dsh-moa/history
// - Robust error boundary and configForms reactivity
//
// English is the canonical source language; the ru translation is provided
// by the DSH translation plugin at runtime (no bundled ru duplicate).

window.__ModuleLoader__.load({
  id: '@goodandready/dsh-moa',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')
    const NS = 'dsh-moa'
    // Plugins page row seat (DSH 0.1.6-alpha.2): key = '<package name>#<row id>'.
    const PKG = '@goodandready/dsh-moa'
    const ROW_ID = 'dsh-moa'
    const ROW_CONFIG_KEY = PKG + '#' + ROW_ID
    const TITLE = 'Mixture of Agents (MoA)'
    const SUBTITLE = 'Ensemble parallel candidate generation with judge synthesis via /moa.'

    let rootCtx = null

