import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import EventEmitter from 'node:events'
import { registerMoaRoutes } from '../lib/routes.js'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { runCandidateTestGate } from '../lib/moa-test-gate.js'
import { writeCandidateWorkspace } from '../lib/file-workspace.js'
import { recordMoaRunAsync, invalidateHistoryCache } from '../lib/history.js'
import { createLlmCaller } from '../lib/moa-llm.js'
import { createBudgetAbortPayload, calcSynthesisPromptTokens } from '../lib/moa-budget.js'

function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = '' } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin', ...headers }
  req.socket = { remoteAddress: '127.0.0.1' }

  let statusCode = 200
  let resHeaders = {}
  let resBody = ''

  const res = new EventEmitter()
  res.writeHead = (code, h) => {
    statusCode = code
    if (h) Object.assign(resHeaders, h)
  }
  res.end = (chunk) => {
    if (chunk) resBody += chunk
    res.emit('finish')
  }

  const send = () => {
    process.nextTick(() => {
      if (body) req.emit('data', Buffer.from(body))
      req.emit('end')
    })
  }

  return {
    req,
    res,
    send,
    getResult: () => new Promise((resolve) => {
      res.on('finish', () => {
        let json = null
        try { json = JSON.parse(resBody) } catch {}
        resolve({ statusCode, headers: resHeaders, body: resBody, json })
      })
    }),
  }
}

