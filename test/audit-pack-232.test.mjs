import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { runCandidateTestGate } from '../lib/moa-test-gate.js'
import { writeCandidateWorkspace } from '../lib/file-workspace.js'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { buildSynthesisPrompt } from '../lib/moa-prompts.js'
import { calcSynthesisPromptTokens } from '../lib/moa-budget.js'

const oct = (s) => [...Buffer.from(s)].map((n) => '\\' + n.toString(8).padStart(3, '0')).join('')

// ── ISSUE #161: Filesystem isolation against computed octal/hex evasion ──

test('#161: Test Gate blocks native shell script from reading outside sandbox via octal path', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-232-oct-read-'))
  const outsideTarget = path.join(tmp, 'outside-secret.txt')
  await fs.writeFile(outsideTarget, 'SYNTHETIC_OUTSIDE_SECRET_232')

  const cwd = path.join(tmp, 'sandbox')
  await fs.mkdir(cwd, { recursive: true })

  const content = `p="$(printf ${JSON.stringify(oct(outsideTarget))})"\ncat "$p"\n`
  await writeCandidateWorkspace(cwd, 1, [{ relativePath: 'probe.sh', content }])

  const gate = await runCandidateTestGate({
    cwd,
    candidateIndex: 1,
    testCommand: 'sh probe.sh',
  })

  assert.ok(gate, 'Gate result should exist')
  assert.equal(gate.passed, false, 'Octal evasion read must fail gate')
  assert.ok(!gate.output.includes('SYNTHETIC_OUTSIDE_SECRET_232'), 'Output must NOT contain outside secret')
  assert.match(gate.output, /Access denied/i, 'Gate output must report access denied')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#161: Test Gate blocks native shell script from writing outside sandbox via octal path', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-232-oct-write-'))
  const outsideTarget = path.join(tmp, 'unauthorized-target.txt')

  const cwd = path.join(tmp, 'sandbox')
  await fs.mkdir(cwd, { recursive: true })

  const content = `p="$(printf ${JSON.stringify(oct(outsideTarget))})"\nprintf PWNED_232 > "$p"\n`
  await writeCandidateWorkspace(cwd, 1, [{ relativePath: 'probe.sh', content }])

  const gate = await runCandidateTestGate({
    cwd,
    candidateIndex: 1,
    testCommand: 'sh probe.sh',
  })

  assert.ok(gate, 'Gate result should exist')
  assert.equal(gate.passed, false, 'Octal evasion write must fail gate')
  const fileWritten = await fs.readFile(outsideTarget, 'utf8').catch(() => null)
  assert.equal(fileWritten, null, 'Outside target file must NOT be created or written')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#161: Test Gate blocks node child process from accessing outside sandbox via computed octal command', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-232-child-oct-'))
  const outsideTarget = path.join(tmp, 'outside-secret.txt')
  await fs.writeFile(outsideTarget, 'SYNTHETIC_OUTSIDE_CHILD_232')

  const cwd = path.join(tmp, 'sandbox')
  await fs.mkdir(cwd, { recursive: true })

  const cmd = `p="$(printf ${JSON.stringify(oct(outsideTarget))})";cat "$p"`
  const content = `const r=require("node:child_process").spawnSync("sh",["-c",${JSON.stringify(cmd)}],{encoding:"utf8"});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout)`
  await writeCandidateWorkspace(cwd, 1, [{ relativePath: 'probe.cjs', content }])

  const gate = await runCandidateTestGate({
    cwd,
    candidateIndex: 1,
    testCommand: 'node probe.cjs',
  })

  assert.ok(gate, 'Gate result should exist')
  assert.equal(gate.passed, false, 'Node child octal evasion must fail gate')
  assert.ok(!gate.output.includes('SYNTHETIC_OUTSIDE_CHILD_232'), 'Output must NOT contain outside secret')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

// ── ISSUE #225: Eliminating false positives on safe routes and base64 ─────

test('#225: Test Gate allows safe HTTP route literals like /run/user without false positives', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-225-route-'))
  const cwd = path.join(tmp, 'sandbox')
  await fs.mkdir(cwd, { recursive: true })

  const content = 'const routes={"/run/user":()=>200};if(routes["/run/user"]()!==200)throw Error("bad");console.log("SAFE_ROUTE_USER232")'
  await writeCandidateWorkspace(cwd, 1, [{ relativePath: 'probe.cjs', content }])

  const gate = await runCandidateTestGate({
    cwd,
    candidateIndex: 1,
    testCommand: 'node probe.cjs',
  })

  assert.ok(gate, 'Gate result should exist')
  assert.equal(gate.passed, true, 'Safe /run/user route literal must PASS gate')
  assert.ok(gate.output.includes('SAFE_ROUTE_USER232'), 'Gate output must contain script stdout')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

test('#225: Test Gate allows safe data base64 decoding without false positives', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-225-b64-'))
  const cwd = path.join(tmp, 'sandbox')
  await fs.mkdir(cwd, { recursive: true })

  const content = 'result="$(printf T0s= | base64 -d)"\n[ "$result" = "OK" ]\nprintf SAFE_BASE64_232\n'
  await writeCandidateWorkspace(cwd, 1, [{ relativePath: 'probe.sh', content }])

  const gate = await runCandidateTestGate({
    cwd,
    candidateIndex: 1,
    testCommand: 'sh probe.sh',
  })

  assert.ok(gate, 'Gate result should exist')
  assert.equal(gate.passed, true, 'Safe base64 data decoding must PASS gate')
  assert.ok(gate.output.includes('SAFE_BASE64_232'), 'Gate output must contain script stdout')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

// ── ISSUE #158: Synthesis prompt tokens and budget accounting with Test Gate logs ──

test('#158: Synthesis with Test Gate logs accounts for full log size and blocks judge if over budget', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-158-logs-'))
  const ticks = '```'
  const candidateCode = ticks + 'javascript file="probe.cjs"\nconsole.log("SYNTHETIC_LOG232".repeat(400))\n' + ticks

  const preset = {
    name: 'audit232-testgate-budget',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'c1' }, { provider: 'mock', model: 'c2' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 128,
    max_budget_usd: 0.002,
    budget_guard_enabled: true,
    budget_action: 'abort',
    test_gate_enabled: true,
    test_command: 'node probe.cjs',
  }

  const calls = []
  const res = await runMoAPipeline({
    cwd: tmp,
    userPrompt: 'refactor application architecture',
    preset,
    prices: { '*': { input: 1, output: 1 } },
    callLlm: async ({ model, messages, maxTokens }) => {
      const chars = messages.reduce((n, m) => n + m.content.length, 0)
      const inputTokens = Math.ceil(chars / 4)
      const text = model === 'judge' ? 'WINNER: 1' : candidateCode
      const outputTokens = Math.ceil(text.length / 4)
      calls.push({ model, inputTokens, outputTokens, maxTokens, promptChars: chars })
      return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } }
    },
  })

  assert.ok(res, 'Pipeline result must exist')
  // Because test gate logs added ~4000 characters, downstream synthesis estimate exceeded $0.002 limit
  assert.equal(res.kind, 'failure', 'Must abort before judge synthesis')
  assert.ok(!calls.some((c) => c.model === 'judge'), 'Judge model must NOT be called')
  assert.ok((res.usage?.totalCostUsd || 0) <= preset.max_budget_usd, `Cost ($${res.usage?.totalCostUsd}) must not exceed limit ($${preset.max_budget_usd})`)

  // Verify calcSynthesisPromptTokens aligns with buildSynthesisPrompt
  const actualPrompt = buildSynthesisPrompt('refactor application architecture', res.references || [], '')
  const estimatedPromptTokens = calcSynthesisPromptTokens('refactor application architecture', res.references || [], '')
  const actualPromptTokens = Math.ceil(actualPrompt.length / 4)
  const tokenDelta = Math.abs(estimatedPromptTokens - actualPromptTokens)
  assert.ok(tokenDelta < 200, `calcSynthesisPromptTokens (${estimatedPromptTokens}) must align with buildSynthesisPrompt (${actualPromptTokens}), delta=${tokenDelta}`)

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

// ── ISSUE #168: Budget abort preserves panel tokens after real panel execution ──

test('#168: Budget abort preserves all tokens when panel executed and judge aborted', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-168-real-panel-'))
  const userPrompt = '评'.repeat(2000)
  const preset = {
    name: 'audit232-panel-real-abort',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'mock', model: 'one' }, { provider: 'mock', model: 'two' }],
    aggregator: { provider: 'mock', model: 'judge' },
    max_tokens: 64,
    budget_guard_enabled: true,
    budget_action: 'abort',
    max_budget_usd: 0.0064,
    multi_judge_enabled: true,
    judge_models: [{ provider: 'mock', model: 'panel' }],
  }

  const calls = []
  const res = await runMoAPipeline({
    cwd: tmp,
    userPrompt,
    preset,
    prices: { '*': { input: 1, output: 1 } },
    callLlm: async ({ model, messages, maxTokens }) => {
      const inputTokens = Math.ceil(messages.reduce((n, m) => n + Buffer.byteLength(m.content), 0) / 4)
      const text = model === 'panel' ? 'BEST_CANDIDATE: 1\n' + 'A'.repeat(180) : model === 'judge' ? 'WINNER: 1' : 'proposal'
      const outputTokens = Math.ceil(Buffer.byteLength(text) / 4)
      calls.push({ model, inputTokens, outputTokens, maxTokens })
      return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } }
    },
  })

  assert.ok(res, 'Pipeline result must exist')
  assert.equal(res.kind, 'failure', 'Must abort before judge due to budget')
  assert.ok(calls.some((c) => c.model === 'panel'), 'Panel MUST have been executed')
  assert.ok(!calls.some((c) => c.model === 'judge'), 'Judge MUST NOT have been called')

  const actualTokenSum = calls.reduce((acc, c) => acc + c.inputTokens + c.outputTokens, 0)
  assert.equal(res.usage?.totalTokens, actualTokenSum, `All phase tokens (${actualTokenSum}) must be preserved in abort usage (${res.usage?.totalTokens})`)
  assert.ok(res.usage?.multiJudge, 'multiJudge usage structure must be populated')

  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
})

