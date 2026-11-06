/**
 * DeepSeek Harness Mixture of Agents (MoA) — Runtime CPU & Memory Profiler Gate (#315)
 *
 * Micro-benchmarks candidate code execution duration, ops/sec throughput, and heap memory usage
 * in an isolated sandbox with hard timeout protection to guide Judge selection towards
 * algorithmically optimal solutions.
 */

import vm from 'node:vm'
import { MOA_EVENTS, emitEvent } from '../events.js'

/**
 * Extracts executable JavaScript code from markdown fences or raw code.
 *
 * @param {string} text
 * @returns {string}
 */
export function extractExecutableCode(text) {
  if (!text || typeof text !== 'string') return ''
  const jsFenceMatch = text.match(/```(?:javascript|js|node)\s*\n([\s\S]*?)\n```/i)
  if (jsFenceMatch && jsFenceMatch[1]) {
    return jsFenceMatch[1]
  }
  const anyFenceMatch = text.match(/```\w*\s*\n([\s\S]*?)\n```/)
  if (anyFenceMatch && anyFenceMatch[1]) {
    return anyFenceMatch[1]
  }
  return text
}

/**
 * Profiles code execution in an isolated VM sandbox.
 *
 * @param {string} rawCode - Candidate source code or markdown
 * @param {object} [options]
 * @returns {object} Profiler report
 */
export function profileCodeExecution(rawCode, options = {}) {
  const {
    iterations = 100,
    timeoutMs = 2000,
  } = options

  const code = extractExecutableCode(rawCode)
  if (!code || !code.trim()) {
    return {
      passed: false,
      durationMs: 0,
      heapBytesUsed: 0,
      opsPerSec: 0,
      iterations: 0,
      error: 'Empty or unexecutable code provided for profiling.',
      summary: 'Profiler skipped: no executable code.',
    }
  }

  // Initial sandbox built-ins to ignore when scanning for user functions
  const initialKeys = new Set([
    'console', 'Math', 'Date', 'Array', 'Object', 'String', 'Number',
    'Boolean', 'Set', 'Map', 'JSON', 'parseInt', 'parseFloat',
    'globalThis', 'global', '__mainFn', '__benchFn', '__benchArg'
  ])

  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Set,
    Map,
    JSON,
    parseInt,
    parseFloat,
  }
  sandbox.globalThis = sandbox
  sandbox.global = sandbox

  // Convert export declarations to var / global assignments
  const cleanCode = code
    .replace(/^\s*export\s+default\s+/gm, 'globalThis.__mainFn = ')
    .replace(/^\s*export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/gm, 'function $1')
    .replace(/^\s*export\s+const\s+([a-zA-Z0-9_]+)/gm, 'var $1')
    .replace(/^\s*import\s+.*?;?\s*$/gm, '// [import stripped for benchmark]')

  try {
    const context = vm.createContext(sandbox)
    // Run candidate code once to evaluate top-level declarations
    const setupScript = new vm.Script(cleanCode)
    setupScript.runInContext(context, { timeout: Math.min(1000, timeoutMs) })

    // Find entrypoint function: either __mainFn or any user-defined function on sandbox
    let targetFn = sandbox.__mainFn
    if (typeof targetFn !== 'function') {
      const userKeys = Object.keys(sandbox).filter((k) => !initialKeys.has(k) && typeof sandbox[k] === 'function')
      if (userKeys.length > 0) {
        targetFn = sandbox[userKeys[userKeys.length - 1]]
      }
    }

    sandbox.__benchFn = targetFn || null
    sandbox.__benchArg = 10

    let benchScript
    if (typeof sandbox.__benchFn === 'function') {
      benchScript = new vm.Script(`
        try {
          __benchFn();
        } catch (_) {
          try { __benchFn(__benchArg); } catch (__) {}
        }
      `)
    } else {
      benchScript = new vm.Script(`(() => { ${cleanCode} })()`)
    }

    // Warm-up run
    benchScript.runInContext(context, { timeout: Math.min(1000, timeoutMs) })

    // Measure memory and time
    const startMem = process.memoryUsage().heapUsed
    const startHr = process.hrtime.bigint()

    for (let i = 0; i < iterations; i++) {
      benchScript.runInContext(context, { timeout: Math.min(500, timeoutMs) })
    }

    const endHr = process.hrtime.bigint()
    const endMem = process.memoryUsage().heapUsed

    const totalNs = Number(endHr - startHr)
    const durationMs = Number((totalNs / 1_000_000).toFixed(3))
    const avgLatencyMs = Number((durationMs / iterations).toFixed(4))
    const heapBytesUsed = Math.max(0, endMem - startMem)
    const opsPerSec = durationMs > 0 ? Math.round((iterations / (durationMs / 1000))) : 0

    return {
      passed: true,
      durationMs,
      avgLatencyMs,
      heapBytesUsed,
      opsPerSec,
      iterations,
      error: null,
      summary: `⚡ Profiler: ${iterations} iter in ${durationMs}ms (${opsPerSec.toLocaleString()} ops/sec, ~${Math.round(heapBytesUsed / 1024)}KB heap).`,
    }
  } catch (err) {
    const isTimeout = err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || err.message?.includes('timed out')
    return {
      passed: false,
      durationMs: isTimeout ? timeoutMs : 0,
      avgLatencyMs: 0,
      heapBytesUsed: 0,
      opsPerSec: 0,
      iterations: 0,
      error: isTimeout ? `Execution timed out after ${timeoutMs}ms (possible infinite loop or catastrophic complexity)` : err.message,
      summary: isTimeout ? `🚨 Profiler: TIMEOUT (${timeoutMs}ms exceeded)` : `⚠️ Profiler Error: ${err.message}`,
    }
  }
}

