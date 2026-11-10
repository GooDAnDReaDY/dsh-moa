/**
 * Pull Request & Webhook Consensus Reviewer Bot Mode (#311, #349)
 *
 * Autonomous multi-model review for Pull Requests via Gitea/GitHub webhooks or CLI.
 * Evaluates PR diffs through an ensemble of 3 specialized reviewers (Architecture,
 * Security, Performance), synthesizes unified constructive feedback, and automatically
 * posts the verdict and line-specific review comments to Gitea.
 */

import { logger } from '../logger.js'
import { emitEvent, MOA_EVENTS } from '../events.js'
import crypto from 'node:crypto'

/**
 * Validates Gitea / GitHub HMAC-SHA256 webhook signature (fail-closed, #349).
 * @param {string} payload
 * @param {string} signature
 * @param {string} secret
 * @returns {boolean}
 */
export function verifyWebhookSignature(payload = '', signature = '', secret = '') {
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) return false
  if (!signature) return false

  try {
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

/**
 * Parses raw unified diff string into changed files and statistics.
 * @param {string} rawDiff
 * @returns {{ files: Array<object>, totalAdditions: number, totalDeletions: number }}
 */
export function parseDiffSummary(rawDiff = '') {
  if (typeof rawDiff !== 'string') return { files: [], totalAdditions: 0, totalDeletions: 0 }

  const files = []
  let currentFile = null
  let totalAdditions = 0
  let totalDeletions = 0

  const lines = rawDiff.split('\n')
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentFile) files.push(currentFile)
      const parts = line.split(' ')
      const filePath = parts[3] ? parts[3].replace(/^[ab]\//, '') : 'unknown'
      currentFile = { filePath, additions: 0, deletions: 0, hunks: [] }
    } else if (line.startsWith('@@') && currentFile) {
      currentFile.hunks.push(line)
    } else if (line.startsWith('+') && !line.startsWith('+++') && currentFile) {
      currentFile.additions++
      totalAdditions++
    } else if (line.startsWith('-') && !line.startsWith('---') && currentFile) {
      currentFile.deletions++
      totalDeletions++
    }
  }

  if (currentFile) files.push(currentFile)
  return { files, totalAdditions, totalDeletions }
}

