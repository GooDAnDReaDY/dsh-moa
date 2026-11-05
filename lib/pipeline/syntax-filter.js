/**
 * Zero-Token Local Pre-Judge Linter & Syntax Filter (#303)
 * Inspects candidate proposals locally before LLM judge invocation.
 * Disqualifies or penalizes candidates with fatal syntax errors without spending judge tokens.
 */

import vm from 'node:vm'
import path from 'node:path'

/**
 * Extracts markdown fenced code blocks.
 * @param {string} text
 * @returns {Array<{ language: string, code: string }>}
 */
export function extractCodeBlocks(text = '') {
  if (typeof text !== 'string') return []
  const blocks = []
  const regex = /(?:^|\n)```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)\r?\n```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: (match[1] || '').trim().toLowerCase(),
      code: match[2] || '',
    })
  }
  return blocks
}

/**
 * Checks basic bracket and parenthesis balance.
 * @param {string} code
 * @returns {{ balanced: boolean, error?: string }}
 */
function checkBracketBalance(code = '') {
  const stack = []
  const pairs = { '(': ')', '{': '}', '[': ']' }
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplateLiteral = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    const next = code[i + 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (ch === '/' && next === '/' && !inSingleQuote && !inDoubleQuote && !inTemplateLiteral) {
      inLineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*' && !inSingleQuote && !inDoubleQuote && !inTemplateLiteral) {
      inBlockComment = true
      i++
      continue
    }

    if (ch === "'" && !inDoubleQuote && !inTemplateLiteral && code[i - 1] !== '\\') {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (ch === '"' && !inSingleQuote && !inTemplateLiteral && code[i - 1] !== '\\') {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (ch === '`' && !inSingleQuote && !inDoubleQuote && code[i - 1] !== '\\') {
      inTemplateLiteral = !inTemplateLiteral
      continue
    }

    if (inSingleQuote || inDoubleQuote || inTemplateLiteral) continue

    if (ch === '(' || ch === '{' || ch === '[') {
      stack.push({ ch, pos: i })
    } else if (ch === ')' || ch === '}' || ch === ']') {
      if (stack.length === 0) {
        return { balanced: false, error: `Unmatched closing bracket '${ch}' at index ${i}` }
      }
      const top = stack.pop()
      if (pairs[top.ch] !== ch) {
        return { balanced: false, error: `Mismatched bracket: expected '${pairs[top.ch]}', found '${ch}'` }
      }
    }
  }

  if (stack.length > 0) {
    const top = stack[stack.length - 1]
    return { balanced: false, error: `Unclosed bracket '${top.ch}' opened at index ${top.pos}` }
  }
  return { balanced: true }
}

/**
 * Validates syntax of a single code block.
 * @param {string} code
 * @param {string} language
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateCodeBlockSyntax(code = '', language = '') {
  const lang = (language || '').toLowerCase().trim()
  const trimmed = code.trim()
  if (!trimmed) return { valid: true, error: null }

  // 1. JSON validation
  if (lang === 'json') {
    try {
      JSON.parse(trimmed)
      return { valid: true, error: null }
    } catch (err) {
      return { valid: false, error: `JSON Parse Error: ${err.message}` }
    }
  }

  // 2. JavaScript / TypeScript validation
  if (['js', 'javascript', 'mjs', 'cjs', 'ts', 'typescript', 'jsx', 'tsx'].includes(lang)) {
    // Check bracket balance
    const bracketCheck = checkBracketBalance(trimmed)
    if (!bracketCheck.balanced) {
      return { valid: false, error: bracketCheck.error }
    }

    // Try vm.Script for JS (stripping import/export and TypeScript type annotations)
    try {
      const sanitized = trimmed
        .replace(/^([ \t]*)export\s+default\s+/gm, '$1')
        .replace(/^([ \t]*)export\s*\{[^}]*\}\s*;?/gm, '$1')
        .replace(/^([ \t]*)export\s+(const|let|var|function|class|async\s+function)\s+/gm, '$1$2 ')
        .replace(/^([ \t]*)import\s+[^;\n]+;?/gm, '$1')
        .replace(/^([ \t]*)export\s+\*\s+from\s+[^;\n]+;?/gm, '$1')
        // Strip TS interface / type declarations
        .replace(/^([ \t]*)interface\s+\w+(\s*<[^>]+>)?(\s+extends\s+[^{]+)?\s*\{[\s\S]*?\}/gm, '')
        .replace(/^([ \t]*)type\s+\w+(\s*<[^>]+>)?\s*=[\s\S]*?;/gm, '')

      // Wrap in async IIFE to allow top-level await and return statements
      const wrapped = `(async function() {\n${sanitized}\n});`
      new vm.Script(wrapped)
      return { valid: true, error: null }
    } catch (err) {
      // In TS code, type annotations might trigger syntax error in raw vm.Script
      if (['ts', 'typescript', 'tsx'].includes(lang)) {
        // If bracket check passed, treat as valid TS fallback
        return { valid: true, error: null }
      }
      return { valid: false, error: `JS Syntax Error: ${err.message}` }
    }
  }

  // 3. Python validation
  if (['py', 'python'].includes(lang)) {
    const bracketCheck = checkBracketBalance(trimmed)
    if (!bracketCheck.balanced) {
      return { valid: false, error: `Python syntax error: ${bracketCheck.error}` }
    }

    const lines = trimmed.split(/\r?\n/)
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim()
      if (!line || line.startsWith('#')) continue
      // Lines starting with block keywords must end with ':'
      const blockKeywords = /^(def\s+\w+|class\s+\w+|if\s+|elif\s+|else:|while\s+|for\s+|try:|except(\s+.*)?:|finally:|with\s+)/
      if (blockKeywords.test(line)) {
        // If line is incomplete or doesn't end with ':' (accounting for trailing comments)
        const codePart = line.split('#')[0].trim()
        if (!codePart.endsWith(':') && !codePart.endsWith('\\') && !codePart.endsWith('(')) {
          return { valid: false, error: `Python Syntax Error at line ${idx + 1}: expected ':' at end of '${codePart}'` }
        }
      }
    }
    return { valid: true, error: null }
  }

  // Generic fallback: check balanced brackets
  const bracketCheck = checkBracketBalance(trimmed)
  if (!bracketCheck.balanced) {
    return { valid: false, error: bracketCheck.error }
  }
  return { valid: true, error: null }
}

/**
 * Validates all code blocks and files in a candidate proposal.
 * @param {object} candidate
 * @returns {{ valid: boolean, errors: string[], warnings: string[], blocksCount: number, validCount: number }}
 */
export function validateCandidateSyntax(candidate = {}) {
  const errors = []
  const warnings = []
  let blocksCount = 0
  let validCount = 0

  // 1. Check markdown code blocks
  if (typeof candidate.text === 'string') {
    const blocks = extractCodeBlocks(candidate.text)
    for (const b of blocks) {
      blocksCount++
      const res = validateCodeBlockSyntax(b.code, b.language)
      if (res.valid) {
        validCount++
      } else {
        errors.push(`[Block ${blocksCount} (${b.language || 'code'})]: ${res.error}`)
      }
    }
  }

  // 2. Check candidate workspace files
  if (Array.isArray(candidate.files)) {
    for (const file of candidate.files) {
      if (!file || typeof file.content !== 'string' || !file.relativePath) continue
      blocksCount++
      const ext = path.extname(file.relativePath).toLowerCase().replace('.', '')
      const res = validateCodeBlockSyntax(file.content, ext)
      if (res.valid) {
        validCount++
      } else {
        errors.push(`[File ${file.relativePath}]: ${res.error}`)
      }
    }
  }

  const valid = errors.length === 0
  return {
    valid,
    errors,
    warnings,
    blocksCount,
    validCount,
  }
}

/**
 * Applies local zero-token syntax filter across all candidate outputs.
 * @param {Array<object>} candidates
 * @param {object} [options]
 * @returns {{ candidates: Array<object>, validCandidates: Array<object>, invalidCandidates: Array<object>, filterApplied: boolean }}
 */
export function applySyntaxFilter(candidates = [], options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { candidates: [], validCandidates: [], invalidCandidates: [], filterApplied: false }
  }

  const enabled = options.enabled !== false
  if (!enabled) {
    return { candidates, validCandidates: candidates, invalidCandidates: [], filterApplied: false }
  }

  const validCandidates = []
  const invalidCandidates = []

  for (const cand of candidates) {
    const syntax = validateCandidateSyntax(cand)
    cand.syntaxValidation = syntax

    if (syntax.valid) {
      validCandidates.push(cand)
    } else {
      invalidCandidates.push(cand)
    }
  }

  // If we have at least one valid candidate and some broken candidates,
  // disqualify broken candidates from winning
  if (validCandidates.length > 0 && invalidCandidates.length > 0) {
    for (const invalid of invalidCandidates) {
      invalid.disqualified = true
      invalid.disqualificationReason = `Failed local pre-judge syntax filter (${invalid.syntaxValidation.errors.length} error(s))`
    }
  }

  return {
    candidates,
    validCandidates: validCandidates.length > 0 ? validCandidates : candidates,
    invalidCandidates,
    filterApplied: true,
  }
}

/**
 * Formats an advisory syntax report directive for the judge.
 * @param {Array<object>} candidates
 * @param {object} [options]
 * @param {boolean} [options.blind=false]
 * @returns {string}
 */
export function formatSyntaxDirective(candidates = [], options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return ''
  const isBlind = Boolean(options.blind)
  const lines = ['### Pre-Judge Local Syntax Gate Results (0 Tokens Spent):']

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]
    const v = cand.syntaxValidation
    const label = isBlind ? `Candidate ${cand.index ?? (i + 1)}` : (cand.label || `Candidate ${cand.index ?? (i + 1)}`)
    if (!v) {
      lines.push(`- **${label}**: Not evaluated`)
      continue
    }

    if (v.valid) {
      lines.push(`- **${label}**: PASSED (${v.validCount}/${v.blocksCount} code block(s) syntactically valid)`)
    } else {
      lines.push(`- **${label}**: FAILED (${v.errors.length} syntax error(s)):`)
      for (const err of v.errors.slice(0, 3)) {
        lines.push(`    * ${err}`)
      }
      if (v.errors.length > 3) {
        lines.push(`    * ...and ${v.errors.length - 3} more syntax error(s)`)
      }
    }
  }

  return lines.join('\n')
}

