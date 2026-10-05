import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import EventEmitter from 'node:events'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { runCandidateTestGate } from '../lib/moa-test-gate.js'
import { writeCandidateWorkspace, isLoopbackUrl } from '../lib/file-workspace.js'
import { applyBudgetGuardrails, checkPhaseBudget } from '../lib/moa-budget.js'
import { registerMoaRoutes } from '../lib/routes.js'
import { recordMoaRun } from '../lib/history.js'
import { logger } from '../lib/logger.js'

const suiteTmp = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-suite-45-'))
process.env.DSH_HISTORY_FILE = path.join(suiteTmp, 'moa-history.jsonl')

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
      if (resBody) {
        let json = null
        try { json = JSON.parse(resBody) } catch {}
        resolve({ status: statusCode, headers: resHeaders, body: resBody, json })
        return
      }
      res.once('finish', () => {
        let json = null
        try { json = JSON.parse(resBody) } catch {}
        resolve({ status: statusCode, headers: resHeaders, body: resBody, json })
      })
    }),
  }
}

test('#158: budget guardrail accounts for all phases and blocks $0.001 limit run upfront', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-158-audit-'))
  const prices = { '*': { input: 1, output: 1 } }
  const limit = 0.001
  const preset = {
    name: 'audit44',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'one' }, { provider: 'mock', model: 'two' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 64,
    peer_critique_enabled: true,
    budget_guard_enabled: true,
    max_budget_usd: limit,
    budget_action: 'abort',
  }

  try {
    const upfront = applyBudgetGuardrails({
      references: preset.reference_models,
      aggregator: preset.aggregator,
      enabled: true,
      maxBudgetUsd: limit,
      action: 'abort',
      promptLength: 11,
      maxTokens: 64,
      prices,
      peerCritiqueEnabled: true,
    })
    assert.equal(upfront.allowed, false, 'Upfront estimate must reject run exceeding $0.001 budget')
    assert.equal(upfront.action, 'abort')
    assert.match(upfront.reason, /exceeds.*budget/i)

    const calls = []
    const result = await runMoAPipeline({
      userPrompt: 'modify code',
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
      preset,
      prices,
      callLlm: async ({ model, messages, maxTokens }) => {
        calls.push({ model, messages, maxTokens })
        return { text: 'code', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } }
      },
    })
    assert.equal(result.kind, 'failure')
    assert.equal(calls.length, 0, 'No LLM calls must be dispatched when upfront budget guard triggers')
    assert.match(result.content, /Budget Guardrail Abort/i)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#158: runtime phase budget check skips Round 2 when remaining budget is insufficient', () => {
  const phaseCheck = checkPhaseBudget({
    phaseName: 'Consilium Round 2',
    currentSpentUsd: 0.0008,
    nextPhaseCostUsd: 0.0004,
    maxBudgetUsd: 0.001,
    action: 'trim',
    enabled: true,
  })
  assert.equal(phaseCheck.allowed, false)
  assert.equal(phaseCheck.action, 'trim')
  assert.match(phaseCheck.reason, /Consilium Round 2 exceeds max budget/i)
})

