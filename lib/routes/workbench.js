import path from 'node:path'
import { getMoaHistory, getMoaRunById, isTestEnvironment } from '../history.js'
import { promoteCandidateWorkspace, readCandidateFiles, computeLineDiff, isSafeRelativePath, isLoopbackUrl } from '../file-workspace.js'
import { writeJson, readBody, isAllowedWorkspace, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'
import { generateMoABenchmarkReport } from '../moa-report.js'
import { handleWorkbenchGet, handleWorkbenchAssemble } from '../moa-workbench.js'

export function registerWorkbenchRoutes(ctx, { live, callLlm, webServerPort, timeMachineEngine, workspaceRoot }) {
  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/promote',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'POST required' })
        if (!isSafeWriteRequest(req)) {
          writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          return
        }
        try {
          const raw = await readBody(req)
          const body = JSON.parse(raw || '{}')
          const candidateIndex = parseInt(body?.candidateIndex, 10)
          if (isNaN(candidateIndex) || candidateIndex < 1) {
            writeJson(res, 400, { ok: false, error: 'Valid candidateIndex required (>= 1)' })
            return
          }
          const runId = body?.runId
          let recordedRun = null
          if (runId) {
            recordedRun = getMoaRunById(runId)
            if (!recordedRun) {
              writeJson(res, 404, { ok: false, error: `Run '${runId}' not found` })
              return
            }
          } else {
            recordedRun = getMoaHistory(1, 0)?.runs?.[0] || null
            if (!recordedRun) {
              writeJson(res, 400, { ok: false, error: 'No recorded MoA run found' })
              return
            }
          }
          if (body?.cwd && path.resolve(body.cwd) !== path.resolve(recordedRun.cwd)) {
            writeJson(res, 403, { ok: false, error: 'Forbidden: cwd does not match recorded run cwd' })
            return
          }
          const effectiveCwd = recordedRun.cwd
          const promotedFiles = await promoteCandidateWorkspace(effectiveCwd, candidateIndex, {
            runId: recordedRun.id,
            keepMoa: true,
            port: ctx.webServer?.port,
            timeMachineEngine: timeMachineEngine || ctx.reflect?.get?.('timeMachineEngine', false),
            force: Boolean(body?.force),
          })
          writeJson(res, 200, { ok: true, candidateIndex, promotedFiles, checkpoint: promotedFiles?.checkpoint || null })
        } catch (err) { writeJson(res, 500, { ok: false, error: err?.message || String(err) }) }
      },
    })
  }, 'dsh-moa: promote candidate route')

  // Route: /dsh-moa/diff (Candidate Diff Viewer)

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-moa/diff',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET required' })
        try {
          const u = new URL(req.url, 'http://localhost')
          const rawRunId = u.searchParams.get('runId')
          const queryCwd = u.searchParams.get('cwd')
          let run = null
          if (rawRunId && rawRunId !== 'latest' && rawRunId !== 'active') {
            run = getMoaRunById(rawRunId)
            if (!run) {
              writeJson(res, 404, { ok: false, error: `Run '${rawRunId}' not found` })
              return
            }
          } else {
            run = getMoaHistory(1, 0)?.runs?.[0] || null
            if (!run) {
              writeJson(res, 404, { ok: false, error: 'No recorded MoA run found' })
              return
            }
          }
          if (queryCwd && path.resolve(queryCwd) !== path.resolve(run.cwd)) {
            writeJson(res, 403, { ok: false, error: 'Forbidden: cwd does not match recorded run cwd' })
            return
          }
          const runId = run.id
          const cwd = run.cwd
          const sanitizeTarget = (val, def) => {
            const clean = String(val || '').trim().replace(/[^a-zA-Z0-9_-]/g, '')
            return clean || def
          }
          const from = sanitizeTarget(u.searchParams.get('from'), '1')
          const to = sanitizeTarget(u.searchParams.get('to'), 'curator-synthesis')
          const rawFile = u.searchParams.get('file') || ''
          const file = (rawFile && isSafeRelativePath(rawFile)) ? rawFile : ''

          const fromFiles = await readCandidateFiles(cwd, from, { runId })
          const toFiles = await readCandidateFiles(cwd, to, { runId })

          // Collect all unique file paths
          const allPaths = Array.from(new Set([
            ...fromFiles.map((f) => f.relativePath),
            ...toFiles.map((f) => f.relativePath),
          ])).sort()

          const targetPath = file || allPaths[0] || ''
          const fromItem = fromFiles.find((f) => f.relativePath === targetPath)
          const toItem = toFiles.find((f) => f.relativePath === targetPath)

          const diff = targetPath
            ? computeLineDiff(fromItem?.content || '', toItem?.content || '')
            : []

          writeJson(res, 200, {
            ok: true,
            from,
            to,
            files: allPaths,
            selectedFile: targetPath,
            fromSize: fromItem?.size || 0,
            toSize: toItem?.size || 0,
            diff,
          })
        } catch (err) { writeJson(res, 500, { ok: false, error: err?.message || String(err) }) }
      },
    })
  }, 'dsh-moa: candidate diff route')

  // Route: /dsh-moa/history/export

  ctx.effect(() => {
    return ctx.webServer.register({
      kind: 'prefix',
      path: '/dsh-moa/runs',
      handler: (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return
        const urlPath = req.url.split('?')[0]
        const parts = urlPath.split('/').filter(Boolean)
        const runId = parts[2] || ''
        if (parts[3] === 'workbench') {
          const targetCwd = workspaceRoot || ctx?.reflect?.get?.('baseDir', false) || ctx?.reflect?.get?.('workspaceDir', false) || process.cwd()
          if (req.method === 'GET') {
            return handleWorkbenchGet(req, res, { runId, cwd: targetCwd })
          }
          if (req.method === 'POST') {
            if (!isSafeWriteRequest(req)) {
              return writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
            }
            return handleWorkbenchAssemble(req, res, { runId, cwd: targetCwd, live, callLlm, webServerPort, timeMachineEngine })
          }
          return writeJson(res, 405, { ok: false, error: 'Method not allowed' })
        }
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'GET required' })
        const isReport = parts[3] === 'report'
        const run = runId ? getMoaRunById(runId) : null
        if (!run) {
          writeJson(res, 404, { ok: false, error: 'Run not found' })
          return
        }
        if (isReport) {
          const u = new URL(req.url, 'http://127.0.0.1')
          const format = u.searchParams.get('format') || 'md'
          const report = run.benchmarkReport || generateMoABenchmarkReport({
            runId: run.id,
            timestamp: run.timestamp,
            preset: run.preset,
            prompt: run.prompt,
            durationMs: run.durationMs,
            usage: { totalTokens: run.totalTokens },
            costUsd: run.totalCostUsd,
            candidates: run.candidates,
            winningIndex: run.winnerIndex,
            winningLabel: run.winnerModel,
          })
          if (format === 'json') {
            writeJson(res, 200, { ok: true, report: typeof report === 'object' ? (report.json || report) : report })
            return
          }
          const mdText = typeof report === 'string' ? report : (report.markdown || JSON.stringify(report, null, 2))
          res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' })
          res.end(mdText)
          return
        }
        writeJson(res, 200, { ok: true, run })
      },
    })
  }, 'dsh-moa: run by id route')

  // Route: /dsh-moa/route-preset
}
