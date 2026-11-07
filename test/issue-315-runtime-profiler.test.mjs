import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractExecutableCode,
  profileCodeExecution,
  runProfilerGate,
  formatProfilerDirective,
} from '../lib/pipeline/runtime-profiler.js'
import { MOA_EVENTS } from '../lib/events.js'

test('extractExecutableCode: extracts code from javascript markdown fence', () => {
  const md = "Here is the code:\n```javascript\nfunction solve() { return 42; }\n```\nDone."
  const code = extractExecutableCode(md)
  assert.equal(code.trim(), 'function solve() { return 42; }')
})

test('profileCodeExecution: measures iterations, duration, and ops/sec on algorithmic code', () => {
  const code = `
    function fibonacci(n = 10) {
      let a = 0, b = 1;
      for (let i = 0; i < n; i++) {
        const temp = a + b;
        a = b;
        b = temp;
      }
      return b;
    }
  `

  const rep = profileCodeExecution(code, { iterations: 50, timeoutMs: 1000 })
  assert.equal(rep.passed, true)
  assert.equal(rep.iterations, 50)
  assert.ok(rep.durationMs >= 0)
  assert.ok(rep.opsPerSec > 0)
  assert.equal(rep.error, null)
  assert.match(rep.summary, /⚡ Profiler:/)
})

test('profileCodeExecution: handles infinite loop code via hard timeout without hanging', () => {
  const loopCode = `
    function hangForever() {
      while (true) {}
    }
  `

  const rep = profileCodeExecution(loopCode, { iterations: 10, timeoutMs: 50 })
  assert.equal(rep.passed, false)
  assert.ok(rep.error.includes('timed out'))
  assert.match(rep.summary, /TIMEOUT/)
})

test('runProfilerGate: profiles candidates and emits MOA_EVENTS.PROFILER_COMPLETE', () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const candidates = [
    {
      model: 'fast-algo',
      output: `function fastSearch(arr, val) { return arr ? arr.indexOf(val) : -1; }`,
    },
    {
      model: 'slow-algo',
      output: `function slowSearch(arr, val) { for (let i = 0; i < 1000; i++) {} return 0; }`,
    },
  ]

  const progressLogs = []
  const res = runProfilerGate(candidates, {
    ctx: mockCtx,
    runId: 'prof-run-1',
    iterations: 20,
    timeoutMs: 1000,
    onProgress: (m) => progressLogs.push(m),
  })

  assert.equal(res.results.length, 2)
  assert.ok(candidates[0].profilerReport)
  assert.ok(candidates[1].profilerReport)

  assert.equal(emitted.length, 2)
  assert.equal(emitted[0].ev, MOA_EVENTS.PROFILER_COMPLETE)
  assert.equal(emitted[1].ev, MOA_EVENTS.PROFILER_COMPLETE)

  assert.ok(res.profilerDirective.includes('RUNTIME PERFORMANCE & CPU/MEMORY PROFILER REPORT'))
  assert.ok(res.profilerDirective.includes('Candidate 1**: ⏱️'))
})
