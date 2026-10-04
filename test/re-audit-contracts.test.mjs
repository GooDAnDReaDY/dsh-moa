import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'

import { runMoAPipeline } from '../lib/moa-runner.js'
import { applyBudgetGuardrails } from '../lib/moa-budget.js'
import { executeMultiJudgePanel } from '../lib/moa-multi-judge.js'
import { buildSynthesisPrompt } from '../lib/moa-prompts.js'
import {
  writeCandidateWorkspace,
} from '../lib/file-workspace.js'
import {
  getMoaHistory,
  invalidateHistoryCache,
} from '../lib/history.js'
import { runReferencesParallel } from '../lib/moa-candidates.js'
import { apply } from '../lib/index.js'
import { registerMoaRoutes } from '../lib/routes.js'

const fence = String.fromCharCode(96).repeat(3)
const file = (name, content) => `${fence}js file="${name}"\n${content}\n${fence}`

test('#156: cancellation during checkpoint blocks file promotion write', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-156-'))
  try {
    const ac = new AbortController()
    const targetFile = path.join(tmpDir, 'late.js')

    const r = await runMoAPipeline({
      userPrompt: 'write late file',
      preset: {
        reference_models: [{ provider: 'mock', model: 'one' }],
        aggregator: { provider: 'mock', model: 'judge' },
        ask_clarifying_questions: false,
      },
      cwd: tmpDir,
      signal: ac.signal,
      checkpointFn: async () => {
        ac.abort()
        return { id: 'test-chk' }
      },
      callLlm: async ({ model }) => ({
        text: model === 'judge' ? file('late.js', 'should-not-exist') : file('late.js', 'prop'),
      }),
    })

    assert.equal(ac.signal.aborted, true)
    assert.equal(fsSync.existsSync(targetFile), false, 'late.js must not be written to disk after abort during checkpoint')
    assert.ok(r.error, 'pipeline result should report abort error')
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#158: budget guardrails factor downstream judge into candidate trim', async () => {
  const res = applyBudgetGuardrails({
    enabled: true,
    maxBudgetUsd: 0.01,
    references: [
      { provider: 'mock', model: 'cheap' },
      { provider: 'mock', model: 'expensive' },
    ],
    aggregator: { provider: 'mock', model: 'judge' },
    prices: {
      'mock:cheap': { input: 1, output: 1 },
      'mock:expensive': { input: 100, output: 100 },
      'mock:judge': { input: 100, output: 100 },
    },
    action: 'trim',
    promptLength: 1000,
    maxTokens: 1000,
  })

  // Since cheap + judge exceeds $0.01 budget, trim correctly detects no candidate can fit with downstream
  assert.equal(res.allowed, false)
  assert.equal(res.action, 'trim')
  assert.equal(res.references.length, 0)
  assert.ok(res.estimatedCostUsd > 0.01)
})

test('#159: symlink containment in .moa root boundary', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-159-'))
  const outsideDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-159-outside-'))
  try {
    const moaLink = path.join(tmpDir, '.moa')
    // Attempt malicious attack: symlink cwd/.moa -> outside
    try {
      fsSync.symlinkSync(outsideDir, moaLink, 'dir')
    } catch {
      try {
        fsSync.symlinkSync(outsideDir, moaLink, 'junction')
      } catch {}
    }

    if (fsSync.existsSync(moaLink)) {
      const written = await writeCandidateWorkspace(tmpDir, 1, [{ relativePath: 'marker.txt', content: 'test' }], { runId: 'test-run' })
      assert.ok(written.length > 0)
      // Verify nothing escaped into outsideDir
      assert.equal(fsSync.existsSync(path.join(outsideDir, 'test-run', 'candidate-1', 'marker.txt')), false)
    }
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
    fsSync.rmSync(outsideDir, { recursive: true, force: true })
  }
})

