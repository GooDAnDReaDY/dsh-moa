import test from 'node:test'
import assert from 'node:assert/strict'
import {
  auditCodeSecurity,
  runSecurityAuditGate,
  formatSecurityAuditDirective,
  SECURITY_RULES,
} from '../lib/pipeline/security-fuzzer.js'
import { MOA_EVENTS } from '../lib/events.js'

test('auditCodeSecurity: approves clean, secure code with 100/100 score', () => {
  const cleanCode = `
    import fs from 'node:fs/promises';
    import path from 'node:path';

    export async function loadUserData(userId, baseDir) {
      const safeId = path.basename(userId);
      const target = path.join(baseDir, safeId);
      const data = await fs.readFile(target, 'utf8');
      return JSON.parse(data);
    }
  `

  const audit = auditCodeSecurity(cleanCode)
  assert.equal(audit.veto, false)
  assert.equal(audit.score, 100)
  assert.equal(audit.findings.length, 0)
  assert.match(audit.summary, /PASSED/)
})

test('auditCodeSecurity: detects SQL Injection (CWE-89) and flags SECURITY_VETO', () => {
  const vulnCode = `
    async function getUser(id, db) {
      return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
    }
  `

  const audit = auditCodeSecurity(vulnCode)
  assert.equal(audit.veto, true)
  assert.ok(audit.score < 60)
  assert.ok(audit.findings.some((f) => f.cwe === 'CWE-89'))
  assert.match(audit.summary, /SECURITY_VETO/)
})

test('auditCodeSecurity: detects OS Command Injection (CWE-78)', () => {
  const vulnCode = `
    import { exec } from 'node:child_process';
    export function runUserScript(scriptName) {
      exec(\`bash \${scriptName}\`);
    }
  `

  const audit = auditCodeSecurity(vulnCode)
  assert.equal(audit.veto, true)
  assert.ok(audit.findings.some((f) => f.cwe === 'CWE-78'))
})

test('auditCodeSecurity: detects Path Traversal (CWE-22) and DOM XSS (CWE-79)', () => {
  const vulnCode = `
    fs.readFile('../../etc/passwd', 'utf8', (err, data) => {
      document.getElementById('out').innerHTML = data;
    });
  `

  const audit = auditCodeSecurity(vulnCode)
  assert.equal(audit.veto, true)
  assert.ok(audit.findings.some((f) => f.cwe === 'CWE-22'))
  assert.ok(audit.findings.some((f) => f.cwe === 'CWE-79'))
})

test('auditCodeSecurity: detects Prototype Pollution and ReDoS patterns', () => {
  const vulnCode = `
    function merge(target, src) {
      target.__proto__ = src;
      const re = /(a+)+$/;
      return re.test('aaaa');
    }
  `

  const audit = auditCodeSecurity(vulnCode)
  assert.equal(audit.veto, true)
  assert.ok(audit.findings.some((f) => f.cwe === 'CWE-1321'))
  assert.ok(audit.findings.some((f) => f.cwe === 'CWE-400'))
})

test('runSecurityAuditGate: executes audit across candidate array and emits event', () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const candidates = [
    {
      model: 'gpt-4o',
      output: `export function add(a, b) { return a + b; }`,
    },
    {
      model: 'claude-3-5',
      output: `export function query(id) { return db.query(\`DELETE FROM items WHERE id = \${id}\`); }`,
    },
  ]

  const progressMessages = []
  const res = runSecurityAuditGate(candidates, {
    ctx: mockCtx,
    runId: 'sec-test-run',
    onProgress: (m) => progressMessages.push(m),
  })

  assert.equal(res.allPassed, false)
  assert.equal(res.vetoCount, 1)
  assert.equal(res.cleanCount, 1)

  // Candidate 1 passed, candidate 2 vetoed
  assert.equal(candidates[0].securityVeto, false)
  assert.equal(candidates[1].securityVeto, true)

  // Verify Cordis event
  assert.equal(emitted.length, 2)
  assert.equal(emitted[0].ev, MOA_EVENTS.SECURITY_AUDIT)
  assert.equal(emitted[0].p.veto, false)
  assert.equal(emitted[1].ev, MOA_EVENTS.SECURITY_AUDIT)
  assert.equal(emitted[1].p.veto, true)

  // Verify directive text
  assert.ok(res.securityDirective.includes('ADVERSARIAL RED TEAM SECURITY AUDIT DIRECTIVE'))
  assert.ok(res.securityDirective.includes('Candidate 2**: ⛔ **SECURITY_VETO**'))
  assert.ok(res.securityDirective.includes('CWE-89'))
})
