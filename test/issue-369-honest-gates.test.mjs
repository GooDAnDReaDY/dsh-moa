import test from 'node:test'
import assert from 'node:assert/strict'
import { generateMutants, buildMutableCodeMask, auditCandidateMutations } from '../lib/pipeline/mutation-tester.js'
import { profileCodeExecution, collectDeclaredFunctionNames, runProfilerGate } from '../lib/pipeline/runtime-profiler.js'
import { runSecurityAuditGate } from '../lib/pipeline/security-fuzzer.js'

test('Issue #369: mutation operators never touch string literals', () => {
  const code = 'const label = "true story";\nconst flag = true;\nconst cmp = a === b;\n'
  const mutants = generateMutants(code, { maxMutants: 10 })
  // "true story" inside the string must stay intact in every mutant
  for (const m of mutants) {
    assert.ok(m.mutantCode.includes('"true story"'), `string literal mutated: ${m.operator}`)
    assert.doesNotMatch(m.mutantCode, /"false story"|"true history"/)
  }
  // The bare `true` and the === operator are still mutable code
  assert.ok(mutants.some((m) => m.operator === 'invert_boolean_true'), 'bare true literal must still be mutated')
  assert.ok(mutants.some((m) => m.operator === 'invert_strict_equality'), '=== operator must still be mutated')
})

test('Issue #369: mutation operators never touch template literals or comments', () => {
  const code = [
    '// true story comment',
    '/* flag === true in comment */',
    'const t = `a ${x} true branch`;',
    'const ok = true;',
  ].join('\n')
  const mutants = generateMutants(code, { maxMutants: 10 })
  for (const m of mutants) {
    assert.ok(m.mutantCode.includes('`a ${x} true branch`'), 'template literal mutated')
    assert.ok(m.mutantCode.includes('// true story comment'), 'line comment mutated')
    assert.ok(m.mutantCode.includes('/* flag === true in comment */'), 'block comment mutated')
  }
  assert.ok(mutants.some((m) => m.operator === 'invert_boolean_true'), 'code true must still mutate')
})

test('Issue #369: tautological suite still scores 0 while real assertions kill mutants', () => {
  // const s = "true" must not affect scoring: masking keeps mutants semantic
  const tautological = `
    function compute(val) {
      const s = "true story";
      if (val > 10) return true;
      return false;
    }
    assert.ok(true);
  `
  const report = auditCandidateMutations(tautological, { minMutationScore: 0.7 })
  assert.equal(report.passed, false)
  // Mutant slots are not wasted on the string literal; the surviving >= and
  // return-true mutants still expose the tautological assertion.
  assert.ok(report.mutationScore < 70, `score ${report.mutationScore} must fail the 70% gate`)
  assert.ok(report.survivedCount > 0)

  const real = `
    function isEven(n) {
      if (n === 0) return true;
      return n % 2 === 0;
    }
    assert.strictEqual(isEven(4), true);
    assert.strictEqual(isEven(5), false);
    assert.strictEqual(isEven(0), true);
  `
  const report2 = auditCandidateMutations(real, { minMutationScore: 0.5 })
  assert.equal(report2.passed, true)
  assert.ok(report2.killedCount > 0)
})

test('Issue #369: profiler skips ambiguous entrypoints instead of guessing', () => {
  const code = `
    function alphaSort(a, b) { return a - b; }
    function betaScale(n) { return n * 2; }
  `
  const rep = profileCodeExecution(code, { iterations: 10, timeoutMs: 1000 })
  assert.equal(rep.skipped, true)
  assert.equal(rep.passed, true)
  assert.match(rep.summary, /ambiguous entrypoint/)
  assert.match(rep.summary, /alphaSort, betaScale/)
  assert.equal(rep.opsPerSec, 0)
})

test('Issue #369: profiler accepts explicit entrypoint name and canonical names', () => {
  const code = `
    function alphaSort(a, b) { return a - b; }
    function betaScale(n) { return n * 2; }
  `
  const rep = profileCodeExecution(code, { iterations: 5, timeoutMs: 1000, entrypointName: 'betaScale' })
  assert.equal(rep.skipped, undefined)
  assert.equal(rep.passed, true)
  assert.ok(rep.opsPerSec > 0)

  const canonical = 'function solve() { let s = 0; for (let i = 0; i < 5; i++) s += i; return s; }'
  const rep2 = profileCodeExecution(canonical, { iterations: 5, timeoutMs: 1000 })
  assert.equal(rep2.passed, true)
  assert.ok(rep2.opsPerSec > 0)
})

test('Issue #369: profiler still measures single-declaration candidates and export default', () => {
  const single = 'function fibonacci(n = 10) { let a = 0, b = 1; for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; } return b; }'
  const rep = profileCodeExecution(single, { iterations: 10, timeoutMs: 1000 })
  assert.equal(rep.passed, true)
  assert.ok(rep.durationMs >= 0)

  const def = 'export default () => { let s = 0; for (let i = 0; i < 3; i++) s += i; return s; }'
  const rep2 = profileCodeExecution(def, { iterations: 5, timeoutMs: 1000 })
  assert.equal(rep2.passed, true)
  assert.ok(rep2.opsPerSec > 0)
})

test('Issue #369: profiler gate reports skipped candidates honestly', () => {
  const candidates = [
    { model: 'multi-fn', output: 'function a1(x) { return x; }\nfunction b2(x) { return x; }' },
    { model: 'single-fn', output: 'function onlyFn(n) { return n * 3; }' },
  ]
  const res = runProfilerGate(candidates, { iterations: 5, timeoutMs: 1000 })
  assert.equal(res.results[0].report.skipped, true)
  assert.equal(res.fastestCandidate.candidateIndex, 1, 'only the measured candidate competes')
  assert.match(res.profilerDirective, /Profiler skipped/)
})

test('Issue #369: security directive labels the scan as heuristic, not a measurement', () => {
  const candidates = [
    { model: 'c1', output: "const q = `SELECT * FROM users WHERE id = ${req.params.id}`" },
    { model: 'c2', output: 'const safe = (a, b) => a + b' },
  ]
  const res = runSecurityAuditGate(candidates, { runId: 's369' })
  assert.equal(res.results[0].veto, true)
  const directive = res.securityDirective
  assert.match(directive, /static CWE regex rules/)
  assert.match(directive, /NOT confirmed vulnerabilities/)
  assert.match(directive, /review leads, not measurements/)
})

test('Issue #369: clean security scan states the heuristic boundary too', () => {
  const candidates = [{ model: 'clean', output: 'const add = (a, b) => a + b;' }]
  const res = runSecurityAuditGate(candidates, { runId: 's369-clean' })
  assert.match(res.securityDirective, /not a proof of security/)
})

test('Issue #369: collectDeclaredFunctionNames finds declarations and arrow bindings', () => {
  const names = collectDeclaredFunctionNames(`
    function alpha() {}
    export function beta() {}
    const gamma = (x) => x;
    const delta = function () {};
    const notFn = 42;
    const alsoNot = () => 'arrow assigned to string call';
  `)
  assert.deepEqual(names, ['alpha', 'beta', 'gamma', 'delta', 'alsoNot'])
})
