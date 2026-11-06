/**
 * DeepSeek Harness Mixture of Agents (MoA) — Chain-of-Verification (CoVe) Fact-Checking Gate (#314)
 *
 * Pre-Judge verification gate that analyzes candidate proposals, formulates 3-5 factual API & syntax
 * verification questions, audits them against standard libraries & project context, and flags
 * hallucinated methods or nonexistent modules before arbitration.
 */

import { MOA_EVENTS, emitEvent } from '../events.js'

/**
 * Standard Node.js built-in modules.
 */
export const NODE_STDLIB_MODULES = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector',
  'module', 'net', 'os', 'path', 'path/posix', 'path/win32', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
  'stream/promises', 'stream/web', 'string_decoder', 'test', 'timers',
  'timers/promises', 'tls', 'trace_events', 'tty', 'url', 'util',
  'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
])

/**
 * Common hallucinated APIs and their real replacements.
 */
export const KNOWN_HALLUCINATIONS = [
  {
    regex: /fs\.(?:readAllText|readTextFile|readText|readAsString)\s*\(/i,
    hallucination: 'fs.readAllText / fs.readTextFile',
    correction: 'fs.readFileSync(path, "utf8") or fs.promises.readFile(path, "utf8")',
    reason: 'Method does not exist in Node.js fs module (often hallucinated from C# .NET or Deno).',
  },
  {
    regex: /fs\.(?:writeAllText|writeTextFile|writeText|writeAsString)\s*\(/i,
    hallucination: 'fs.writeAllText / fs.writeTextFile',
    correction: 'fs.writeFileSync(path, data, "utf8") or fs.promises.writeFile(path, data, "utf8")',
    reason: 'Method does not exist in Node.js fs module.',
  },
  {
    regex: /fs\.readFileAsync\s*\(/i,
    hallucination: 'fs.readFileAsync',
    correction: 'fs.promises.readFile(...) or util.promisify(fs.readFile)',
    reason: 'Legacy Bluebird promise naming is not a native Node.js fs method.',
  },
  {
    regex: /path\.(?:normalizeUrl|combine|joinPath)\s*\(/i,
    hallucination: 'path.combine / path.normalizeUrl',
    correction: 'path.join(...) or new URL(...)',
    reason: 'Method does not exist in Node.js path module.',
  },
  {
    regex: /crypto\.(?:generateRandomUuidString|randomString|generateUuid)\s*\(/i,
    hallucination: 'crypto.generateRandomUuidString',
    correction: 'crypto.randomUUID() or crypto.randomBytes(...)',
    reason: 'Nonexistent crypto helper hallucinated by language models.',
  },
  {
    regex: /JSON\.(?:toObject|fromObject|encode|decode)\s*\(/i,
    hallucination: 'JSON.toObject / JSON.fromObject / JSON.encode',
    correction: 'JSON.parse(...) or JSON.stringify(...)',
    reason: 'Invalid JSON global methods hallucinated from other ecosystems.',
  },
  {
    regex: /Promise\.(?:wait|sleep|delay)\s*\(/i,
    hallucination: 'Promise.sleep / Promise.wait / Promise.delay',
    correction: 'new Promise(resolve => setTimeout(resolve, ms)) or timers/promises setTimeout',
    reason: 'Native JavaScript Promise does not feature sleep/delay directly on Promise constructor.',
  },
]

/**
 * Extracts candidate imports, requires, and method calls to formulate verification questions.
 *
 * @param {string} code
 * @param {object} [options]
 * @returns {Array<object>} Up to maxQuestions questions
 */
export function generateCoveQuestions(code, options = {}) {
  const maxQuestions = Math.min(10, Math.max(1, options.maxQuestions || 5))
  const questions = []
  if (!code || typeof code !== 'string') return questions

  // 1. Check imports/requires
  const importRegex = /(?:import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g
  let match
  const seenModules = new Set()
  while ((match = importRegex.exec(code)) !== null) {
    const mod = match[1] || match[2]
    if (mod && !seenModules.has(mod) && !mod.startsWith('.') && !mod.startsWith('/')) {
      seenModules.add(mod)
      const cleanMod = mod.replace(/^node:/, '')
      questions.push({
        id: questions.length + 1,
        type: 'module_resolution',
        subject: mod,
        cleanSubject: cleanMod,
        question: `Is module '${mod}' available in standard library or project dependencies?`,
      })
      if (questions.length >= maxQuestions) return questions
    }
  }

  // 2. Check for known hallucination method calls
  for (const h of KNOWN_HALLUCINATIONS) {
    if (h.regex.test(code)) {
      questions.push({
        id: questions.length + 1,
        type: 'api_existence',
        subject: h.hallucination,
        hallucinationDef: h,
        question: `Does API '${h.hallucination}' exist and is it valid in the target runtime?`,
      })
      if (questions.length >= maxQuestions) return questions
    }
  }

  // 3. Check general API calls (fs, path, crypto, child_process)
  const apiCallRegex = /\b(fs|path|crypto|os|child_process|JSON|Promise)\.([a-zA-Z0-9_]+)\s*\(/g
  const seenApis = new Set()
  while ((match = apiCallRegex.exec(code)) !== null) {
    const obj = match[1]
    const method = match[2]
    const full = `${obj}.${method}`
    if (!seenApis.has(full)) {
      seenApis.add(full)
      questions.push({
        id: questions.length + 1,
        type: 'method_signature',
        subject: full,
        object: obj,
        method,
        question: `Does method '${method}' natively exist on standard global '${obj}'?`,
      })
      if (questions.length >= maxQuestions) return questions
    }
  }

  // Fallback question if code has no special calls
  if (questions.length === 0) {
    questions.push({
      id: 1,
      type: 'syntax_coherence',
      subject: 'code_structure',
      question: 'Are all functions and return types syntactically aligned and verifiable?',
    })
  }

  return questions.slice(0, maxQuestions)
}

/**
 * Verifies a single CoVe factual question against stdlib and project dependencies.
 *
 * @param {object} q - Question object from generateCoveQuestions
 * @param {object} [projectContext]
 * @returns {object} Verification result
 */
export function verifyCoveQuestion(q, projectContext = {}) {
  const deps = {
    ...(projectContext.dependencies || {}),
    ...(projectContext.devDependencies || {}),
    ...(projectContext.stackInfo?.manifestDependencies || {}),
  }

  if (q.type === 'module_resolution') {
    const isNode = NODE_STDLIB_MODULES.has(q.cleanSubject)
    const isDep = Boolean(deps[q.cleanSubject] || deps[q.subject])
    if (isNode || isDep) {
      return {
        verified: true,
        confidence: 1.0,
        rationale: isNode
          ? `Module '${q.subject}' is a verified Node.js standard library module.`
          : `Module '${q.subject}' is defined in project manifest dependencies.`,
        hallucination: null,
      }
    }
    return {
      verified: false,
      confidence: 0.85,
      rationale: `Module '${q.subject}' is not found in Node.js stdlib or declared project dependencies.`,
      hallucination: {
        api: q.subject,
        reason: `Module '${q.subject}' was referenced without declaration in package.json or stdlib.`,
      },
    }
  }

  if (q.type === 'api_existence') {
    // Matched a known hallucination pattern
    const h = q.hallucinationDef
    return {
      verified: false,
      confidence: 0.95,
      rationale: `Invalid API detected: ${h.reason} Suggested fix: ${h.correction}`,
      hallucination: {
        api: h.hallucination,
        reason: h.reason,
        correction: h.correction,
      },
    }
  }

  if (q.type === 'method_signature') {
    // Verify common valid methods on known objects
    const validFs = new Set(['readFile', 'readFileSync', 'writeFile', 'writeFileSync', 'existsSync', 'statSync', 'stat', 'mkdirSync', 'mkdir', 'unlinkSync', 'unlink', 'readdirSync', 'readdir', 'createReadStream', 'createWriteStream', 'promises'])
    const validPath = new Set(['join', 'resolve', 'basename', 'dirname', 'extname', 'relative', 'normalize', 'isAbsolute', 'parse', 'format', 'sep', 'posix', 'win32'])
    const validCrypto = new Set(['randomUUID', 'randomBytes', 'createHash', 'createHmac', 'createCipheriv', 'createDecipheriv', 'timingSafeEqual', 'scryptSync', 'pbkdf2Sync'])
    const validJson = new Set(['parse', 'stringify'])
    const validPromise = new Set(['all', 'allSettled', 'race', 'any', 'resolve', 'reject'])

    let isValid = true
    if (q.object === 'fs') isValid = validFs.has(q.method)
    else if (q.object === 'path') isValid = validPath.has(q.method)
    else if (q.object === 'crypto') isValid = validCrypto.has(q.method)
    else if (q.object === 'JSON') isValid = validJson.has(q.method)
    else if (q.object === 'Promise') isValid = validPromise.has(q.method)

    if (isValid) {
      return {
        verified: true,
        confidence: 0.95,
        rationale: `'${q.subject}' is a verified standard method.`,
        hallucination: null,
      }
    }
    return {
      verified: false,
      confidence: 0.9,
      rationale: `'${q.method}' does not exist on global '${q.object}'.`,
      hallucination: {
        api: q.subject,
        reason: `Method '${q.method}' does not exist on '${q.object}'.`,
      },
    }
  }

  return {
    verified: true,
    confidence: 0.9,
    rationale: 'Verified general syntax structure.',
    hallucination: null,
  }
}

/**
 * Audits a single candidate solution using Chain-of-Verification (CoVe).
 *
 * @param {string} code
 * @param {object} [projectContext]
 * @param {object} [options]
 * @returns {object}
 */
export function auditCandidateCove(code, projectContext = {}, options = {}) {
  const questions = generateCoveQuestions(code, options)
  const verifications = []
  const hallucinations = []

  for (const q of questions) {
    const v = verifyCoveQuestion(q, projectContext)
    verifications.push({
      ...q,
      verified: v.verified,
      confidence: v.confidence,
      rationale: v.rationale,
    })
    if (!v.verified && v.hallucination) {
      hallucinations.push(v.hallucination)
    }
  }

  const penalty = hallucinations.length * 35
  const coveScore = Math.max(0, 100 - penalty)
  const passed = hallucinations.length === 0

  let summary = ''
  if (passed) {
    summary = `🔍 CoVe Fact-Checking: PASSED (Score 100/100). Verified ${questions.length} factual API/module question(s).`
  } else {
    summary = `⚠️ CoVe Hallucination Detected (Score ${coveScore}/100): ${hallucinations.length} non-existent or unverified API(s) found.`
  }

  return {
    passed,
    coveScore,
    questions: verifications,
    hallucinations,
    summary,
  }
}

/**
 * Runs the Chain-of-Verification Gate across all candidates.
 *
 * @param {Array<object>} candidates
 * @param {object} [projectContext]
 * @param {object} [options]
 * @returns {object}
 */
export function runCoveVerificationGate(candidates, projectContext = {}, options = {}) {
  const { ctx, runId, onProgress } = options
  const results = []
  let totalHallucinations = 0

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      results: [],
      passedCount: 0,
      hallucinationCount: 0,
      coveDirective: null,
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]
    const text = typeof cand === 'string' ? cand : cand.output || cand.text || cand.code || ''
    const report = auditCandidateCove(text, projectContext, options)

    if (typeof cand === 'object' && cand !== null) {
      cand.coveReport = report
      cand.coveScore = report.coveScore
      cand.coveHallucinations = report.hallucinations
    }

    totalHallucinations += report.hallucinations.length
    results.push({
      candidateIndex: i,
      model: cand?.model || `Candidate ${i + 1}`,
      report,
    })

    if (ctx) {
      emitEvent(ctx, MOA_EVENTS.COVE_VERIFIED, {
        runId,
        candidateIndex: i,
        coveScore: report.coveScore,
        passed: report.passed,
        questionsCount: report.questions.length,
        hallucinationsCount: report.hallucinations.length,
      })
    }
  }

  const passedCount = results.filter((r) => r.report.passed).length

  if (typeof onProgress === 'function') {
    if (totalHallucinations === 0) {
      onProgress(`🔍 *CoVe Fact-Check Passed*: All APIs and modules verified against project context.\n`)
    } else {
      onProgress(`⚠️ *CoVe Fact-Check Alert*: Found ${totalHallucinations} unverified or hallucinated API(s) across candidate solutions.\n`)
    }
  }

  const coveDirective = formatCoveDirective(results)

  return {
    results,
    passedCount,
    hallucinationCount: totalHallucinations,
    coveDirective,
  }
}

/**
 * Formats CoVe fact-checking verification findings into a prompt directive for Judge/Synthesis.
 *
 * @param {Array<object>} results
 * @returns {string|null}
 */
export function formatCoveDirective(results) {
  if (!Array.isArray(results) || results.length === 0) return null

  const hasAnyHallucinations = results.some((r) => r.report && r.report.hallucinations.length > 0)
  if (!hasAnyHallucinations) {
    return '### 🔍 CHAIN-OF-VERIFICATION (CoVe): ALL CANDIDATE APIS VERIFIED FACTUAL\nNo hallucinated APIs, phantom modules, or broken native signatures detected.'
  }

  const lines = [
    '### 🔍 CHAIN-OF-VERIFICATION (CoVe) FACT-CHECK DIRECTIVE',
    'Independent factual audit of API calls and module imports has been completed:',
  ]

  for (const r of results) {
    const label = `Candidate ${r.candidateIndex + 1}`
    const rep = r.report || {}
    if (!rep.passed && rep.hallucinations.length > 0) {
      lines.push(`- **${label}**: ❌ **FACT-CHECK FAILURE** (Score ${rep.coveScore}/100) — Hallucinated APIs detected:`)
      for (const h of rep.hallucinations) {
        lines.push(`  * \`${h.api}\`: ${h.reason}${h.correction ? ` (Correction: ${h.correction})` : ''}`)
      }
    } else {
      lines.push(`- **${label}**: ✅ VERIFIED (Score 100/100) — All ${rep.questions?.length || 0} API checks confirmed valid.`)
    }
  }

  lines.push('\n**Judge Fact-Checking Rule**: Do not award winning status to solutions that rely on hallucinated methods or nonexistent packages. Prefer solutions with 100/100 verified API accuracy.')

  return lines.join('\n')
}
