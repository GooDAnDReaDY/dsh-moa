/**
 * DeepSeek Harness Mixture of Agents (MoA) — Adversarial Security Fuzzing Gate (#302)
 *
 * White-Hat Red Team security gate that audits candidate code proposals for critical
 * vulnerabilities, injection vectors, memory exhaustion, prototype pollution, and CWE patterns
 * before final Judge arbitration.
 */

import { MOA_EVENTS, emitEvent } from '../events.js'

/**
 * Known vulnerability rule signatures with CWE classifications.
 */
export const SECURITY_RULES = [
  {
    cwe: 'CWE-89',
    title: 'SQL Injection Risk',
    severity: 'critical',
    regex: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\s+[^;`'"]*?(\$\{[^}]+\}|['"`]\s*\+\s*[a-zA-Z0-9_]+)/i,
    detail: 'Unsanitized query construction using string interpolation or concatenation instead of parameterized bindings.',
  },
  {
    cwe: 'CWE-78',
    title: 'OS Command Injection',
    severity: 'critical',
    regex: /(?:child_process\.)?(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{[^}]+\}[^`]*`|['"][^'"]*['"]\s*\+)/i,
    detail: 'Executing shell commands with interpolated or concatenated untrusted input.',
  },
  {
    cwe: 'CWE-78',
    title: 'Shell Invocation with Dynamic Arguments',
    severity: 'critical',
    regex: /spawn\s*\([^,]+,\s*\{[^}]*shell\s*:\s*true/i,
    detail: 'Invoking child_process.spawn with shell: true exposes process to command injection.',
  },
  {
    cwe: 'CWE-22',
    title: 'Path Traversal Vulnerability',
    severity: 'high',
    regex: /(?:readFile|writeFile|createReadStream|createWriteStream|unlink|stat)\s*\([^)]*?(?:\.\.\/|\.\.\\)/i,
    detail: 'File system operation contains unconstrained relative path traversal sequences (../).',
  },
  {
    cwe: 'CWE-79',
    title: 'Cross-Site Scripting (DOM XSS)',
    severity: 'high',
    regex: /(?:\.innerHTML\s*=|document\.write\s*\(|dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!DOMPurify|sanitize))/i,
    detail: 'Unescaped HTML or DOM insertion allows arbitrary script execution in browser contexts.',
  },
  {
    cwe: 'CWE-1321',
    title: 'Prototype Pollution',
    severity: 'critical',
    regex: /(?:__proto__|constructor\s*\[\s*['"`]prototype['"`]\s*\]|prototype\s*\[\s*['"`]\w+['"`]\s*\]\s*=)/i,
    detail: 'Direct modification of object prototype chain may lead to remote code execution or privilege escalation.',
  },
  {
    cwe: 'CWE-400',
    title: 'Regular Expression Denial of Service (ReDoS)',
    severity: 'high',
    regex: /\/(?:[^\/\\]|\\.)*(?:\([^\)]*[\+\*]\)[^\)]*[\+\*]|\([^\)]*\|[^\)]*\)[\+\*])(?:[^\/\\]|\\.)*\//,
    detail: 'Regular expression pattern contains nested quantifiers with catastrophic polynomial/exponential backtracking.',
  },
  {
    cwe: 'CWE-798',
    title: 'Hardcoded Cryptographic Secret / Credential',
    severity: 'high',
    regex: /(?:api_?key|auth_?token|secret_?key|private_?key|bearer_?token)\s*[:=]\s*['"`](?:sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,}|ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})['"`]/i,
    detail: 'Production-like API token, private key, or credential embedded directly in source code.',
  },
  {
    cwe: 'CWE-362',
    title: 'TOCTOU Concurrency Race Condition',
    severity: 'medium',
    regex: /fs\.existsSync\s*\([^)]+\)[\s\S]{1,80}?fs\.(?:writeFileSync|appendFileSync)\s*\(/i,
    detail: 'Non-atomic check-then-act pattern creates file race condition under concurrent operations.',
  },
]

/**
 * Audits a code snippet or model response for security vulnerabilities.
 *
 * @param {string} code - Candidate response text or extracted code
 * @param {object} [options]
 * @returns {object} Audit report with score, findings, and veto flag
 */
export function auditCodeSecurity(code, options = {}) {
  if (!code || typeof code !== 'string') {
    return {
      veto: false,
      score: 100,
      findings: [],
      summary: 'Clean: No executable code provided for security audit.',
    }
  }

  const findings = []
  const lines = code.split('\n')

  for (const rule of SECURITY_RULES) {
    if (rule.regex.test(code)) {
      // Pinpoint line number if possible
      let matchedLine = null
      let matchedSnippet = ''
      for (let i = 0; i < lines.length; i++) {
        if (rule.regex.test(lines[i])) {
          matchedLine = i + 1
          matchedSnippet = lines[i].trim().slice(0, 120)
          break
        }
      }

      findings.push({
        cwe: rule.cwe,
        title: rule.title,
        severity: rule.severity,
        detail: rule.detail,
        line: matchedLine,
        snippet: matchedSnippet || null,
      })
    }
  }

  let penalty = 0
  let hasCriticalOrHigh = false
  for (const f of findings) {
    if (f.severity === 'critical') {
      penalty += 45
      hasCriticalOrHigh = true
    } else if (f.severity === 'high') {
      penalty += 25
      hasCriticalOrHigh = true
    } else if (f.severity === 'medium') {
      penalty += 15
    } else {
      penalty += 5
    }
  }

  const score = Math.max(0, Math.min(100, 100 - penalty))
  const strictVeto = options.strictVeto !== false
  const veto = strictVeto ? hasCriticalOrHigh || score < 60 : score < 40

  let summary = ''
  if (findings.length === 0) {
    summary = '🛡️ Red Team Security Audit: PASSED (Score 100/100). No known CWE vulnerabilities detected.'
  } else if (veto) {
    summary = `⛔ SECURITY_VETO (Score ${score}/100): Found ${findings.length} security violation(s) (${findings.map((f) => f.cwe).join(', ')}).`
  } else {
    summary = `⚠️ Security Warning (Score ${score}/100): ${findings.length} minor/medium issue(s) identified.`
  }

  return {
    veto,
    score,
    findings,
    summary,
  }
}

