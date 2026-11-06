/**
 * DeepSeek Harness Mixture of Agents (MoA) — Hybrid Private Edge & Privacy Sanitizer (#306)
 *
 * Protects project confidentiality in hybrid deployments by scrubbing local absolute paths,
 * internal private IPs, API tokens, JWTs, and proprietary secrets before forwarding prompts
 * or candidate proposals to external Cloud Judges. Preserves unsanitized originals locally
 * for workspace promotion.
 */

import { MOA_EVENTS, emitEvent } from '../events.js'

/**
 * Common regex definitions for sensitive data redaction.
 */
export const SANITIZATION_PATTERNS = {
  OPENAI_OR_GENERIC_KEY: /sk-[a-zA-Z0-9_\-]{20,}/g,
  BEARER_TOKEN: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
  JWT: /ey[A-Za-z0-9_\-]{15,}\.ey[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{10,}/g,
  AWS_KEY: /AKIA[0-9A-Z]{16}/g,
  PRIVATE_KEY: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  SECRET_ASSIGNMENT: /(?<=(?:api[_-]?key|secret|password|token|auth)\s*[:=]\s*["'])[a-zA-Z0-9_\-\.\/+=]{8,}(?=["'])/gi,
  UNIX_HOME_PATH: /(?:\/(?:home|Users)\/[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-\.]+)*)/g,
  WIN_USER_PATH: /(?:[A-Za-z]:\\(?:Users|Documents and Settings)\\[a-zA-Z0-9_\-]+(?:\\[a-zA-Z0-9_\-\.]+)*)/g,
  PRIVATE_IP: /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})\b/g,
  EMAIL: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
}

/**
 * Sanitizes a text string by redacting sensitive secrets, internal paths, and PII.
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {{ sanitizedText: string, redactionCount: number, redactingEntries: Array<object> }}
 */
export function sanitizeSensitiveText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return { sanitizedText: text || '', redactionCount: 0, redactingEntries: [] }
  }

  const {
    redactSecrets = true,
    redactPaths = true,
    redactIps = true,
    redactEmails = true,
  } = options

  let result = text
  let redactionCount = 0
  const redactingEntries = []

  // 1. Secrets & API Keys
  if (redactSecrets) {
    result = result.replace(SANITIZATION_PATTERNS.PRIVATE_KEY, () => {
      redactionCount++
      redactingEntries.push({ type: 'PRIVATE_KEY' })
      return '[REDACTED_PRIVATE_KEY]'
    })

    result = result.replace(SANITIZATION_PATTERNS.OPENAI_OR_GENERIC_KEY, () => {
      redactionCount++
      redactingEntries.push({ type: 'API_KEY' })
      return '[REDACTED_API_KEY]'
    })

    result = result.replace(SANITIZATION_PATTERNS.JWT, () => {
      redactionCount++
      redactingEntries.push({ type: 'JWT' })
      return '[REDACTED_JWT]'
    })

    result = result.replace(SANITIZATION_PATTERNS.AWS_KEY, () => {
      redactionCount++
      redactingEntries.push({ type: 'AWS_KEY' })
      return '[REDACTED_AWS_KEY]'
    })

    result = result.replace(SANITIZATION_PATTERNS.SECRET_ASSIGNMENT, () => {
      redactionCount++
      redactingEntries.push({ type: 'SECRET_VALUE' })
      return '[REDACTED_SECRET]'
    })
  }

  // 2. Private Paths
  if (redactPaths) {
    result = result.replace(SANITIZATION_PATTERNS.UNIX_HOME_PATH, (match) => {
      redactionCount++
      const parts = match.split('/')
      const subpath = parts.slice(3).join('/')
      return subpath ? `/workspace/${subpath}` : '/workspace'
    })

    result = result.replace(SANITIZATION_PATTERNS.WIN_USER_PATH, (match) => {
      redactionCount++
      const parts = match.split('\\')
      const subpath = parts.slice(3).join('\\')
      return subpath ? `C:\\workspace\\${subpath}` : 'C:\\workspace'
    })
  }

  // 3. Private IP addresses
  if (redactIps) {
    result = result.replace(SANITIZATION_PATTERNS.PRIVATE_IP, () => {
      redactionCount++
      redactingEntries.push({ type: 'INTERNAL_IP' })
      return '[REDACTED_INTERNAL_IP]'
    })
  }

  // 4. Email addresses
  if (redactEmails) {
    result = result.replace(SANITIZATION_PATTERNS.EMAIL, () => {
      redactionCount++
      redactingEntries.push({ type: 'EMAIL' })
      return '[REDACTED_EMAIL]'
    })
  }

  return {
    sanitizedText: result,
    redactionCount,
    redactingEntries,
  }
}

/**
 * Sanitizes candidate solutions before forwarding them to an external Cloud Judge.
 * Preserves the original unmodified code in candidate.originalOutput for safe local promotion.
 *
 * @param {Array<object>} candidates
 * @param {object} [options]
 * @returns {object} Sanitization result
 */
export function sanitizeCandidatesForCloudJudge(candidates, options = {}) {
  const {
    ctx,
    runId,
    onProgress,
    redactSecrets = true,
    redactPaths = true,
    redactIps = true,
    redactEmails = true,
  } = options

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      sanitizedCandidates: [],
      totalRedactions: 0,
      privacyDirective: null,
    }
  }

  let totalRedactions = 0
  const sanitizedCandidates = candidates.map((cand, idx) => {
    const rawText = typeof cand === 'string' ? cand : cand.output || cand.text || cand.code || ''
    const { sanitizedText, redactionCount, redactingEntries } = sanitizeSensitiveText(rawText, {
      redactSecrets,
      redactPaths,
      redactIps,
      redactEmails,
    })

    totalRedactions += redactionCount

    if (typeof cand === 'object' && cand !== null) {
      if (!cand.originalOutput) {
        cand.originalOutput = rawText
      }
      cand.sanitizedOutput = sanitizedText
      cand.redactionCount = redactionCount
    }

    if (ctx && redactionCount > 0) {
      emitEvent(ctx, MOA_EVENTS.PRIVACY_SANITIZED, {
        runId,
        candidateIndex: idx,
        model: cand?.model || `Candidate ${idx + 1}`,
        redactionCount,
        types: [...new Set(redactingEntries.map((e) => e.type))],
      })
    }

    return typeof cand === 'object' && cand !== null
      ? { ...cand, output: sanitizedText, text: sanitizedText }
      : sanitizedText
  })

  if (typeof onProgress === 'function' && totalRedactions > 0) {
    onProgress(`🛡️ *Hybrid Edge Privacy*: Sanitized ${totalRedactions} sensitive token(s) (secrets, paths, IPs) before cloud judge.\n`)
  }

  const privacyDirective = totalRedactions > 0 ? formatPrivacyDirective(totalRedactions) : null

  return {
    sanitizedCandidates,
    totalRedactions,
    privacyDirective,
  }
}

/**
 * Formats a privacy directive header for the Cloud Judge prompt.
 *
 * @param {number} totalRedactions
 * @returns {string}
 */
export function formatPrivacyDirective(totalRedactions) {
  return [
    '### 🛡️ PRIVACY & PII SANITIZATION ACTIVE',
    `Notice: ${totalRedactions} internal system path(s), private network IP(s), or secret token(s) have been sanitized with [REDACTED_*] or relative paths to preserve user confidentiality.`,
    'Evaluate the candidate solutions based on their architecture, correctness, and logic.',
  ].join('\n')
}