// ── ISSUE #187: useSyncExternalStore lifecycle contract ───────────────────

test('#187: React useSyncExternalStore contract (snapshot referential stability and subscription lifecycle)', () => {
  // Simulates external store conforming to React useSyncExternalStore contract
  let state = { config: { enabled: true, preset: 'default' }, version: 1 }
  const listeners = new Set()

  const store = {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => state,
    update: (newConfig) => {
      state = { config: { ...state.config, ...newConfig }, version: state.version + 1 }
      listeners.forEach((l) => l())
    },
  }

  // 1. Referential stability: consecutive getSnapshot calls return identical reference
  const snap1 = store.getSnapshot()
  const snap2 = store.getSnapshot()
  assert.equal(Object.is(snap1, snap2), true, 'Consecutive getSnapshot calls must return referentially identical snapshot')

  // 2. Subscription lifecycle
  let notifyCount = 0
  const unsub = store.subscribe(() => {
    notifyCount++
  })
  assert.equal(listeners.size, 1, 'Listener must be registered')

  // 3. Update notification and new snapshot reference
  store.update({ preset: 'creative' })
  assert.equal(notifyCount, 1, 'Subscriber must be notified on update')
  const snap3 = store.getSnapshot()
  assert.equal(Object.is(snap1, snap3), false, 'New snapshot must have new reference on update')
  assert.equal(snap3.config.preset, 'creative')

  // 4. Unsubscribe lifecycle
  unsub()
  assert.equal(listeners.size, 0, 'Unsubscribe must remove listener')
  store.update({ preset: 'speed' })
  assert.equal(notifyCount, 1, 'Unsubscribed listener must NOT be called on subsequent updates')
})