/**
 * Executes the Adversarial Security Fuzzing Gate across all candidate outputs.
 *
 * @param {Array<object>} candidates - List of candidate references with output/text
 * @param {object} [options]
 * @returns {object} Gate execution results with directive and veto counters
 */
export function runSecurityAuditGate(candidates, options = {}) {
  const { ctx, runId, onProgress, strictVeto = true } = options
  const results = []
  let vetoCount = 0

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      results: [],
      vetoCount: 0,
      cleanCount: 0,
      allPassed: true,
      securityDirective: null,
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]
    const text = typeof cand === 'string' ? cand : cand.output || cand.text || cand.code || ''
    const audit = auditCodeSecurity(text, { strictVeto })

    if (typeof cand === 'object' && cand !== null) {
      cand.securityAudit = audit
      cand.securityVeto = audit.veto
    }

    if (audit.veto) {
      vetoCount++
    }

    results.push({
      candidateIndex: i,
      model: cand?.model || `Candidate ${i + 1}`,
      audit,
      veto: audit.veto,
    })

    if (ctx) {
      emitEvent(ctx, MOA_EVENTS.SECURITY_AUDIT, {
        runId,
        candidateIndex: i,
        score: audit.score,
        veto: audit.veto,
        findingsCount: audit.findings.length,
        cwes: audit.findings.map((f) => f.cwe),
      })
    }
  }

  const cleanCount = candidates.length - vetoCount
  const allPassed = vetoCount === 0

  if (typeof onProgress === 'function') {
    if (allPassed) {
      onProgress(`🛡️ *Security Gate Passed*: All ${candidates.length} candidate solutions cleared Red Team audit.\n`)
    } else {
      onProgress(
        `🚨 *Security Gate Alert*: ${vetoCount}/${candidates.length} candidates triggered SECURITY_VETO (${results
          .filter((r) => r.veto)
          .map((r) => `Ref ${r.candidateIndex + 1}`)
          .join(', ')}).\n`
      )
    }
  }

  const securityDirective = formatSecurityAuditDirective(results, { strictVeto })

  return {
    results,
    vetoCount,
    cleanCount,
    allPassed,
    securityDirective,
  }
}

/**
 * Formats Red Team audit findings into a high-priority prompt directive for Stage 6/7.
 *
 * @param {Array<object>} results
 * @param {object} [options]
 * @returns {string|null} Directive text
 */
export function formatSecurityAuditDirective(results, options = {}) {
  if (!Array.isArray(results) || results.length === 0) return null

  const hasAnyFindings = results.some((r) => r.audit && r.audit.findings.length > 0)
  if (!hasAnyFindings) {
    return '### 🛡️ RED TEAM SECURITY AUDIT: ALL CANDIDATES VERIFIED SECURE\nNo injection, XSS, ReDoS, path traversal, or credential exposure detected.'
  }

  const lines = [
    '### 🛡️ ADVERSARIAL RED TEAM SECURITY AUDIT DIRECTIVE',
    'Strict security evaluation of candidate proposals has been completed:',
  ]

  for (const r of results) {
    const label = `Candidate ${r.candidateIndex + 1}`
    const a = r.audit || {}
    if (a.veto) {
      lines.push(
        `- **${label}**: ⛔ **SECURITY_VETO** (Score ${a.score}/100) — DO NOT adopt this solution without removing critical flaws:`
      )
      for (const f of a.findings || []) {
        lines.push(
          `  * [${f.cwe}] ${f.title} (${f.severity.toUpperCase()}): ${f.detail}${f.line ? ` (at line ${f.line})` : ''}`
        )
      }
    } else if (a.findings && a.findings.length > 0) {
      lines.push(`- **${label}**: ⚠️ Warning (Score ${a.score}/100):`)
      for (const f of a.findings) {
        lines.push(`  * [${f.cwe}] ${f.title}: ${f.detail}`)
      }
    } else {
      lines.push(`- **${label}**: ✅ PASSED (Score 100/100) — Free of detectable vulnerabilities.`)
    }
  }

  lines.push(
    '\n**Judge Mandate**: Solutions marked with SECURITY_VETO must be heavily penalized or rejected. The final synthesized code MUST NOT contain any of the flagged CWE patterns.'
  )

  return lines.join('\n')
}
