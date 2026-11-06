import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeSensitiveText,
  sanitizeCandidatesForCloudJudge,
  formatPrivacyDirective,
} from '../lib/pipeline/privacy-sanitizer.js'
import { MOA_EVENTS } from '../lib/events.js'

test('sanitizeSensitiveText: redacts API keys, Bearer tokens, and JWTs', () => {
  const input = 'const key = "sk-abcdef1234567890abcdef1234567890"; const auth = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J_wVnptlzskk";'
  const res = sanitizeSensitiveText(input)
  assert.ok(!res.sanitizedText.includes('sk-abcdef'))
  assert.ok(res.sanitizedText.includes('[REDACTED_API_KEY]'))
  assert.ok(res.sanitizedText.includes('[REDACTED_JWT]'))
  assert.ok(res.redactionCount >= 2)
})

test('sanitizeSensitiveText: redacts Unix and Windows absolute home paths into relative workspace paths', () => {
  const input = 'Read /home/vadim/secret-vault/keys.txt or C:\\Users\\admin\\Documents\\vault.json'
  const res = sanitizeSensitiveText(input)
  assert.ok(!res.sanitizedText.includes('/home/vadim'))
  assert.ok(!res.sanitizedText.includes('C:\\Users\\admin'))
  assert.ok(res.sanitizedText.includes('/workspace/secret-vault/keys.txt'))
  assert.ok(res.sanitizedText.includes('C:\\workspace\\Documents\\vault.json'))
  assert.equal(res.redactionCount, 2)
})

test('sanitizeSensitiveText: redacts private internal IP addresses and emails', () => {
  const input = 'Connecting to 192.168.1.111 and 10.0.0.5 for admin user dev@internal-corp.local'
  const res = sanitizeSensitiveText(input)
  assert.ok(!res.sanitizedText.includes('192.168.1.111'))
  assert.ok(!res.sanitizedText.includes('10.0.0.5'))
  assert.ok(!res.sanitizedText.includes('dev@internal-corp.local'))
  assert.ok(res.sanitizedText.includes('[REDACTED_INTERNAL_IP]'))
  assert.ok(res.sanitizedText.includes('[REDACTED_EMAIL]'))
  assert.equal(res.redactionCount, 3)
})

test('sanitizeCandidatesForCloudJudge: preserves originalOutput and emits PRIVACY_SANITIZED', () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  const candidates = [
    {
      model: 'edge-qwen',
      output: 'const secret = "sk-1234567890123456789012345"; connect("192.168.1.5");',
    },
    {
      model: 'edge-deepseek',
      output: 'function run() { return "/home/alice/project/file.js"; }',
    },
  ]

  const progressLogs = []
  const res = sanitizeCandidatesForCloudJudge(candidates, {
    ctx: mockCtx,
    runId: 'priv-run-1',
    onProgress: (m) => progressLogs.push(m),
  })

  assert.equal(res.sanitizedCandidates.length, 2)
  assert.ok(res.totalRedactions >= 3)
  assert.ok(res.privacyDirective.includes('PRIVACY & PII SANITIZATION ACTIVE'))

  // Check preservation of original code for local promotion
  assert.equal(candidates[0].originalOutput, 'const secret = "sk-1234567890123456789012345"; connect("192.168.1.5");')
  assert.ok(candidates[0].sanitizedOutput.includes('[REDACTED_API_KEY]'))
  assert.ok(candidates[0].sanitizedOutput.includes('[REDACTED_INTERNAL_IP]'))

  assert.equal(emitted.length, 2)
  assert.equal(emitted[0].ev, MOA_EVENTS.PRIVACY_SANITIZED)
  assert.equal(emitted[0].p.candidateIndex, 0)
  assert.ok(emitted[0].p.redactionCount >= 2)
})
