import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateCoveQuestions,
  verifyCoveQuestion,
  auditCandidateCove,
  runCoveVerificationGate,
  formatCoveDirective,
  NODE_STDLIB_MODULES,
} from '../lib/pipeline/cove-verifier.js'
import { MOA_EVENTS } from '../lib/events.js'

test('generateCoveQuestions: extracts import modules and method calls', () => {
  const code = `
    import fs from 'node:fs';
    import { join } from 'path';
    const text = fs.readAllText('file.txt');
    const u = crypto.generateRandomUuidString();
  `

  const questions = generateCoveQuestions(code, { maxQuestions: 5 })
  assert.ok(questions.length >= 2)
  assert.ok(questions.some((q) => q.subject.includes('readAllText')))
  assert.ok(questions.some((q) => q.subject.includes('generateRandomUuidString')))
})

test('verifyCoveQuestion: confirms valid stdlib modules and flags hallucinated methods', () => {
  const stdlibQ = {
    type: 'module_resolution',
    subject: 'node:fs',
    cleanSubject: 'fs',
  }
  const v1 = verifyCoveQuestion(stdlibQ)
  assert.equal(v1.verified, true)
  assert.equal(v1.hallucination, null)

  const hallucinatedQ = {
    type: 'api_existence',
    subject: 'fs.readAllText',
    hallucinationDef: {
      hallucination: 'fs.readAllText',
      correction: 'fs.readFileSync',
      reason: 'Method does not exist in Node.js fs module.',
    },
  }
  const v2 = verifyCoveQuestion(hallucinatedQ)
  assert.equal(v2.verified, false)
  assert.ok(v2.hallucination)
  assert.equal(v2.hallucination.api, 'fs.readAllText')
})

test('verifyCoveQuestion: checks project dependencies from context', () => {
  const undeclaredQ = {
    type: 'module_resolution',
    subject: 'super-fake-framework-xyz',
    cleanSubject: 'super-fake-framework-xyz',
  }
  const vFail = verifyCoveQuestion(undeclaredQ, { dependencies: { lodash: '^4.0.0' } })
  assert.equal(vFail.verified, false)
  assert.ok(vFail.hallucination)

  const declaredQ = {
    type: 'module_resolution',
    subject: 'lodash',
    cleanSubject: 'lodash',
  }
  const vPass = verifyCoveQuestion(declaredQ, { dependencies: { lodash: '^4.0.0' } })
  assert.equal(vPass.verified, true)
  assert.equal(vPass.hallucination, null)
})

test('auditCandidateCove: detects hallucinations and computes coveScore', () => {
  const badCode = `
    import fs from 'fs';
    const content = fs.readAllText('doc.txt');
    const uuid = crypto.generateRandomUuidString();
    const data = JSON.toObject(content);
  `

  const report = auditCandidateCove(badCode)
  assert.equal(report.passed, false)
  assert.ok(report.coveScore < 60)
  assert.ok(report.hallucinations.length >= 2)
  assert.match(report.summary, /Hallucination Detected/)
})

test('runCoveVerificationGate: audits candidates and dispatches MOA_EVENTS.COVE_VERIFIED', () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const candidates = [
    {
      model: 'deepseek-v3',
      output: `import fs from 'node:fs'; export function read() { return fs.readFileSync('a.txt', 'utf8'); }`,
    },
    {
      model: 'hallucinating-model',
      output: `import fs from 'fs'; export function read() { return fs.readAllText('a.txt'); }`,
    },
  ]

  const res = runCoveVerificationGate(candidates, {}, {
    ctx: mockCtx,
    runId: 'cove-run-1',
  })

  assert.equal(res.passedCount, 1)
  assert.ok(res.hallucinationCount >= 1)

  assert.equal(candidates[0].coveReport.passed, true)
  assert.equal(candidates[1].coveReport.passed, false)

  assert.equal(emitted.length, 2)
  assert.equal(emitted[0].ev, MOA_EVENTS.COVE_VERIFIED)
  assert.equal(emitted[0].p.passed, true)
  assert.equal(emitted[1].ev, MOA_EVENTS.COVE_VERIFIED)
  assert.equal(emitted[1].p.passed, false)

  assert.ok(res.coveDirective.includes('CHAIN-OF-VERIFICATION (CoVe) FACT-CHECK DIRECTIVE'))
  assert.ok(res.coveDirective.includes('Candidate 2**: ❌ **FACT-CHECK FAILURE**'))
  assert.ok(res.coveDirective.includes('fs.readAllText'))
})