test('#160: run isolation generates unique runId and prevents folder collision', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-160-'))
  try {
    const preset = {
      reference_models: [{ provider: 'mock', model: 'one' }],
      aggregator: { provider: 'mock', model: 'judge' },
      ask_clarifying_questions: false,
      allow_candidate_override: true,
    }
    const r1 = await runMoAPipeline({
      userPrompt: 'run 1',
      cwd: tmpDir,
      preset,
      checkpointFn: async () => ({ id: 'c1' }),
      callLlm: async () => ({ text: file('app.js', 'run-1') }),
    })

    const r2 = await runMoAPipeline({
      userPrompt: 'run 2',
      cwd: tmpDir,
      preset,
      checkpointFn: async () => ({ id: 'c2' }),
      callLlm: async () => ({ text: file('app.js', 'run-2') }),
    })

    assert.ok(r1.runId)
    assert.ok(r2.runId)
    assert.notEqual(r1.runId, r2.runId)

    const run1Dir = path.join(tmpDir, '.moa', r1.runId, 'candidate-1')
    const run2Dir = path.join(tmpDir, '.moa', r2.runId, 'candidate-1')
    assert.equal(fsSync.existsSync(run1Dir), true)
    assert.equal(fsSync.existsSync(run2Dir), true)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#167: blind evaluation does not leak model labels in consensusReport or prompt', async () => {
  const panel = await executeMultiJudgePanel({
    judges: [{ provider: 'mock', model: 'judge-1' }],
    candidates: [
      { ok: true, index: 1, label: 'mock:model-one', text: 'code 1' },
      { ok: true, index: 2, label: 'mock:model-two', text: 'code 2' },
    ],
    userPrompt: 'test prompt',
    callLlm: async () => ({ text: 'BEST_CANDIDATE: 1\nCONSENSUS_REASONING: Better code' }),
    blind: true,
  })

  assert.ok(panel.consensusReport)
  assert.equal(panel.consensusReport.includes('mock:model-one'), false, 'consensusReport must not contain model label')

  const prompt = buildSynthesisPrompt('test prompt', [
    { index: 1, label: 'mock:model-one', text: 'code 1' },
    { index: 2, label: 'mock:model-two', text: 'code 2' },
  ], '', {
    blindEvaluation: true,
    consensusReport: panel.consensusReport,
  })

  assert.equal(prompt.includes('mock:model-one'), false, 'synthesis prompt must not leak model labels when blind')
  assert.equal(prompt.includes('mock:model-two'), false, 'synthesis prompt must not leak model labels when blind')
})

test('#171: live config sync allows native fiber changes after REST save', async () => {
  let enabled = true
  const cfg = {
    enabled: { get: () => enabled },
    presets: [],
  }

  const routes = new Map()
  const ctx = {
    effect: (fn) => fn(),
    inject: (deps, cb) => cb({ settings: null, effect: (fn) => fn() }),
    webServer: { register: (r) => { routes.set(r.path, r.handler); return () => {} } },
    on: () => () => {},
    logger: { warn: () => {} },
  }

  apply(ctx, cfg)

  const invoke = async (fn, payload, method = 'POST') => {
    let status, body
    const req = {
      method,
      url: '/dsh-moa/presets',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { origin: 'http://app.test', host: 'app.test', 'sec-fetch-site': 'same-origin' },
      on(e, cb) {
        if (e === 'data') queueMicrotask(() => cb(JSON.stringify(payload)))
        if (e === 'end') queueMicrotask(cb)
        return this
      },
    }
    await fn(req, { writeHead: (s) => { status = s }, end: (v) => { body = JSON.parse(v) } })
    return { status, body }
  }

  // REST save
  await invoke(routes.get('/dsh-moa/presets'), { enabled: true, presets: [] })

  // Native config change from fiber/ConfigForms
  enabled = false

  const statusRes = await invoke(routes.get('/dsh-moa/status'), null, 'GET')
  assert.equal(statusRes.body.enabled, false, 'status endpoint must reflect live native enabled=false after REST save')
})

test('#176: routing model binding resolves preset smart_routing_model', async () => {
  let routingCalls = []
  let routerHandlers = {}
  const routerCtx = {
    effect: (fn) => fn(),
    inject: () => {},
    webServer: { register: () => () => {} },
    on: (e, f) => { routerHandlers[e] = f; return () => {} },
    logger: { warn: () => {} },
    llm: {
      prepareCall: async (config) => {
        routingCalls.push(config)
        return {
          config,
          stream: async function* () {
            yield { type: 'text-delta', text: 'target' }
          },
        }
      },
    },
  }

  const configured = { provider: 'mock', model: 'ui-router' }
  const preset = {
    name: 'audit',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'one' }],
    aggregator: { provider: 'mock', model: 'judge' },
    smart_routing_enabled: true,
    smart_routing_model: configured,
  }

  apply(routerCtx, {
    enabled: true,
    default_preset: 'audit',
    smart_routing_model: { provider: '', model: '' },
    presets: [preset, { ...preset, name: 'target' }],
  })

  await routerHandlers['agent/pre-step']({
    messages: [{ role: 'user', content: '/moa solve the task' }],
    signal: new AbortController().signal,
    cwd: process.cwd(),
  }, async () => {})

  assert.equal(routingCalls.length, 1, 'classifier LLM must be called for smart routing')
  assert.equal(routingCalls[0]?.model, 'ui-router', 'classifier must use preset smart_routing_model')
})

