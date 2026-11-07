import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateMutants,
  auditCandidateMutations,
  runMutationGate,
  formatMutationDirective,
} from '../lib/pipeline/mutation-tester.js'
import { MOA_EVENTS } from '../lib/events.js'

test('generateMutants: generates mutant variations by inverting operators', () => {
  const code = `
    function checkAge(age) {
      if (age >= 18 && age < 65) {
        return true;
      }
      return 0;
    }
  `

  const mutants = generateMutants(code, { maxMutants: 5 })
  assert.ok(mutants.length >= 2)
  assert.ok(mutants.some((m) => m.description.includes('logical OR') || m.description.includes('greater-or-equal') || m.description.includes('false')))
})

test('auditCandidateMutations: robust test suite kills mutants and achieves high mutation score', () => {
  const robustCode = `
    function isEven(n) {
      return n % 2 === 0;
    }

    // Unit tests
    assert.strictEqual(isEven(4), true);
    assert.strictEqual(isEven(5), false);
    assert.strictEqual(isEven(0), true);
  `

  const report = auditCandidateMutations(robustCode, { minMutationScore: 0.50, maxMutants: 4 })
  assert.equal(report.passed, true)
  assert.ok(report.mutationScore >= 50)
  assert.ok(report.killedCount > 0)
  assert.match(report.summary, /PASSED/)
})

test('auditCandidateMutations: weak tautological test suite allows mutants to survive', () => {
  const weakCode = `
    function compute(val) {
      if (val === 42) {
        return true;
      }
      return false;
    }

    // Tautological test that always asserts true regardless of compute() output!
    compute(42);
    assert.ok(true);
  `

  const report = auditCandidateMutations(weakCode, { minMutationScore: 0.70, maxMutants: 3 })
  assert.equal(report.passed, false)
  assert.equal(report.mutationScore, 0)
  assert.ok(report.survivedCount > 0)
  assert.match(report.summary, /WEAK TESTS/)
})

test('runMutationGate: evaluates candidates and dispatches MOA_EVENTS.MUTATION_COMPLETE', () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const candidates = [
    {
      model: 'model-good-tests',
      output: `
        function add(a, b) { return a + b; }
        assert.equal(add(1, 2), 3);
        assert.equal(add(0, 0), 0);
      `,
    },
    {
      model: 'model-weak-tests',
      output: `
        function add(a, b) { return a + b; }
        add(1, 2);
        assert.ok(true);
      `,
    },
  ]

  const res = runMutationGate(candidates, {
    ctx: mockCtx,
    runId: 'mut-run-1',
    minMutationScore: 0.50,
  })

  assert.equal(res.results.length, 2)
  assert.ok(candidates[0].mutationReport)
  assert.ok(candidates[1].mutationReport)

  assert.equal(emitted.length, 2)
  assert.equal(emitted[0].ev, MOA_EVENTS.MUTATION_COMPLETE)
  assert.equal(emitted[1].ev, MOA_EVENTS.MUTATION_COMPLETE)

  assert.ok(res.mutationDirective.includes('RUNTIME MUTATION TESTING & FAULT INJECTION REPORT'))
  assert.ok(res.mutationDirective.includes('Candidate 1**: ✅ **RESILIENT TESTS**'))
})