/**
 * Generates synthesized PR review verdict and comments using MoA arbitration.
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function runPrConsensusReview({
  prDiff = '',
  prTitle = 'Pull Request',
  prNumber = 1,
  preset = {},
  callLlm,
  strictBlocking = false,
  signal = null,
  ctx = null,
  runId = 'pr-review',
}) {
  const diffSummary = parseDiffSummary(prDiff)
  const truncatedDiff = prDiff.slice(0, 15000)

  // 1. Perspective 1: Architecture Review
  const archPrompt = `You are a Systems Architect reviewing this Pull Request diff:
Title: ${prTitle}
Files Changed: ${diffSummary.files.map((f) => f.filePath).join(', ')}
Diff:
${truncatedDiff}

Evaluate architectural coherence, public API breakage, and modularity. List any architectural risks.`

  // 2. Perspective 2: Security Review
  const secPrompt = `You are a Senior Security Auditor reviewing this Pull Request diff:
Title: ${prTitle}
Diff:
${truncatedDiff}

Scan specifically for: SQLi, XSS, ReDoS, unsafe eval/exec, path traversal, hardcoded secrets, or missing auth boundaries. List all vulnerabilities.`

  // 3. Perspective 3: Performance & Quality
  const perfPrompt = `You are a High-Performance Engineer reviewing this Pull Request diff:
Title: ${prTitle}
Diff:
${truncatedDiff}

Scan for: N+1 queries, unindexed lookups, memory leaks, unneeded allocations, and bloated dependencies. List performance issues.`

  const reviewerPromises = [
    callLlm({ provider: 'default', model: 'architect', messages: [{ role: 'user', content: archPrompt }], temperature: 0.3, maxTokens: 1024, signal }),
    callLlm({ provider: 'default', model: 'security', messages: [{ role: 'user', content: secPrompt }], temperature: 0.1, maxTokens: 1024, signal }),
    callLlm({ provider: 'default', model: 'performance', messages: [{ role: 'user', content: perfPrompt }], temperature: 0.3, maxTokens: 1024, signal }),
  ]

  const [archRes, secRes, perfRes] = await Promise.all(reviewerPromises)

  // 4. Judge Arbitration & Synthesis
  const judgePrompt = `You are the Lead Maintainer and Judge reviewing an autonomous multi-model consilium review for PR #${prNumber}: "${prTitle}".
Here are the findings from the 3 specialized reviewers:

[Systems Architecture Review]:
${archRes.text || 'No issues found.'}

[Security Auditor Review]:
${secRes.text || 'No issues found.'}

[Performance Review]:
${perfRes.text || 'No issues found.'}

Task:
1. De-duplicate all observations. Filter out trivial pedantic nits.
2. Determine the authoritative review verdict:
   VERDICT: <APPROVED | REQUEST_CHANGES | COMMENT>
   (Mark REQUEST_CHANGES if any high-severity security vulnerabilities or breaking architecture flaws exist).
3. Provide a structured review report:
   ### 📋 PR Review Verdict & Executive Summary
   ### 🚨 Critical Blockers (if any)
   ### 💡 Actionable Improvement Suggestions
   ### 🔍 Security & Performance Audit Status`

  const judgeRes = await callLlm({
    provider: preset?.aggregator?.provider || 'default',
    model: preset?.aggregator?.model || 'judge',
    messages: [{ role: 'user', content: judgePrompt }],
    temperature: 0.2,
    maxTokens: 2048,
    signal,
  })

  const synthesizedText = judgeRes.text || ''
  const isBlocking = /VERDICT:\s*REQUEST_CHANGES/i.test(synthesizedText) || (strictBlocking && /BLOCKER/i.test(synthesizedText))
  const verdict = isBlocking ? 'REQUEST_CHANGES' : /VERDICT:\s*APPROVED/i.test(synthesizedText) ? 'APPROVED' : 'COMMENT'

  const reviewReport = {
    prNumber,
    prTitle,
    verdict,
    isBlocking,
    diffSummary,
    synthesizedReport: synthesizedText,
    reviewerFindings: {
      architecture: archRes.text,
      security: secRes.text,
      performance: perfRes.text,
    },
  }

  emitEvent(ctx, MOA_EVENTS.PR_REVIEW_COMPLETE, {
    runId,
    prNumber,
    verdict,
    isBlocking,
    filesCount: diffSummary.files.length,
  })

  return reviewReport
}

/**
 * Posts review comment to Gitea PR via REST API.
 * @param {object} params
 * @returns {Promise<boolean>}
 */
export async function postReviewToGitea({
  giteaUrl = 'http://127.0.0.1:3005',
  giteaToken = '',
  repoOwner = 'goodandready',
  repoName = 'dsh-moa',
  prNumber = 1,
  reviewReport,
  fetchFn = fetch,
}) {
  if (!giteaToken) {
    logger.warn('[dsh-moa] Gitea PR review comment skipped: no giteaToken provided')
    return false
  }

  const endpoint = `${giteaUrl}/api/v1/repos/${repoOwner}/${repoName}/issues/${prNumber}/comments`
  const body = `## 🤖 MoA Autonomous Consensus Review (PR #${prNumber})\n\n**Verdict**: \`${reviewReport.verdict}\`\n\n${reviewReport.synthesizedReport}`

  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `token ${giteaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    })
    return res.ok
  } catch (err) {
    logger.warn(`[dsh-moa] Failed to post PR review comment to Gitea #${prNumber}:`, err?.message || err)
    return false
  }
}
