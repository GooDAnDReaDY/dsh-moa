import { getWebServer } from '../services.js'
/**
 * MoA Benchmark & Pull Request Review Routes (#310, #311, #349)
 *
 * Exposes endpoints:
 * - POST /dsh-moa/benchmark: Run regression test suite on MoA preset
 * - POST /dsh-moa/webhook/pr: Gitea / GitHub Webhook listener for autonomous PR review
 */

import { runMoABenchmarkSuite } from '../pipeline/benchmark-suite.js'
import {
  verifyWebhookSignature,
  runPrConsensusReview,
  postReviewToGitea,
} from '../pipeline/pr-reviewer.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'
import { logger } from '../logger.js'

export function registerBenchmarkRoutes(ctx, deps = {}) {
  const getLiveConfig = () => (typeof deps?.live === 'function' ? deps.live() : deps?.config || {})

  // 1. Benchmark Execution: /dsh-moa/benchmark
  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/benchmark',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        if (req.method !== 'POST') {
          return writeJson(res, 405, { ok: false, error: 'Method Not Allowed' })
        }

        if (!isSafeWriteRequest(req)) {
          return writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site write rejected' })
        }

        let body = {}
        try {
          const raw = await readBody(req)
          if (raw) body = JSON.parse(raw)
        } catch (_err) {
          return writeJson(res, 400, { ok: false, error: 'Malformed JSON payload' })
        }

        const config = getLiveConfig()
        const presetName = body.presetName || 'default'
        const configPresets = config.presets || []
        const preset = configPresets.find((p) => p.name === presetName) || configPresets[0] || {}

        try {
          const summary = await runMoABenchmarkSuite({
            preset,
            customCases: body.customCases,
            maxCases: body.maxCases || 5,
            callLlm: deps.callLlm || ctx.callLlm,
            prices: config.prices || {},
            ctx,
          })
          return writeJson(res, 200, { ok: true, summary })
        } catch (err) {
          logger.warn('[dsh-moa] Benchmark suite run failed:', err?.message || err)
          return writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  })

  // 2. PR Review Webhook: /dsh-moa/webhook/pr
  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/webhook/pr',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          return writeJson(res, 405, { ok: false, error: 'Method Not Allowed' })
        }

        const config = getLiveConfig()
        if (!config.pr_review_bot_enabled) {
          return writeJson(res, 403, { ok: false, error: 'PR review bot is disabled' })
        }

        let rawPayload = ''
        try {
          rawPayload = await readBody(req)
        } catch {
          return writeJson(res, 400, { ok: false, error: 'Failed to read payload' })
        }

        const signature = req.headers['x-gitea-signature'] || req.headers['x-hub-signature-256'] || ''
        const webhookSecret = config.pr_review_webhook_secret || ''

        if (!webhookSecret) {
          return writeJson(res, 403, { ok: false, error: 'Webhook secret is not configured' })
        }

        if (!verifyWebhookSignature(rawPayload, signature, webhookSecret)) {
          return writeJson(res, 403, { ok: false, error: 'Invalid webhook signature' })
        }

        let payload = {}
        try {
          payload = JSON.parse(rawPayload)
        } catch {
          return writeJson(res, 400, { ok: false, error: 'Invalid JSON payload' })
        }

        const repoOwner = payload.repository?.owner?.username || payload.repository?.owner?.login || 'goodandready'
        const repoName = payload.repository?.name || 'dsh-moa'
        const repoFullName = payload.repository?.full_name || (repoOwner && repoName ? `${repoOwner}/${repoName}` : '')

        const allowedRepos = (config.pr_review_allowed_repos || 'goodandready/dsh-moa')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)

        if (allowedRepos.length > 0 && repoFullName && !allowedRepos.includes(repoFullName.toLowerCase())) {
          return writeJson(res, 403, { ok: false, error: `Repository ${repoFullName} is not permitted for PR review` })
        }

        const eventType = req.headers['x-gitea-event'] || req.headers['x-github-event'] || ''
        if (eventType && eventType !== 'pull_request') {
          return writeJson(res, 200, { ok: true, ignored: true, reason: `Ignored event: ${eventType}` })
        }

        const action = payload.action
        if (action !== 'opened' && action !== 'synchronize' && action !== 'reopened') {
          return writeJson(res, 200, { ok: true, ignored: true, reason: `Ignored action: ${action}` })
        }

        const pr = payload.pull_request || {}
        const prNumber = pr.number || payload.number || 1
        const prTitle = pr.title || 'Untitled PR'
        const prDiff = payload.diff || pr.diff || ''

        try {
          const configPresets = config.presets || []
          const preset = configPresets[0] || {}

          const reviewReport = await runPrConsensusReview({
            prDiff,
            prTitle,
            prNumber,
            preset,
            callLlm: deps.callLlm || ctx.callLlm,
            strictBlocking: Boolean(config.pr_review_strict_blocking),
            ctx,
          })

          const giteaToken = config.pr_review_gitea_token || ''

          if (giteaToken) {
            await postReviewToGitea({
              giteaToken,
              repoOwner,
              repoName,
              prNumber,
              reviewReport,
            })
          }

          return writeJson(res, 200, { ok: true, reviewReport })
        } catch (err) {
          logger.warn('[dsh-moa] Webhook PR review failed:', err?.message || err)
          return writeJson(res, 500, { ok: false, error: err?.message || String(err) })
        }
      },
    })
  })
}
