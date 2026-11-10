import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {
  verifyWebhookSignature,
  parseDiffSummary,
  runPrConsensusReview,
  postReviewToGitea,
} from '../lib/pipeline/pr-reviewer.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #311: Pull Request & Webhook Consensus Reviewer Bot Mode', () => {
  it('verifyWebhookSignature: validates HMAC-SHA256 signature correctly', () => {
    const payload = JSON.stringify({ action: 'opened', number: 42 })
    const secret = 'my-webhook-secret-123'
    const validSig = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`

    assert.equal(verifyWebhookSignature(payload, validSig, secret), true)
    assert.equal(verifyWebhookSignature(payload, 'sha256=invalid-signature-hash', secret), false)
    assert.equal(verifyWebhookSignature(payload, '', secret), false)
    assert.equal(verifyWebhookSignature(payload, '', ''), false, 'Empty secret fails closed')
    assert.equal(verifyWebhookSignature(payload, validSig, ''), false, 'Missing secret fails closed')
  })

  it('parseDiffSummary: accurately parses files changed, additions, deletions, and hunks', () => {
    const sampleDiff = `diff --git a/lib/calc.js b/lib/calc.js
index 123..456 100644
--- a/lib/calc.js
+++ b/lib/calc.js
@@ -1,3 +1,5 @@
-function add(a, b) {
+export function add(a, b) {
+  if (typeof a !== 'number') throw new TypeError();
   return a + b;
 }
diff --git a/test/calc.test.js b/test/calc.test.js
index 789..abc 100644
--- a/test/calc.test.js
+++ b/test/calc.test.js
@@ -10,2 +10,4 @@
+assert.equal(add(1, 2), 3);
+assert.throws(() => add('a', 2));
`
    const summary = parseDiffSummary(sampleDiff)
    assert.equal(summary.files.length, 2)
    assert.equal(summary.files[0].filePath, 'lib/calc.js')
    assert.equal(summary.files[0].additions, 2)
    assert.equal(summary.files[0].deletions, 1)
    assert.equal(summary.files[1].filePath, 'test/calc.test.js')
    assert.equal(summary.totalAdditions, 4)
    assert.equal(summary.totalDeletions, 1)
  })

  it('runPrConsensusReview: runs 3 perspectives, synthesizes unified review, and emits PR_REVIEW_COMPLETE event', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const mockCallLlm = async (params) => {
      if (params.model === 'judge') {
        return {
          text: `VERDICT: APPROVED
### 📋 PR Review Verdict & Executive Summary
The PR adds defensive validation cleanly without regressions.

### 🔍 Security & Performance Audit Status
No vulnerabilities detected. All checks green.`,
          usage: { inputTokens: 100, outputTokens: 80 },
        }
      }
      return {
        text: 'Perspective check passed with zero issues.',
        usage: { inputTokens: 40, outputTokens: 40 },
      }
    }

    const report = await runPrConsensusReview({
      prDiff: 'diff --git a/index.js b/index.js\n+console.log("hello");\n',
      prTitle: 'Add friendly greeting',
      prNumber: 99,
      callLlm: mockCallLlm,
      ctx: mockCtx,
      runId: 'pr-test-99',
    })

    assert.equal(report.prNumber, 99)
    assert.equal(report.verdict, 'APPROVED')
    assert.equal(report.isBlocking, false)
    assert.ok(report.synthesizedReport.includes('PR Review Verdict'))

    const evt = events.find((e) => e.evt === MOA_EVENTS.PR_REVIEW_COMPLETE)
    assert.ok(evt, 'Expected PR_REVIEW_COMPLETE event')
    assert.equal(evt.payload.prNumber, 99)
    assert.equal(evt.payload.verdict, 'APPROVED')
  })

  it('postReviewToGitea: calls Gitea API endpoint with authorization token', async () => {
    let capturedUrl = ''
    let capturedHeaders = {}
    let capturedBody = {}

    const mockFetch = async (url, opts) => {
      capturedUrl = url
      capturedHeaders = opts.headers
      capturedBody = JSON.parse(opts.body)
      return { ok: true, status: 201 }
    }

    const res = await postReviewToGitea({
      giteaUrl: 'http://127.0.0.1:3005',
      giteaToken: 'mock-gitea-token-123',
      repoOwner: 'goodandready',
      repoName: 'dsh-moa',
      prNumber: 42,
      reviewReport: {
        verdict: 'APPROVED',
        synthesizedReport: 'Everything looks good.',
      },
      fetchFn: mockFetch,
    })

    assert.equal(res, true)
    assert.ok(capturedUrl.includes('/repos/goodandready/dsh-moa/issues/42/comments'))
    assert.equal(capturedHeaders['Authorization'], 'token mock-gitea-token-123')
    assert.ok(capturedBody.body.includes('MoA Autonomous Consensus Review'))
    assert.ok(capturedBody.body.includes('APPROVED'))
  })
})
