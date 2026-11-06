/**
 * DeepSeek Harness Mixture of Agents (MoA) — Mutation Testing Gate for Candidate Tests (#316)
 *
 * Injects deterministic AST-level fault mutations into candidate implementations and evaluates
 * candidate test suites against mutants to calculate Mutation Score (killed vs survived mutants),
 * eliminating false-positive and tautological tests before Judge arbitration.
 */

import vm from 'node:vm'
import { MOA_EVENTS, emitEvent } from '../events.js'
import { extractExecutableCode } from './runtime-profiler.js'

/**
 * Mutation operator patterns.
 */
export const MUTATION_OPERATORS = [
  {
    name: 'invert_strict_equality',
    regex: /===/g,
    replacement: '!==',
    description: 'Replaced strict equality (===) with inequality (!==)',
  },
  {
    name: 'invert_relational_lt',
    regex: /<(?!=)/g,
    replacement: '>=',
    description: 'Replaced less-than (<) with greater-or-equal (>=)',
  },
  {
    name: 'invert_relational_gt',
    regex: />(?!=)/g,
    replacement: '<=',
    description: 'Replaced greater-than (>) with less-or-equal (<=)',
  },
  {
    name: 'invert_logical_and',
    regex: /&&/g,
    replacement: '||',
    description: 'Replaced logical AND (&&) with logical OR (||)',
  },
  {
    name: 'invert_arithmetic_plus',
    regex: /(?<=\w\s*)\+(?=\s*\w)/g,
    replacement: '-',
    description: 'Replaced addition (+) with subtraction (-)',
  },
  {
    name: 'invert_boolean_true',
    regex: /\btrue\b/g,
    replacement: 'false',
    description: 'Replaced literal true with false',
  },
  {
    name: 'mutate_return_zero',
    regex: /return\s+0;/g,
    replacement: 'return 1;',
    description: 'Mutated return 0 to return 1',
  },
]

/**
 * Generates an array of mutant variations from a single source code string.
 *
 * @param {string} sourceCode
 * @param {object} [options]
 * @returns {Array<object>} Up to maxMutants mutant objects
 */
export function generateMutants(sourceCode, options = {}) {
  const maxMutants = Math.min(10, Math.max(1, options.maxMutants || 5))
  const mutants = []
  if (!sourceCode || typeof sourceCode !== 'string') return mutants

  for (const op of MUTATION_OPERATORS) {
    let match
    const re = new RegExp(op.regex.source, op.regex.flags)
    while ((match = re.exec(sourceCode)) !== null) {
      const idx = match.index
      const len = match[0].length
      const mutantCode = sourceCode.slice(0, idx) + op.replacement + sourceCode.slice(idx + len)

      mutants.push({
        id: mutants.length + 1,
        operator: op.name,
        description: op.description,
        originalSnippet: match[0],
        replacementSnippet: op.replacement,
        mutantCode,
      })

      if (mutants.length >= maxMutants) return mutants
    }
  }

  return mutants
}

/**
 * Runs a test script against an implementation in an isolated VM context.
 *
 * @param {string} codeToExecute
 * @param {number} [timeoutMs=1000]
 * @returns {{ ok: boolean, error: string | null }}
 */