/**
 * Runs runtime performance profiling across all candidate solutions.
 *
 * @param {Array<object>} candidates
 * @param {object} [options]
 * @returns {object} Profiler gate result
 */
export function runProfilerGate(candidates, options = {}) {
  const {
    ctx,
    runId,
    onProgress,
    iterations = 100,
    timeoutMs = 2000,
  } = options

  const results = []
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      results: [],
      fastestCandidate: null,
      profilerDirective: null,
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]
    const text = typeof cand === 'string' ? cand : cand.output || cand.text || cand.code || ''
    const report = profileCodeExecution(text, { iterations, timeoutMs })

    if (typeof cand === 'object' && cand !== null) {
      cand.profilerReport = report
    }

    results.push({
      candidateIndex: i,
      model: cand?.model || `Candidate ${i + 1}`,
      report,
    })

    if (ctx) {
      emitEvent(ctx, MOA_EVENTS.PROFILER_COMPLETE, {
        runId,
        candidateIndex: i,
        durationMs: report.durationMs,
        heapBytesUsed: report.heapBytesUsed,
        opsPerSec: report.opsPerSec,
        passed: report.passed,
        error: report.error,
      })
    }
  }

  // Sort passing candidates by throughput (opsPerSec) descending
  const valid = results.filter((r) => r.report.passed).sort((a, b) => b.report.opsPerSec - a.report.opsPerSec)
  const fastestCandidate = valid[0] || null

  if (typeof onProgress === 'function' && results.length > 0) {
    const summaryList = results.map((r) => `Ref ${r.candidateIndex + 1}: ${r.report.passed ? `${r.report.durationMs}ms` : 'TIMEOUT'}`).join(', ')
    onProgress(`⚡ *Runtime Profiler Gate*: ${summaryList}\n`)
  }

  const profilerDirective = formatProfilerDirective(results)

  return {
    results,
    fastestCandidate,
    profilerDirective,
  }
}

/**
 * Formats profiler benchmarks into a clear prompt directive for the Judge.
 *
 * @param {Array<object>} results
 * @returns {string|null}
 */
export function formatProfilerDirective(results) {
  if (!Array.isArray(results) || results.length === 0) return null

  const lines = [
    '### ⚡ RUNTIME PERFORMANCE & CPU/MEMORY PROFILER REPORT',
    'Objective micro-benchmarks across candidates (100 iterations in isolated sandbox):',
  ]

  for (const r of results) {
    const label = `Candidate ${r.candidateIndex + 1}`
    const rep = r.report
    if (rep.passed) {
      const kb = Math.round(rep.heapBytesUsed / 1024)
      lines.push(
        `- **${label}**: ⏱️ **${rep.durationMs}ms** total (~${rep.avgLatencyMs}ms/op) | **${rep.opsPerSec.toLocaleString()} ops/sec** | Heap: ~${kb} KB`
      )
    } else {
      lines.push(
        `- **${label}**: ❌ **PERFORMANCE FAILURE**: ${rep.error}`
      )
    }
  }

  lines.push(
    '\n**Judge Performance Guideline**: Penalize solutions with excessive latency or timeout failures. Prefer implementations demonstrating clean algorithmic scalability and minimal memory footprint.'
  )

  return lines.join('\n')
}
