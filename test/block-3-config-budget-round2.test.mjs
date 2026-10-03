import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { register } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
register(pathToFileURL(path.join(__dirname, 'schemastery-stub-hooks.mjs')))

const { apply, NS, plainConfig } = await import('../lib/index.js')
const { applyBudgetGuardrails } = await import('../lib/moa-budget.js')
const { runMoAPipeline } = await import('../lib/moa-runner.js')
const { parseMoACommand } = await import('../lib/moa-parser.js')
const { registerMoaRoutes } = await import('../lib/routes.js')

function createMockWebServer() {
  const routes = new Map()
  return {
    routes,
    webServer: {
      port: 3080,
      register: (r) => {
        routes.set(r.path, r.handler)
        return () => routes.delete(r.path)
      },
    },
  }
}

async function invokeRoute(handler, payload = null, method = 'GET', url = '/dsh-moa/status') {
  let status = 200
  let body = null
  const req = {
    method,
    url,
    headers: {
      host: 'localhost:3080',
      'sec-fetch-site': 'same-origin',
      origin: 'http://localhost:3080',
    },
    on(evt, cb) {
      if (evt === 'data' && payload !== null) {
        queueMicrotask(() => cb(Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload))))
      }
      if (evt === 'end') {
        queueMicrotask(cb)
      }
      return this
    },
  }
  const res = {
    writeHead(code) {
      status = code
    },
    end(data) {
      if (data) {
        try {
          body = JSON.parse(data.toString())
        } catch {
          body = data.toString()
        }
      }
    },
  }
  await handler(req, res)
  return { status, body }
}

test('Issue #171: live config dynamically unrolls volatile getters from native ConfigForms without restart', async () => {
  let volatileEnabled = true
  const cfg = {
    enabled: { get: () => volatileEnabled },
    default_preset: 'audit',
    presets: [{ name: 'audit', reference_models: [], aggregator: { provider: 'mock', model: 'agg' } }],
  }

  const { routes, webServer } = createMockWebServer()
  const effects = []
  const handlers = {}
  const ctx = {
    webServer,
    effect: (fn, label) => {
      effects.push(label)
      return fn()
    },
    on: (evt, h) => {
      handlers[evt] = h
      return () => {}
    },
    inject: () => {},
  }

  apply(ctx, cfg)

  // 1. Initial state reflects true
  const initialRes = await invokeRoute(routes.get('/dsh-moa/status'), null, 'GET')
  assert.equal(initialRes.status, 200)
  assert.equal(initialRes.body.enabled, true)

  // 2. Native ConfigForms changes enabled to false in-place via volatile getter
  volatileEnabled = false

  // 3. Status route immediately reports enabled: false without restarting plugin
  const afterRes = await invokeRoute(routes.get('/dsh-moa/status'), null, 'GET')
  assert.equal(afterRes.status, 200)
  assert.equal(afterRes.body.enabled, false)

  // 4. agent/pre-step also respects the dynamically updated enabled: false
  let nextCalled = false
  await handlers['agent/pre-step']({ messages: [{ role: 'user', content: '/moa test' }] }, () => {
    nextCalled = true
  })
  assert.equal(nextCalled, true, 'pre-step passes through when dynamically disabled')
})

test('Issue #172: settings persistence failure returns HTTP 500 and prevents live config mutation', async () => {
  const { routes, webServer } = createMockWebServer()
  const effects = []
  let settingsWriteAttempts = 0

  const mockSettings = {
    configure: () => () => {},
    replace: async () => {
      settingsWriteAttempts++
      throw new Error('DISK_WRITE_FAILED: read-only profile storage')
    },
  }

  const ctx = {
    webServer,
    effect: (fn) => fn(),
    on: () => () => {},
    inject: (deps, cb) => {
      if (deps.includes('settings')) {
        cb({ settings: mockSettings, effect: ctx.effect })
      }
    },
  }

  const initialConfig = {
    enabled: true,
    default_preset: 'old-preset',
    presets: [{ name: 'old-preset', reference_models: [], aggregator: { provider: 'p', model: 'm' } }],
  }

  apply(ctx, initialConfig)

  // Verify initial status
  const st1 = await invokeRoute(routes.get('/dsh-moa/status'), null, 'GET')
  assert.equal(st1.body.defaultPreset, 'old-preset')

  // Attempt to save new presets
  const updatePayload = {
    enabled: false,
    default_preset: 'new-preset',
    presets: [{ name: 'new-preset', reference_models: [], aggregator: { provider: 'p2', model: 'm2' } }],
  }

  const saveRes = await invokeRoute(routes.get('/dsh-moa/presets'), updatePayload, 'POST')
  assert.equal(saveRes.status, 500, 'persistence error must return HTTP 500')
  assert.equal(saveRes.body.ok, false)
  assert.match(saveRes.body.error, /DISK_WRITE_FAILED/)
  assert.equal(settingsWriteAttempts, 1)

  // Verify live configuration was NOT mutated after persistence failed
  const st2 = await invokeRoute(routes.get('/dsh-moa/status'), null, 'GET')
  assert.equal(st2.body.defaultPreset, 'old-preset')
  assert.equal(st2.body.enabled, true)
})