test('#230: POST /dsh-moa/promote without runId resolves latest recorded run and applies its candidate workspace', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-230-audit-'))
  const histFile = path.join(tmp, 'history.jsonl')
  const catFile = path.join(tmp, 'catalog.json')
  process.env.DSH_HISTORY_FILE = histFile
  process.env.DSH_CATALOG_FILE = catFile
  await fs.writeFile(catFile, JSON.stringify({ models: {}, updatedAt: Date.now() }))
  await fs.writeFile(histFile, '')
  invalidateHistoryCache()

  const cwd = path.join(tmp, 'workspace')
  await fs.mkdir(cwd, { recursive: true })

  // Record run
  const r = await recordMoaRunAsync({ id: 'run-latest-47', cwd, prompt: 'synthetic test', candidates: [] }, histFile)
  await writeCandidateWorkspace(cwd, 1, [{ relativePath: 'result.txt', content: 'CANDIDATE_RUN_LATEST_47' }], { runId: r.id })

  // Also write a stale unversioned legacy candidate
  await writeCandidateWorkspace(cwd, 1, [{ relativePath: 'result.txt', content: 'STALE_LEGACY_SHOULD_NOT_BE_USED' }])

  const registeredRoutes = new Map()
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      port: 3000,
      register: (route) => {
        registeredRoutes.set(route.path, route.handler)
        return () => {}
      },
    },
    logger: { warn: () => {} },
  }

  registerMoaRoutes(mockCtx, {
    live: () => ({ enabled: true, presets: [] }),
    Config: (x) => x,
    timeMachineEngine: { createSnapshot: async () => ({ id: 'snap-230' }) },
  })

  const handler = registeredRoutes.get('/dsh-moa/promote')
  assert.ok(handler, 'Route /dsh-moa/promote must be registered')

  // Invoke promote without runId
  const { req, res, send, getResult } = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/promote',
    body: JSON.stringify({ cwd, candidateIndex: 1 }),
  })
  send()
  handler(req, res)
  const result = await getResult()

  assert.equal(result.statusCode, 200)
  assert.equal(result.json?.ok, true)
  assert.deepEqual(result.json?.promotedFiles, ['result.txt'])

  // Verify that the file promoted to cwd matches the latest run, NOT the stale legacy folder
  const promotedContent = await fs.readFile(path.join(cwd, 'result.txt'), 'utf8')
  assert.equal(promotedContent, 'CANDIDATE_RUN_LATEST_47')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#225: Test Gate path scanner allows safe HTTP route literals without path leak false positives', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-225-audit-'))
  const candidateDir = path.join(tmp, '.moa', 'candidate-1')
  await fs.mkdir(candidateDir, { recursive: true })

  const scriptCode = `
const routes = {
  "/users/me": () => ({ status: 200, user: "test" }),
  "/run/job": () => ({ status: 201, jobId: "123" }),
};
if (routes["/run/job"]().status !== 201 || routes["/users/me"]().status !== 200) {
  throw new Error("Route mapping failure");
}
console.log("SAFE_ROUTES_PASSED");
`
  await fs.writeFile(path.join(candidateDir, 'routes-test.cjs'), scriptCode)

  const res = await runCandidateTestGate({
    cwd: tmp,
    candidateIndex: 1,
    testCommand: 'node routes-test.cjs',
  })

  assert.ok(res, 'Gate result should exist')
  assert.equal(res.passed, true, `Safe route literals should not be denied: ${res.output}`)
  assert.equal(res.exitCode, 0)
  assert.match(res.output, /SAFE_ROUTES_PASSED/)

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#161: Test Gate detects and blocks computed shell payloads from accessing outside sandbox', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-161-audit-'))
  const outsideSecret = path.join(tmp, 'secret-outside.txt')
  await fs.writeFile(outsideSecret, 'SUPER_SECRET_TOKEN_47')

  const cwd = path.join(tmp, 'sandbox')
  await fs.mkdir(cwd, { recursive: true })
  const shell = 'cat ' + JSON.stringify(outsideSecret)
  const encoded = Buffer.from(shell).toString('base64')

  await writeCandidateWorkspace(cwd, 1, [
    {
      relativePath: 'evasion.cjs',
      content: `console.log(require("node:child_process").spawnSync("sh", ["-c", 'eval "$(printf %s ${encoded} | base64 -d)"'], { encoding: "utf8" }).stdout);`,
    },
  ])

  const res = await runCandidateTestGate({
    cwd,
    candidateIndex: 1,
    testCommand: 'node evasion.cjs',
  })

  assert.ok(res, 'Gate result should exist')
  assert.equal(res.passed, false, 'Computed evasion attempt must be denied')
  assert.equal(res.exitCode, 1)
  assert.doesNotMatch(res.output, /SUPER_SECRET_TOKEN_47/)

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#161: Test Gate blocks native shell scripts from writing outside workspace sandbox', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-161-write-'))
  const outsideTarget = path.join(tmp, 'unauthorized-target.txt')
  const encodedTarget = Buffer.from(outsideTarget).toString('base64')

  const cwd = path.join(tmp, 'sandbox')
  await fs.mkdir(cwd, { recursive: true })

  await writeCandidateWorkspace(cwd, 1, [
    {
      relativePath: 'write-probe.sh',
      content: `p="$(printf %s ${encodedTarget} | base64 -d)"\nprintf PWNED > "$p"\n`,
    },
  ])

  const res = await runCandidateTestGate({
    cwd,
    candidateIndex: 1,
    testCommand: 'sh write-probe.sh',
  })

  assert.ok(res, 'Gate result should exist')
  assert.equal(res.passed, false, 'Shell script with computed base64 evasion must fail gate')
  const fileWritten = await fs.readFile(outsideTarget, 'utf8').catch(() => null)
  assert.equal(fileWritten, null, 'Outside target file must not be written')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#158: Budget Guard accounts for full judge_criteria context and enforces budget limit', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-158-criteria-'))
  const preset = {
    name: 'audit47-budget',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'c1' }, { provider: 'mock', model: 'c2' }],
    aggregator: { provider: 'mock', model: 'expensive-judge' },
    max_tokens: 64,
    budget_guard_enabled: true,
    max_budget_usd: 0.002,
    budget_action: 'abort',
    judge_criteria: 'Detailed rubric item testing context overhead. '.repeat(500),
  }

  const res = await runMoAPipeline({
    cwd: tmp,
    userPrompt: 'analyse the code architecture',
    preset,
    prices: { '*': { input: 1, output: 1 } },
    callLlm: async ({ model, messages, maxTokens }) => {
      const inputTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4)
      const text = model === 'expensive-judge' ? 'WINNER: 1' : 'solution proposal'
      const outputTokens = Math.ceil(text.length / 4)
      return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } }
    },
  })

  assert.ok(res, 'Pipeline result should exist')
  assert.ok((res.usage?.totalCostUsd || 0) <= preset.max_budget_usd, `Cost ($${res.usage?.totalCostUsd}) must not exceed limit ($${preset.max_budget_usd})`)

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#158 & #168: Multi-judge panel accounts for tokens and budget, retaining panel tokens in abort payload', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-168-panel-'))
  const preset = {
    name: 'audit47-panel',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'c1' }, { provider: 'mock', model: 'c2' }],
    aggregator: { provider: 'mock', model: 'judge' },
    multi_judge_enabled: true,
    judge_models: [{ provider: 'mock', model: 'panel-judge' }],
    max_tokens: 64,
    budget_guard_enabled: true,
    max_budget_usd: 0.002,
    budget_action: 'abort',
  }

  const calls = []
  const res = await runMoAPipeline({
    cwd: tmp,
    userPrompt: 'refactor code safely',
    preset,
    prices: { '*': { input: 1, output: 1 } },
    callLlm: async ({ model, messages, maxTokens }) => {
      const inputTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4)
      const text = model === 'panel-judge' ? 'BEST_CANDIDATE: 1\n' + ('A'.repeat(7000)) : 'candidate text'
      const outputTokens = Math.ceil(text.length / 4)
      calls.push({ model, inputTokens, outputTokens, maxTokens })
      return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } }
    },
  })

  assert.ok(res, 'Pipeline result must exist')
  const actualTokenSum = calls.reduce((acc, c) => acc + c.inputTokens + c.outputTokens, 0)

  // When pipeline aborts after panel, reported tokens must equal actual tokens (#168)
  if (res.kind === 'failure') {
    assert.equal(res.usage?.totalTokens, actualTokenSum, `Abort payload must retain all phase tokens: reported ${res.usage?.totalTokens} vs actual ${actualTokenSum}`)
  }

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#158: createLlmCaller default maxTokens is capped at 2048', async () => {
  const capturedConfigs = []
  const caller = createLlmCaller({
    llm: {
      prepareCall: async (config) => {
        capturedConfigs.push(config)
        return {
          config,
          stream: async function* () {
            yield { type: 'text-delta', text: 'OK' }
            yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
          },
        }
      },
    },
  })

  await caller({ provider: 'mock', model: 'panel', messages: [] })
  assert.equal(capturedConfigs.length, 1)
  assert.ok(capturedConfigs[0].maxTokens <= 2048, `Default maxTokens (${capturedConfigs[0].maxTokens}) must be <= 2048`)
})

