import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Config, PresetSchema } from '../lib/moa-schema.js'
import { buildTuiSection } from '../lib/tui-settings.js'
import { executeTestGateForCandidates } from '../lib/moa-test-gate.js'
import { writeCandidateWorkspace } from '../lib/file-workspace.js'

/**
 * Global (top-level) keys legitimately owned by Config: master switch, active
 * preset, smart routing defaults, pricing, PR review bot credentials and
 * ecosystem toggles. Everything else is preset-scoped (#365).
 */
const GLOBAL_KEYS = new Set([
  'enabled',
  'default_preset',
  'smart_routing_enabled',
  'smart_routing_model',
  'prices',
  'presets',
  'pr_review_bot_enabled',
  'pr_review_gitea_token',
  'pr_review_webhook_secret',
  'pr_review_strict_blocking',
  'pr_review_allowed_repos',
  'enable_ecosystem_context',
  'sync_with_memory_brain',
])

test('Issue #365: no Config key duplicates a PresetSchema-only flag', () => {
  const configKeys = new Set(Object.keys(Config.dict || Config.fields || {}))
  const presetKeys = new Set(Object.keys(PresetSchema.dict || PresetSchema.fields || {}))
  // Config keys must all be in the global allowlist
  for (const key of configKeys) {
    assert.ok(GLOBAL_KEYS.has(key), `Config key "${key}" must be in the global allowlist (single owner for preset flags)`)
  }
  // Preset-only flags must never reappear top-level
  const presetOnlyFlags = ['test_gate_enabled', 'interactive_workbench_enabled', 'ask_clarifying_questions',
    'uncertainty_scoring_enabled', 'subagent_swarm_enabled', 'adaptive_personas_enabled', 'knowledge_path',
    'security_gate_enabled', 'mutation_testing_enabled', 'cove_verification_enabled', 'profiler_gate_enabled']
  for (const flag of presetOnlyFlags) {
    assert.equal(configKeys.has(flag), false, `Config must not declare preset-scoped flag "${flag}"`)
    assert.ok(presetKeys.has(flag), `PresetSchema must own "${flag}"`)
  }
})

test('Issue #365: Config still validates and defaults the global surface', () => {
  const parsed = Config({})
  assert.equal(parsed.enabled, true)
  assert.equal(parsed.default_preset, 'default')
  assert.equal(parsed.enable_ecosystem_context, true)
  assert.equal(parsed.sync_with_memory_brain, true)
  assert.ok(Array.isArray(parsed.presets) && parsed.presets.length >= 3)
  assert.equal(parsed.pr_review_bot_enabled, false)
})

test('Issue #365: TUI preset toggles address the active preset inside cfg.presets', () => {
  const cfg = {
    enabled: true,
    default_preset: 'fast',
    presets: [
      { name: 'default', test_gate_enabled: false },
      { name: 'fast', test_gate_enabled: false },
      { name: 'deep-reasoning', test_gate_enabled: false },
    ],
  }
  const section = buildTuiSection({ live: () => cfg })

  const toggles = Object.fromEntries(section.fields.map((f) => [f.path[f.path.length - 1], f]))
  for (const flag of ['interactive_workbench_enabled', 'ask_clarifying_questions', 'test_gate_enabled', 'uncertainty_scoring_enabled']) {
    const field = toggles[flag]
    assert.ok(field, `TUI field for ${flag} must exist`)
    assert.deepEqual(field.path.slice(0, 2), ['presets', 1], `${flag} must target the active preset "fast" (index 1)`)
    assert.match(field.hint, /\(preset: fast\)/)
  }
  // Global fields stay top-level
  const enabledField = section.fields.find((f) => f.path[0] === 'enabled')
  assert.ok(enabledField)
  const smartField = section.fields.find((f) => f.path[0] === 'smart_routing_enabled')
  assert.ok(smartField)
})