test('#158: runtime judge synthesis aborts when judge cost exceeds remaining budget under action trim', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-158-judge-'))
  const prices = { '*': { input: 1, output: 1 } }
  const limit = 0.0011
  const preset = {
    name: 'audit158-judge',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'one' }, { provider: 'mock', model: 'two' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 64,
    peer_critique_enabled: false,
    budget_guard_enabled: true,
    max_budget_usd: limit,
    budget_action: 'trim',
  }

  try {
    const calls = []
    const result = await runMoAPipeline({
      userPrompt: 'modify code',
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
      preset,
      prices,
      callLlm: async ({ model, messages, maxTokens }) => {
        const chars = messages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0)
        const text = model === 'judge' ? 'WINNER: 1' : 'A'.repeat(200)
        const inputTokens = Math.ceil(chars / 4)
        const outputTokens = Math.ceil(text.length / 4)
        calls.push(model)
        return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } }
      },
    })

    assert.equal(result.kind, 'failure')
    assert.match(result.content, /Budget Guardrail Abort/i)
    assert.deepEqual(calls, ['one', 'two'], 'Judge must NOT be called when it exceeds remaining budget')
    assert.ok(result.usage.totalCostUsd <= limit, `Total cost ${result.usage.totalCostUsd} must not exceed ${limit}`)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#224: budget_action trim skips Round 2 without TypeError and executes Judge synthesis', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-224-trim-'))
  const prices = { '*': { input: 1, output: 1 } }
  const limit = 0.0022
  const preset = {
    name: 'audit45',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'one' }, { provider: 'mock', model: 'two' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 64,
    peer_critique_enabled: true,
    budget_guard_enabled: true,
    max_budget_usd: limit,
    budget_action: 'trim',
  }

  try {
    const calls = []
    const progressLogs = []
    const result = await runMoAPipeline({
      userPrompt: 'modify code',
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
      preset,
      prices,
      onProgress: (s) => progressLogs.push(s),
      callLlm: async ({ model, messages, maxTokens }) => {
        const chars = messages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0)
        const text = model === 'judge' ? 'WINNER: 1' : 'A'.repeat(200)
        const inputTokens = Math.ceil(chars / 4)
        const outputTokens = Math.ceil(text.length / 4)
        calls.push(model)
        return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } }
      },
    })

    assert.equal(result.kind, 'synthesis')
    assert.deepEqual(calls, ['one', 'two', 'judge'], 'Round 2 peer critique calls must be skipped under trim')
    assert.ok(progressLogs.some((l) => /Skipping Round 2 to stay within budget/i.test(l)), 'Must log skipping Round 2')
    assert.ok(result.usage.totalCostUsd <= limit, `Total cost ${result.usage.totalCostUsd} must not exceed ${limit}`)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#225: test gate permits safe URLs, node imports, and relative paths without false leak error', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-225-url-'))

  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      {
        relativePath: 'test/suite.cjs',
        content: `
          const assert = require('node:assert/strict');
          const apiUrl = "https://example.invalid/v1/test?user=admin#section";
          const helper = require('./helper.cjs');
          console.log("SAFE_URL_TEST_45: " + apiUrl + " -> " + helper.val);
        `,
      },
      {
        relativePath: 'test/helper.cjs',
        content: `module.exports = { val: 42 };`,
      },
      {
        relativePath: 'package.json',
        content: JSON.stringify({
          name: 'synthetic-url-pkg',
          version: '1.0.0',
          scripts: { test: 'node test/suite.cjs' },
        }),
      },
    ])

    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'npm test',
      maxOutputChars: 9000,
    })

    assert.equal(res.passed, true, `Safe URL and relative imports must pass: ${res.output}`)
    assert.equal(res.exitCode, 0)
    assert.match(res.output, /SAFE_URL_TEST_45/)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#161: test gate sandboxing blocks shell script escape attempting to read host files', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-161-audit-'))
  const outsideFile = path.join(os.tmpdir(), `moa-outside-${Date.now()}.txt`)
  await fs.writeFile(outsideFile, 'SYNTHETIC_HOST_MARKER_44')

  try {
    await writeCandidateWorkspace(tmpDir, 1, [{
      relativePath: 'probe.sh',
      content: `cat "${outsideFile}"\n`,
    }])

    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'sh probe.sh',
    })

    assert.equal(res.passed, false, 'Shell script escape must fail gate')
    assert.equal(res.exitCode, 1)
    assert.match(res.output, /Access denied/i)
    assert.doesNotMatch(res.output, /SYNTHETIC_HOST_MARKER_44/, 'Must not leak host marker')
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
    fsSync.rmSync(outsideFile, { force: true })
  }
})

test('#161: test gate sandboxing blocks nested relative shell script payload reading host marker', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-161-nested-'))
  const outsideFile = path.join(os.tmpdir(), `moa-nested-outside-${Date.now()}.txt`)
  await fs.writeFile(outsideFile, 'SYNTHETIC_NESTED_MARKER_45')

  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      {
        relativePath: 'entry.sh',
        content: `sh payload.sh\n`,
      },
      {
        relativePath: 'payload.sh',
        content: `cat "${outsideFile}"\n`,
      },
    ])

    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'sh entry.sh',
    })

    assert.equal(res.passed, false, 'Nested shell script escape must fail gate')
    assert.equal(res.exitCode, 1)
    assert.match(res.output, /Access denied/i)
    assert.doesNotMatch(res.output, /SYNTHETIC_NESTED_MARKER_45/)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
    fsSync.rmSync(outsideFile, { force: true })
  }
})

test('#161: test gate ephemeral fence hooks child_process.spawnSync to block host escape', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-161-spawnsync-'))
  const outsideFile = path.join(os.tmpdir(), `moa-spawnsync-out-${Date.now()}.txt`)
  await fs.writeFile(outsideFile, 'SYNTHETIC_SPAWNSYNC_MARKER_45')
  const chars = JSON.stringify([...outsideFile].map((c) => c.charCodeAt(0)))
  const src = 'const p=String.fromCharCode(...' + chars + '); console.log(require("node:child_process").spawnSync("cat",[p],{encoding:"utf8"}).stdout)'

  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      {
        relativePath: 'escape.cjs',
        content: src,
      },
    ])

    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'node escape.cjs',
    })

    assert.equal(res.passed, false, 'spawnSync host escape must fail gate')
    assert.equal(res.exitCode, 1)
    assert.match(res.output, /ERR_ACCESS_DENIED/i)
    assert.doesNotMatch(res.output, /SYNTHETIC_SPAWNSYNC_MARKER_45/)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
    fsSync.rmSync(outsideFile, { force: true })
  }
})