test('#177 & #179: historical run promote and diff resolve history UUID runId', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-hist-'))
  const histFile = path.join(tmpDir, 'history.jsonl')
  process.env.DSH_HISTORY_FILE = histFile
  try {
    const preset = {
      name: 'audit',
      ask_clarifying_questions: false,
      reference_models: [{ provider: 'mock', model: 'one' }, { provider: 'mock', model: 'two' }],
      aggregator: { provider: 'mock', model: 'judge' },
      allow_candidate_override: true,
    }

    const run = await runMoAPipeline({
      cwd: tmpDir,
      preset,
      userPrompt: 'test pipeline',
      historyFilePath: histFile,
      checkpointFn: async () => ({ id: 'fix-1' }),
      callLlm: async ({ model }) => ({
        text: model === 'judge' ? 'WINNER: 1' : file('app.js', `cand-${model}`),
      }),
    })

    const hist = getMoaHistory(1, 0, histFile).runs[0]
    assert.ok(hist)
    assert.equal(run.runId, hist.id)

    // Test #179: Diff endpoint for historical runId
    const routes = new Map()
    registerMoaRoutes(
      { effect: (fn) => fn(), webServer: { register: (r) => { routes.set(r.path, r.handler); return () => {} } } },
      { live: () => ({}), callLlm: () => {}, saveConfig: () => {}, Config: (x) => x }
    )

    let diffStatus, diffBody
    await routes.get('/dsh-moa/diff')(
      { method: 'GET', url: `/dsh-moa/diff?runId=${hist.id}&from=1&to=2`, socket: { remoteAddress: '127.0.0.1' }, headers: { origin: 'http://app.test', host: 'app.test', 'sec-fetch-site': 'same-origin' } },
      { writeHead: (s) => { diffStatus = s }, end: (v) => { diffBody = JSON.parse(v) } }
    )
    assert.equal(diffStatus, 200)
    assert.ok(diffBody.files.includes('app.js'), 'diff must find app.js in historical run folder')

    // Test #177: Promote endpoint for historical runId
    let handlers = {}
    let llmCalls = 0
    const ctx = {
      effect: (fn) => fn(),
      inject: () => {},
      webServer: { register: () => () => {} },
      reflect: { get: () => ({ createSnapshot: async () => ({ id: 'fixture' }) }) },
      logger: { warn: () => {} },
      on: (e, f) => { handlers[e] = f; return () => {} },
      llm: { prepareCall: async () => { llmCalls++; return { stream: async function* () {} } } },
    }
    apply(ctx, { enabled: true, default_preset: 'audit', presets: [preset] })

    const signal = new AbortController().signal
    await handlers['agent/pre-step']({
      messages: [{ role: 'user', content: `/moa promote ${hist.id} 2` }],
      signal,
      cwd: tmpDir,
    }, async () => {})

    let chunks = []
    for await (const c of handlers['llm/stream']({ signal }, () => { llmCalls++; return (async function* () {})() })) {
      chunks.push(c)
    }

    assert.equal(llmCalls, 0, 'promote turn must not call LLM')
    const diskContent = fsSync.readFileSync(path.join(tmpDir, 'app.js'), 'utf8')
    assert.equal(diskContent.trim(), 'cand-two', 'promoted file from candidate 2 must match historical workspace')
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#183: history line count caching validates filePath, mtime, and size', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-183-'))
  try {
    const smallFile = path.join(tmpDir, 'small.jsonl')
    const largeFile = path.join(tmpDir, 'large.jsonl')

    await fs.writeFile(smallFile, JSON.stringify({ id: 'one' }) + '\n')
    await fs.writeFile(largeFile, Array.from({ length: 50 }, (_, i) => JSON.stringify({ id: String(i) }) + '\n').join(''))

    invalidateHistoryCache()
    const smallResult = getMoaHistory(20, 0, smallFile)
    assert.equal(smallResult.total, 1)

    // Now query largeFile: must not return cached smallFile count of 1!
    const largeResult = getMoaHistory(20, 0, largeFile)
    assert.equal(largeResult.total, 50, 'large file must count 50, not stale cache from small file')
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#198: candidate deadline timer is cleared and unrefed', async () => {
  let signal
  await runReferencesParallel(
    [{ provider: 'mock', model: 'one' }],
    [],
    { timeoutMs: 30 },
    async (o) => {
      signal = o.signal
      return { text: 'ok' }
    }
  )

  const abortedAtReturn = signal.aborted
  assert.equal(abortedAtReturn, false)
  await sleep(40)
  assert.equal(signal.aborted, false, 'timer must be cleared so signal is not aborted after candidate completes')
})