function executeScript(codeToExecute, timeoutMs = 1000) {
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    assert: (cond, msg) => { if (!cond) throw new Error(msg || 'Assertion failed'); },
    Math, Date, Array, Object, String, Number, Boolean, Set, Map, JSON,
  }
  sandbox.assert.equal = (a, b) => { if (a !== b) throw new Error(`Assertion failed: ${a} !== ${b}`); }
  sandbox.assert.strictEqual = (a, b) => { if (a !== b) throw new Error(`Assertion failed: ${a} !== ${b}`); }
  sandbox.assert.ok = (v) => { if (!v) throw new Error('Assertion failed: falsy value'); }

  try {
    const context = vm.createContext(sandbox)
    const script = new vm.Script(codeToExecute)
    script.runInContext(context, { timeout: timeoutMs })
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * Evaluates a candidate's implementation against generated mutants.
 *
 * @param {string} rawText - Candidate text containing code or tests
 * @param {object} [options]
 * @returns {object} Mutation testing report
 */
export function auditCandidateMutations(rawText, options = {}) {
  const { minMutationScore = 0.7, maxMutants = 5, timeoutMs = 1000 } = options
  const code = extractExecutableCode(rawText)

  if (!code || !code.trim()) {
    return {
      passed: true,
      mutationScore: 100,
      totalMutants: 0,
      killedCount: 0,
      survivedCount: 0,
      mutants: [],
      summary: 'Mutation Testing: No code to mutate.',
    }
  }

  // 1. Verify baseline executes cleanly
  const baseline = executeScript(code, timeoutMs)
  if (!baseline.ok) {
    return {
      passed: false,
      mutationScore: 0,
      totalMutants: 0,
      killedCount: 0,
      survivedCount: 0,
      mutants: [],
      error: `Baseline test execution failed: ${baseline.error}`,
      summary: `Baseline execution failed (${baseline.error}).`,
    }
  }

  // 2. Generate mutations on the code
  const mutants = generateMutants(code, { maxMutants })
  if (mutants.length === 0) {
    return {
      passed: true,
      mutationScore: 100,
      totalMutants: 0,
      killedCount: 0,
      survivedCount: 0,
      mutants: [],
      summary: 'Mutation Testing: Code contains no mutable operators.',
    }
  }

  // 3. Test each mutant
  let killedCount = 0
  let survivedCount = 0
  const evaluatedMutants = []

  for (const m of mutants) {
    const res = executeScript(m.mutantCode, timeoutMs)
    if (!res.ok) {
      // Mutant was killed (good! The test broke as expected)
      killedCount++
      evaluatedMutants.push({
        ...m,
        status: 'KILLED',
        reason: res.error,
      })
    } else {
      // Mutant survived (bad! Code was broken but test passed anyway)
      survivedCount++
      evaluatedMutants.push({
        ...m,
        status: 'SURVIVED',
        reason: 'Test suite passed despite injected fault.',
      })
    }
  }

  const mutationRatio = Number((killedCount / mutants.length).toFixed(2))
  const mutationScore = Math.round(mutationRatio * 100)
  const passed = mutationRatio >= minMutationScore

  const summary = passed
    ? `🧬 Mutation Testing: PASSED (Score ${mutationScore}%). Killed ${killedCount}/${mutants.length} mutant(s).`
    : `⚠️ Mutation Testing: WEAK TESTS (Score ${mutationScore}% < ${Math.round(minMutationScore * 100)}%). ${survivedCount} mutant(s) survived undetected.`

  return {
    passed,
    mutationScore,
    mutationRatio,
    totalMutants: mutants.length,
    killedCount,
    survivedCount,
    mutants: evaluatedMutants,
    summary,
  }
}

/**
 * Runs the Mutation Testing Gate across all candidate solutions.
 *
 * @param {Array<object>} candidates
 * @param {object} [options]
 * @returns {object} Mutation gate report
 */
export function runMutationGate(candidates, options = {}) {
  const { ctx, runId, onProgress, minMutationScore = 0.70 } = options
  const results = []

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      results: [],
      passedCount: 0,
      mutationDirective: null,
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]
    const text = typeof cand === 'string' ? cand : cand.output || cand.text || cand.code || ''
    const report = auditCandidateMutations(text, { minMutationScore, ...options })

    if (typeof cand === 'object' && cand !== null) {
      cand.mutationReport = report
      cand.mutationScore = report.mutationScore
    }

    results.push({
      candidateIndex: i,
      model: cand?.model || `Candidate ${i + 1}`,
      report,
    })

    if (ctx) {
      emitEvent(ctx, MOA_EVENTS.MUTATION_COMPLETE, {
        runId,
        candidateIndex: i,
        mutationScore: report.mutationScore,
        killedCount: report.killedCount,
        totalMutants: report.totalMutants,
        passed: report.passed,
      })
    }
  }

  const passedCount = results.filter((r) => r.report.passed).length

  if (typeof onProgress === 'function' && results.length > 0) {
    const summaryList = results.map((r) => `Ref ${r.candidateIndex + 1}: ${r.report.mutationScore}%`).join(', ')
    onProgress(`🧬 *Mutation Testing Gate*: ${summaryList}\n`)
  }

  const mutationDirective = formatMutationDirective(results)

  return {
    results,
    passedCount,
    mutationDirective,
  }
}

/**
 * Formats mutation testing results into a prompt directive for the Judge.
 *
 * @param {Array<object>} results
 * @returns {string|null}
 */
export function formatMutationDirective(results) {
  if (!Array.isArray(results) || results.length === 0) return null

  const lines = [
    '### 🧬 RUNTIME MUTATION TESTING & FAULT INJECTION REPORT',
    'Evaluation of test robustness against synthetic fault injection (killing code mutants):',
  ]

  for (const r of results) {
    const label = `Candidate ${r.candidateIndex + 1}`
    const rep = r.report
    if (rep.totalMutants === 0) {
      lines.push(`- **${label}**: ℹ️ No mutable operators found in test suite.`)
    } else if (rep.passed) {
      lines.push(
        `- **${label}**: ✅ **RESILIENT TESTS** (Score ${rep.mutationScore}%) — Killed ${rep.killedCount}/${rep.totalMutants} fault mutants.`
      )
    } else {
      lines.push(
        `- **${label}**: ⚠️ **WEAK/TAUTOLOGICAL TESTS** (Score ${rep.mutationScore}%) — ${rep.survivedCount}/${rep.totalMutants} mutant(s) survived! The tests pass even when logic is inverted.`
      )
      for (const m of (rep.mutants || []).filter((m) => m.status === 'SURVIVED')) {
        lines.push(`  * ${m.description} [Survived]`)
      }
    }
  }

  lines.push(
    '\n**Judge Quality Mandate**: Prefer solutions whose test suites have a high Mutation Score. Solutions with surviving mutants have weak or tautological tests that do not genuinely verify behavior.'
  )

  return lines.join('\n')
}