test('Issue #178: /moa command resolves default_preset and respects explicit flags/positionals', async () => {
  const presets = [
    { name: 'default', aggregator: { provider: 'p1', model: 'default-model' } },
    { name: 'fast', aggregator: { provider: 'p2', model: 'fast-model' } },
    { name: 'deep-reasoning', aggregator: { provider: 'p3', model: 'deep-model' } },
  ]

  // 1. Parser contract: bare prompt returns undefined / defaultPreset
  const bareParsed = parseMoACommand('/moa explain sorting', presets)
  assert.equal(bareParsed.presetName, undefined)
  assert.equal(bareParsed.isExplicit, false)
  assert.equal(bareParsed.prompt, 'explain sorting')

  const defaultPassed = parseMoACommand('/moa explain sorting', presets, 'fast')
  assert.equal(defaultPassed.presetName, 'fast')
  assert.equal(defaultPassed.isExplicit, false)

  // 2. Explicit flag --preset
  const flagParsed = parseMoACommand('/moa --preset=deep-reasoning solve math', presets)
  assert.equal(flagParsed.presetName, 'deep-reasoning')
  assert.equal(flagParsed.isExplicit, true)
  assert.equal(flagParsed.prompt, 'solve math')

  // 3. Explicit short flag -p
  const shortParsed = parseMoACommand('/moa -p deep-reasoning solve math', presets)
  assert.equal(shortParsed.presetName, 'deep-reasoning')
  assert.equal(shortParsed.isExplicit, true)
  assert.equal(shortParsed.prompt, 'solve math')

  // 4. Positional preset matching preset list
  const posParsed = parseMoACommand('/moa fast generate quick snippet', presets)
  assert.equal(posParsed.presetName, 'fast')
  assert.equal(posParsed.isExplicit, true)
  assert.equal(posParsed.prompt, 'generate quick snippet')

  // 5. Interceptor in apply() resolves configured default_preset
  const { webServer } = createMockWebServer()
  const handlers = {}
  const ctx = {
    webServer,
    effect: (fn) => fn(),
    on: (evt, h) => {
      handlers[evt] = h
      return () => {}
    },
    inject: () => {},
  }

  apply(ctx, {
    enabled: true,
    default_preset: 'fast',
    presets,
  })

  // Pre-step intercepts and selects fast
  const signal = new AbortController().signal
  await handlers['agent/pre-step']({
    messages: [{ role: 'user', content: '/moa explain quicksort' }],
    signal,
    cwd: process.cwd(),
  }, () => {})

  const reqResult = await handlers['agent/request']({ signal }, async () => ({ provider: 'orig', model: 'orig' }))
  assert.equal(reqResult.provider, 'p2')
  assert.equal(reqResult.model, 'fast-model')
})