test('#168: createBudgetAbortPayload accepts and aggregates multiJudgeResult tokens and usage', () => {
  const payload = createBudgetAbortPayload({
    reason: 'Exceeded budget before synthesis',
    primaryJudge: { provider: 'mock', model: 'judge' },
    referenceOutputs: [
      { label: 'c1', usage: { totalTokens: 100 }, costUsd: 0.0001 },
      { label: 'c2', usage: { totalTokens: 174 }, costUsd: 0.0001 },
    ],
    currentSpentUsd: 0.00222,
    preset: { name: 'test' },
    multiJudgeResult: {
      totalUsage: { inputTokens: 182, outputTokens: 1755, totalTokens: 1937, costUsd: 0.002 },
      judgesResults: [{ judge: 'panel', score: 10 }],
    },
  })

  assert.equal(payload.kind, 'failure')
  assert.equal(payload.usage.totalTokens, 2211, 'Total tokens must include reference outputs (274) + multiJudge (1937) = 2211')
  assert.ok(payload.usage.multiJudge, 'multiJudge usage object must be present')
  assert.equal(payload.usage.multiJudge.totalTokens, 1937)
})

test('#213: useMoASettings hook sets actions.saved_memory_only when server responds with persisted: false', async () => {
  const clientHookFile = path.resolve('src/client/120-settings-hook.js')
  const part = (await fs.readFile(clientHookFile, 'utf8')).split('    class MoAErrorBoundary')[0]

  const updates = []
  const calls = []
  const React = {
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect: () => {},
    useState: (initial) => [
      typeof initial === 'function' ? initial() : initial,
      (v) => updates.push(typeof v === 'function' ? v({}) : v),
    ],
  }

  const hook = vm.runInNewContext(
    '(function(){' + part + ';return useMoASettings})()',
    {
      React,
      rootCtx: null,
      NS: 'dsh-moa',
      en: {},
      makeT: () => (k) => k,
      fetch: async (url, opts) => {
        calls.push({ url, method: opts?.method })
        return {
          ok: true,
          json: async () => ({ ok: true, persisted: false, presets: [], defaultPreset: 'default' }),
        }
      },
      console,
      setTimeout: (fn) => fn(),
    }
  )

  const h = hook({ t: (k) => k })
  h.handleSave()
  await new Promise((r) => setTimeout(r, 20))

  assert.ok(updates.includes('actions.saved_memory_only'), `useState updates must include actions.saved_memory_only when persisted is false. Got: ${JSON.stringify(updates)}`)
  assert.ok(!updates.includes('actions.saved'), 'actions.saved must NOT be displayed when persisted is false')
})

test('#213: useMoASettings hook sets actions.saved when server responds with persisted: true', async () => {
  const clientHookFile = path.resolve('src/client/120-settings-hook.js')
  const part = (await fs.readFile(clientHookFile, 'utf8')).split('    class MoAErrorBoundary')[0]

  const updates = []
  const calls = []
  const React = {
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect: () => {},
    useState: (initial) => [
      typeof initial === 'function' ? initial() : initial,
      (v) => updates.push(typeof v === 'function' ? v({}) : v),
    ],
  }

  const hook = vm.runInNewContext(
    '(function(){' + part + ';return useMoASettings})()',
    {
      React,
      rootCtx: null,
      NS: 'dsh-moa',
      en: {},
      makeT: () => (k) => k,
      fetch: async (url, opts) => {
        calls.push({ url, method: opts?.method })
        return {
          ok: true,
          json: async () => ({ ok: true, persisted: true, presets: [], defaultPreset: 'default' }),
        }
      },
      console,
      setTimeout: (fn) => fn(),
    }
  )

  const h = hook({ t: (k) => k })
  h.handleSave()
  await new Promise((r) => setTimeout(r, 20))

  assert.ok(updates.includes('actions.saved'), `useState updates must include actions.saved when persisted is true. Got: ${JSON.stringify(updates)}`)
})
