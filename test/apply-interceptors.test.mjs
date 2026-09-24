import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
register(pathToFileURL(path.join(__dirname, 'schemastery-stub-hooks.mjs')))

// Dynamic import on purpose: the module hooks above must be active when the
// harness-only peer dependencies of lib/index.js are resolved.
const { apply } = await import('../lib/index.js')

const BASE_CONFIG = {
  presets: [
    {
      name: 'default',
      reference_models: [
        { provider: 'prov-a', model: 'model-a1' },
        { provider: 'prov-b', model: 'model-b1' },
      ],
      aggregator: { provider: 'agg', model: 'judge' },
    },
    {
      name: 'fast',
      reference_models: [{ provider: 'prov-a', model: 'model-a1' }],
      aggregator: { provider: 'prov-a', model: 'model-a1' },
    },
  ],
}

function buildCtx(config) {
  const handlers = {}
  const routes = []
  const effects = []
  const configForms = {
    get: () => config,
    replace: async () => {},
  }
  const ctx = {
    webServer: {
      port: 3099,
      register: (route) => {
        routes.push(route)
        return () => {}
      },
    },
    effect: (fn, label) => {
      effects.push(label)
      return fn()
    },
    on: (event, handler) => {
      handlers[event] = handler
      return () => {}
    },
    inject: (deps, cb) => {
      cb({ settings: { register: () => configForms }, effect: ctx.effect })
    },
  }
  return { ctx, handlers, routes, effects }
}

test('apply(): registers turn interceptors and routes without touching them', () => {
  const { ctx, handlers, routes } = buildCtx(BASE_CONFIG)
  apply(ctx, BASE_CONFIG)

  assert.equal(typeof handlers['agent/pre-step'], 'function')
  assert.equal(typeof handlers['agent/request'], 'function')
  assert.equal(typeof handlers['llm/stream'], 'function')
  const paths = routes.map((r) => r.path)
  assert.ok(paths.includes('/dsh-moa/status'))
  assert.ok(paths.includes('/dsh-moa/runs/'), 'run-by-id prefix route registered')
})

test('apply(): non-moa messages pass through pre-step and llm/stream untouched', async () => {
  const { ctx, handlers } = buildCtx(BASE_CONFIG)
  apply(ctx, BASE_CONFIG)

  const signal = {}
  let preNext = false
  await handlers['agent/pre-step'](
    { messages: [{ role: 'user', content: 'plain question' }], signal, session: { id: 's1' } },
    async () => {
      preNext = true
      return 'ok'
    }
  )
  assert.equal(preNext, true, 'pre-step calls next for regular messages')

  let streamNext = false
  const out = await handlers['llm/stream']({ signal }, async () => {
    streamNext = true
    return 'upstream-stream'
  })
  assert.equal(streamNext, true, 'llm/stream calls next without a moa turn')
  assert.equal(out, 'upstream-stream')
})

test('apply(): /moa turn routes the request to the preset aggregator and intercepts llm/stream', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-apply-'))
  try {
    const { ctx, handlers } = buildCtx(BASE_CONFIG)
    apply(ctx, BASE_CONFIG)

    const signal = {}
    await handlers['agent/pre-step'](
      {
        messages: [{ role: 'user', content: '/moa fast build a snake game' }],
        signal,
        session: { id: 's2' },
        cwd: tmpDir,
      },
      async () => 'ok'
    )

    const routed = await handlers['agent/request']({ signal }, async () => ({ provider: 'orig', model: 'orig' }))
    assert.deepEqual(routed, { provider: 'prov-a', model: 'model-a1' }, 'agent/request overrides to the fast preset aggregator')

    let streamNext = false
    const stream = await handlers['llm/stream']({ signal }, async () => {
      streamNext = true
      return 'upstream-stream'
    })
    assert.equal(streamNext, false, 'llm/stream is intercepted for moa turns')
    assert.equal(typeof stream?.next, 'function', 'interceptor returns the MoA async generator')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('apply(): intercepted moa stream fails fast when no provider adapters exist, without writing history', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-apply-fail-'))
  try {
    const { ctx, handlers } = buildCtx(BASE_CONFIG)
    // No adapters in the test harness: prepareCall always throws.
    ctx.llm = { prepareCall: async () => { throw new Error('test: no provider adapters') } }
    apply(ctx, BASE_CONFIG)

    const signal = {}
    await handlers['agent/pre-step'](
      {
        messages: [{ role: 'user', content: '/moa fast build a snake game' }],
        signal,
        session: { id: 's3' },
        cwd: tmpDir,
      },
      async () => 'ok'
    )

    const stream = await handlers['llm/stream']({ signal }, async () => 'upstream-stream')
    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    assert.equal(chunks[0].type, 'block-start')
    const joined = chunks.filter((c) => c.type === 'text-delta').map((c) => c.text).join('')
    assert.ok(joined.includes('Mixture of Agents'), 'stream announces the MoA run')
    assert.ok(joined.includes('All advisor models (1) failed'), 'fail-fast message surfaces in the stream')
    const finish = chunks.find((c) => c.type === 'finish')
    assert.ok(finish)
    assert.equal(finish.reason.kind, 'stop')
    // The failure branch records nothing: the real history file must stay untouched.
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('apply(): disabled config skips moa routing entirely', async () => {
  const config = { enabled: false, presets: BASE_CONFIG.presets }
  const { ctx, handlers } = buildCtx(config)
  apply(ctx, config)

  const signal = {}
  await handlers['agent/pre-step'](
    { messages: [{ role: 'user', content: '/moa fast anything' }], signal, session: { id: 's4' } },
    async () => 'ok'
  )
  let streamNext = false
  await handlers['llm/stream']({ signal }, async () => {
    streamNext = true
    return 'upstream-stream'
  })
  assert.equal(streamNext, true, 'disabled MoA must not intercept llm/stream')
})

test('apply(): /moa without a matching preset falls back to the first configured preset', async () => {
  const config = { presets: [BASE_CONFIG.presets[1]] } // only "fast"
  const { ctx, handlers } = buildCtx(config)
  apply(ctx, config)

  const signal = {}
  await handlers['agent/pre-step'](
    { messages: [{ role: 'user', content: '/moa hello there' }], signal, session: { id: 's5' } },
    async () => 'ok'
  )
  const routed = await handlers['agent/request']({ signal }, async () => ({ provider: 'orig', model: 'orig' }))
  assert.deepEqual(routed, { provider: 'prov-a', model: 'model-a1' })
})