test('Issue #181: POST /dsh-moa/run propagates checkpoint engine and creates pre-promotion checkpoint', async () => {
  const { routes, webServer } = createMockWebServer()
  let checkpointsCreated = 0

  const mockTimeMachineEngine = {
    createSnapshot: async (label, options) => {
      checkpointsCreated++
      return { id: 'snap-123', label, cwd: options?.cwd }
    },
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-checkpoint-run-'))
  try {
    const fence = '```'
    const generatedContent = `${fence}js file="app.js"\nconsole.log("hello world")\n${fence}`

    const liveCfg = {
      enabled: true,
      default_preset: 'audit',
      presets: [
        {
          name: 'audit',
          reference_models: [{ provider: 'mock', model: 'one' }],
          aggregator: { provider: 'mock', model: 'judge' },
          ask_clarifying_questions: false,
        },
      ],
    }

    registerMoaRoutes(
      {
        webServer,
        effect: (fn) => fn(),
        get: (dep) => (dep === 'timeMachineEngine' ? mockTimeMachineEngine : null),
        logger: { warn: () => {} },
      },
      {
        live: () => liveCfg,
        callLlm: async () => ({ text: generatedContent }),
        saveConfig: () => {},
        Config: (x) => x,
        plainConfig: (x) => x,
        timeMachineEngine: mockTimeMachineEngine,
      }
    )

    const runRes = await invokeRoute(routes.get('/dsh-moa/run'), {
      prompt: 'create app.js',
      cwd: tmpDir,
    }, 'POST', '/dsh-moa/run')

    assert.equal(runRes.status, 200)
    assert.equal(runRes.body.ok, true)
    assert.equal(checkpointsCreated, 1, 'checkpoint must be created before promoting file')

    // Verify file actually promoted
    const written = await fs.readFile(path.join(tmpDir, 'app.js'), 'utf8')
    assert.equal(written.trim(), 'console.log("hello world")')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('Issue #158: Budget Guard strictly caps expensive single candidate and trims pool', () => {
  // Case 1: Single candidate costs $0.2298, max budget is $0.01
  const trimSingle = applyBudgetGuardrails({
    enabled: true,
    maxBudgetUsd: 0.01,
    references: [{ provider: 'mock', model: 'expensive' }],
    prices: { '*': { input: 100, output: 100, cacheHit: 100 } },
    action: 'trim',
    promptLength: 1000,
  })

  assert.equal(trimSingle.allowed, false, 'must reject when not even one candidate fits budget')
  assert.equal(trimSingle.trimmedCount, 0)
  assert.match(trimSingle.reason, /Cannot fit any candidate model within budget/)

  // Case 2: Pool of [expensive ($0.2298), cheap1 ($0.002), cheap2 ($0.002)], budget $0.05
  const trimPool = applyBudgetGuardrails({
    enabled: true,
    maxBudgetUsd: 0.05,
    references: [
      { provider: 'mock', model: 'expensive' },
      { provider: 'mock', model: 'cheap1' },
      { provider: 'mock', model: 'cheap2' },
    ],
    prices: {
      'mock:expensive': { input: 100, output: 100 },
      'mock:cheap1': { input: 1, output: 1 },
      'mock:cheap2': { input: 1, output: 1 },
    },
    action: 'trim',
    promptLength: 1000,
  })

  assert.equal(trimPool.allowed, true)
  assert.equal(trimPool.references.length, 2)
  assert.deepEqual(trimPool.references.map((r) => r.model), ['cheap1', 'cheap2'])
  assert.ok(trimPool.estimatedCostUsd <= 0.05, 'retained cost must be <= max budget')
})

test('Issue #164: Round 2 preserves trimmed candidate slot identities and never invokes excluded expensive model', async () => {
  const roundCalls = []
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-r2-test-'))
  const historyPath = path.join(tmpDir, 'history.jsonl')

  const preset = {
    name: 'test-r2',
    reference_models: [
      { provider: 'mock', model: 'expensive' },
      { provider: 'mock', model: 'cheap1' },
      { provider: 'mock', model: 'cheap2' },
    ],
    aggregator: { provider: 'mock', model: 'judge' },
    peer_critique_enabled: true,
    budget_guard_enabled: true,
    max_budget_usd: 0.05,
    budget_action: 'trim',
    ask_clarifying_questions: false,
  }

  const prices = {
    'mock:expensive': { input: 100, output: 100 },
    'mock:cheap1': { input: 1, output: 1 },
    'mock:cheap2': { input: 1, output: 1 },
    'mock:judge': { input: 1, output: 1 },
  }

  try {
    const result = await runMoAPipeline({
      userPrompt: 'refactor code',
      preset,
      prices,
      cwd: tmpDir,
      historyFilePath: historyPath,
      force: true,
      callLlm: async ({ model }) => {
        roundCalls.push(model)
        if (model === 'judge') return { text: 'WINNER_CANDIDATE_INDEX: 1' }
        return { text: 'proposal from ' + model }
      },
    })

    // Retained references must only be cheap1 and cheap2
    assert.equal(result.references.length, 2)
    assert.deepEqual(result.references.map((r) => r.slot.model), ['cheap1', 'cheap2'])

    // In Round 1, cheap1 and cheap2 are called
    // In Round 2 (peer critique), cheap1 and cheap2 are called again
    // In final stage, judge is called
    // 'expensive' must NEVER appear in roundCalls!
    assert.equal(roundCalls.includes('expensive'), false, 'expensive model must never be called after budget trim')
    const r2Calls = roundCalls.slice(2, 4)
    assert.deepEqual(r2Calls.sort(), ['cheap1', 'cheap2'])
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