test('Issue #365: TUI write flows into the pipeline - test gate runs for the resolved preset', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-issue-365-'))
  try {
    // Live config as the TUI would see it (validated through Config)
    const cfg = Config({})
    const activeName = cfg.default_preset || 'default'
    const section = buildTuiSection({ live: () => cfg })
    const gateField = section.fields.find((f) => f.path[f.path.length - 1] === 'test_gate_enabled')
    assert.ok(gateField, 'test_gate_enabled TUI field must exist')

    // Simulate the host TUI applying the field set operation at field.path
    const [root, idx, flag] = gateField.path
    assert.equal(root, 'presets')
    cfg.presets[idx][flag] = true
    // TUI also fills the test command on the same preset (preset-scoped key)
    cfg.presets[idx].test_command = 'node -e "process.exit(0)"'

    // Pipeline resolution: index.js resolves targetPreset from cfg.presets by name
    const targetPreset = cfg.presets.find((p) => p.name === activeName) || cfg.presets[0]
    assert.equal(targetPreset.test_gate_enabled, true, 'pipeline-visible preset must carry the TUI write')

    // The gate consumer (executeTestGateForCandidates) reads preset.test_gate_enabled
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'app.js', content: 'const ok = 1' },
    ], { runId: 'issue-365-run' })
    const results = await executeTestGateForCandidates({
      cwd: tmpDir,
      referenceOutputs: [{ ok: true, index: 1, label: 'mock:c1', files: [{ relativePath: 'app.js' }] }],
      preset: targetPreset,
      options: { runId: 'issue-365-run' },
    })
    assert.equal(results.length, 1, 'test gate must execute for the TUI-enabled preset')
    assert.equal(results[0]?.passed, true)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('Issue #365: POST /dsh-moa/presets applies preset-scoped keys to the target preset', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-issue-365-route-'))
  try {
    const registered = []
    const { registerPresetRoutes } = await import('../lib/routes/presets.js')
    const ctx = {
      webServer: { register: (entry) => { registered.push(entry); return () => {} } },
      effect: (fn) => fn(),
      logger: { warn: () => {}, info: () => {}, error: () => {} },
    }
    const cfg = Config({})
    registerPresetRoutes(ctx, {
      live: () => cfg,
      callLlm: async () => 'ok',
      saveConfig: async () => ({ persisted: true }),
      Config,
      plainConfig: (v) => v,
    })

    const presetsRoute = registered.find((r) => r.path === '/dsh-moa/presets')
    assert.ok(presetsRoute, 'presets route must be registered')

    const doPost = async (body) => {
      let code = 0, json = null
      const req = {
        method: 'POST',
        url: '/dsh-moa/presets',
        headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'sec-fetch-site': 'same-origin' },
        socket: { remoteAddress: '127.0.0.1' },
      }
      const chunks = []
      const res = {
        writeHead: (c) => { code = c },
        end: (data) => { try { json = JSON.parse(data) } catch { json = data } chunks.push(data) },
      }
      // minimal body stream emulation matching readBody(req)
      const payload = Buffer.from(JSON.stringify(body))
      req.on = (event, cb) => {
        if (event === 'data') setImmediate(() => cb(payload))
        if (event === 'end') setImmediate(cb)
        return req
      }
      await presetsRoute.handler(req, res)
      return { code, json }
    }

    // Preset-scoped top-level key is applied onto the default preset
    const applied = await doPost({ test_gate_enabled: true, test_command: 'node -e "process.exit(0)"' })
    assert.equal(applied.code, 200, `expected 200, got ${applied.code}: ${JSON.stringify(applied.json)}`)
    const defaultPreset = applied.json.presets.find((p) => p.name === 'default')
    assert.equal(defaultPreset.test_gate_enabled, true, 'applied preset flag must land inside the default preset')
    assert.equal(defaultPreset.test_command.includes('exit(0)'), true)

    // Unknown keys are rejected instead of being silently dropped
    const rejected = await doPost({ definitely_not_a_key: 1 })
    assert.equal(rejected.code, 400)
    assert.match(rejected.json.error, /definitely_not_a_key/)
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

test('Issue #365 migration: sanitizeToSchemaKeys strips legacy top-level flags', async () => {
  const { sanitizeToSchemaKeys, schemaFieldNames } = await import('../lib/moa-schema.js')
  const legacy = {
    enabled: false,
    default_preset: 'fast',
    // legacy 0.2.89 top-level preset flags that must not reach settings.replace
    interactive_workbench_enabled: true,
    test_gate_enabled: true,
    knowledge_path: '/old/path',
    prices: {},
    presets: [{ name: 'default' }],
  }
  const clean = sanitizeToSchemaKeys(legacy)
  assert.deepEqual(Object.keys(clean).sort(), ['default_preset', 'enabled', 'presets', 'prices'])
  assert.equal(clean.enabled, false)
  // schemaFieldNames covers both real schemastery and the stub
  const names = schemaFieldNames(Config)
  assert.ok(names.has('enabled') && names.has('presets'))
  assert.equal(names.has('test_gate_enabled'), false)
})

test('Issue #365 migration: saveConfig persists only schema-declared keys (host contract)', async () => {
  const { apply } = await import('../lib/index.js')
  const replaced = []
  const mockSettings = {
    replace: async (ns, payload) => { replaced.push({ ns, payload }) },
    configure: () => () => {},
  }
  const routes = {}
  const ctx = {
    webServer: { port: 3000, register: (route) => { routes[route.path] = route; return () => {} } },
    effect: (fn) => fn(),
    on: () => () => {},
    inject: (deps, cb) => {
      if (deps.includes('settings')) cb({ settings: mockSettings, effect: ctx.effect })
    },
  }
  // initial config as stored by 0.2.89: legacy top-level preset flags present
  const initialConfig = {
    enabled: true,
    default_preset: 'default',
    interactive_workbench_enabled: true,
    test_gate_enabled: true,
    presets: [{ name: 'default', test_gate_enabled: true }],
  }
  apply(ctx, initialConfig)

  const presetsRoute = routes['/dsh-moa/presets']
  assert.ok(presetsRoute, 'presets route exists')

  let code = 0
  const payload = Buffer.from(JSON.stringify({ enabled: true, default_preset: 'default' }))
  const req = {
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: 'localhost:3000' },
    on: (evt, handler) => {
      if (evt === 'data') handler(payload)
      if (evt === 'end') handler()
    },
  }
  const res = { writeHead: (c) => { code = c }, end: () => {} }
  await presetsRoute.handler(req, res)
  assert.equal(code, 200)
  assert.equal(replaced.length, 1)
  assert.equal(replaced[0].ns, 'dsh-moa')
  const value = replaced[0].payload
  assert.equal('interactive_workbench_enabled' in value, false, 'legacy key must not reach settings.replace')
  assert.equal('test_gate_enabled' in value, false, 'legacy key must not reach settings.replace')
  assert.equal(value.enabled, true)
  assert.ok(Array.isArray(value.presets))
})