test('#216: test gate supports placeholder replacement when paths contain spaces', async () => {
  const baseTmp = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa 216 space dir '))
  const tmpDir = path.join(baseTmp, 'sub dir space')
  await fs.mkdir(tmpDir, { recursive: true })

  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      {
        relativePath: 'test space.cjs',
        content: `console.log("SPACE_TEST_45");`,
      },
    ])

    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'node "{candidateDir}/test space.cjs"',
    })

    assert.equal(res.passed, true, `Command with spaces must succeed: ${res.output}`)
    assert.equal(res.exitCode, 0)
    assert.match(res.output, /SPACE_TEST_45/)
  } finally {
    fsSync.rmSync(baseTmp, { recursive: true, force: true })
  }
})

test('#214: peer critique error logs accurate warning label instead of estimate cost error', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-214-label-'))
  const prices = { '*': { input: 1, output: 1 } }
  const preset = {
    name: 'audit214',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'one' }, { provider: 'mock', model: 'two' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 100,
    peer_critique_enabled: true,
  }

  const warnings = []
  const prior = logger.warn
  logger.warn = (...x) => warnings.push(x.join(' '))

  try {
    const calls = []
    const res = await runMoAPipeline({
      userPrompt: 'short',
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
      preset,
      prices,
      callLlm: async ({ model }) => {
        calls.push(model)
        if (calls.length > 2 && model !== 'judge') {
          throw new Error('SYNTHETIC_PEER_PROVIDER_FAILURE')
        }
        return { text: model === 'judge' ? 'WINNER: 1' : 'proposal', usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } }
      },
    })

    assert.equal(res.kind, 'synthesis')
    assert.ok(warnings.some((w) => /Round 2 peer critique failed for candidate/i.test(w)), 'Accurate R2 failure label logged')
    assert.ok(!warnings.some((w) => /Failed to estimate Round 2 cost/i.test(w)), 'Old inaccurate label must not appear')
  } finally {
    logger.warn = prior
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#210: isLoopbackUrl validates loopback addresses and rejects external SSRF targets', () => {
  assert.equal(isLoopbackUrl('http://localhost:3080/dsh-time-machine/create'), true)
  assert.equal(isLoopbackUrl('http://127.0.0.1:3000/dsh-time-machine/create'), true)
  assert.equal(isLoopbackUrl('http://127.0.0.2:8080/hook'), true)
  assert.equal(isLoopbackUrl('http://[::1]:3000/endpoint'), true)

  assert.equal(isLoopbackUrl('http://169.254.169.254/latest/meta-data'), false)
  assert.equal(isLoopbackUrl('http://10.0.0.1:3000'), false)
  assert.equal(isLoopbackUrl('http://evil.com/ssrf'), false)
  assert.equal(isLoopbackUrl('file:///etc/passwd'), false)
  assert.equal(isLoopbackUrl('javascript:alert(1)'), false)
  assert.equal(isLoopbackUrl(''), false)
  assert.equal(isLoopbackUrl(null), false)
})

test('#211: candidate diff route rejects unauthorized cwd and missing runs', async () => {
  const routes = new Map()
  const mockCtx = {
    webServer: {
      register: ({ kind, path: p, handler }) => {
        routes.set(p, handler)
        return () => routes.delete(p)
      },
    },
    effect: (fn) => fn(),
    logger: { warn: () => {} },
  }
  registerMoaRoutes(mockCtx, {
    live: () => ({ enabled: true, presets: [{ name: 'default' }] }),
    callLlm: async () => {},
    liveCanvas: {},
  })

  // 1. Missing runId returns 404
  const mock404 = createMockReqRes({
    method: 'GET',
    url: '/dsh-moa/diff?runId=non-existent-run-12345',
  })
  mock404.send()
  routes.get('/dsh-moa/diff')(mock404.req, mock404.res)
  const res404 = await mock404.getResult()
  assert.equal(res404.status, 404)
  assert.match(res404.json.error, /not found/i)

  // 2. Mismatched cwd for existing run returns 403
  recordMoaRun({
    id: 'test-run-auth-211',
    timestamp: Date.now(),
    preset: 'default',
    prompt: 'test',
    cwd: '/authorized/path',
  })

  const mock403 = createMockReqRes({
    method: 'GET',
    url: '/dsh-moa/diff?runId=test-run-auth-211&cwd=/unauthorized/external/path',
  })
  mock403.send()
  routes.get('/dsh-moa/diff')(mock403.req, mock403.res)
  const res403 = await mock403.getResult()
  assert.equal(res403.status, 403)
  assert.match(res403.json.error, /Forbidden.*cwd/i)
})

test('#210 & #217: run route rejects non-loopback timeMachineUrl with 400', async () => {
  const routes = new Map()
  const mockCtx = {
    webServer: {
      register: ({ kind, path: p, handler }) => {
        routes.set(p, handler)
        return () => routes.delete(p)
      },
    },
    effect: (fn) => fn(),
    logger: { warn: () => {} },
  }
  registerMoaRoutes(mockCtx, {
    live: () => ({ enabled: true, presets: [{ name: 'default' }] }),
    callLlm: async () => {},
    liveCanvas: {},
  })

  const mockSsrf = createMockReqRes({
    method: 'POST',
    url: '/dsh-moa/run',
    body: JSON.stringify({
      prompt: 'hello world',
      timeMachineUrl: 'http://169.254.169.254/latest/meta-data',
    }),
  })
  mockSsrf.send()
  routes.get('/dsh-moa/run')(mockSsrf.req, mockSsrf.res)
  const resSsrf = await mockSsrf.getResult()
  assert.equal(resSsrf.status, 400)
  assert.match(resSsrf.json.error, /loopback.*required/i)
})

test('#206: test gate permits standard npm test execution within workspace sandbox', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-206-audit-'))
  const priorHome = process.env.HOME
  process.env.HOME = path.join(tmpDir, 'fake-home')
  await fs.mkdir(process.env.HOME, { recursive: true })

  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      {
        relativePath: 'package.json',
        content: JSON.stringify({
          name: 'synthetic-test-gate',
          version: '1.0.0',
          scripts: { test: 'node check.cjs' },
        }),
      },
      {
        relativePath: 'check.cjs',
        content: 'console.log("VALID_NPM_TEST_44")',
      },
    ])

    const res = await runCandidateTestGate({
      cwd: tmpDir,
      candidateIndex: 1,
      testCommand: 'npm test',
      maxOutputChars: 9000,
    })

    assert.equal(res.passed, true, `Standard npm test must pass inside test gate: ${res.output}`)
    assert.equal(res.exitCode, 0)
    assert.match(res.output, /VALID_NPM_TEST_44/)
  } finally {
    process.env.HOME = priorHome
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('#207: fast mode promotion failure preserves token usage, cost, references and records history', async () => {
  const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'moa-207-audit-'))
  const appFile = path.join(tmpDir, 'app.js')
  await fs.writeFile(appFile, 'ORIGINAL')
  const historyFilePath = path.join(tmpDir, 'failed-history.jsonl')
  const fence = '```'

  const preset = {
    name: 'audit207',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'fast-cand' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 64,
  }

  try {
    const res = await runMoAPipeline({
      userPrompt: 'modify code',
      cwd: tmpDir,
      preset,
      prices: { '*': { input: 1, output: 1 } },
      historyFilePath,
      force: false,
      checkpointFn: async () => {
        throw new Error('SYNTHETIC_CHECKPOINT_FAILURE')
      },
      callLlm: async () => ({
        text: `${fence}js file="app.js"\nREPLACEMENT\n${fence}`,
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      }),
    })

    assert.equal(res.kind, 'failure')
    assert.match(res.content, /Checkpoint or Promotion Failure/i)
    assert.equal(res.winningIndex, 0)
    assert.equal(res.winnerModel, 'none')
    assert.deepEqual(res.promotedFiles, [])

    assert.equal(res.usage.totalTokens, 120, 'Candidate tokens must be preserved on failure')
    assert.equal(res.usage.totalCostUsd, 0.00012, 'Candidate cost must be preserved on failure')
    assert.equal(res.references.length, 1)
    assert.equal(res.references[0].usage.totalTokens, 120)

    const diskContent = await fs.readFile(appFile, 'utf8')
    assert.equal(diskContent, 'ORIGINAL', 'Original file must remain untouched')

    assert.equal(fsSync.existsSync(historyFilePath), true, 'History record must be saved')
    const historyLines = fsSync.readFileSync(historyFilePath, 'utf8').trim().split('\n')
    assert.equal(historyLines.length, 1)
    const entry = JSON.parse(historyLines[0])
    assert.equal(entry.totalTokens, 120)
    assert.equal(entry.totalCostUsd, 0.00012)
    assert.match(entry.error, /Pre-promotion checkpoint failed|SYNTHETIC_CHECKPOINT_FAILURE/i)
  } finally {
    fsSync.rmSync(tmpDir, { recursive: true, force: true })
  }
})
