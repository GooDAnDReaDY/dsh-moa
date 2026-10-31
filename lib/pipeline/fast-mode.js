import { logger } from '../logger.js'
import { promoteCandidateWorkspace, cleanMoaWorkspaces } from '../workspace/fs.js'
import { createPromotedPreview } from '../live-canvas.js'
import { recordMoaRunAsync, candidatesForHistory } from '../history.js'
import { emitEvent, MOA_EVENTS } from '../events.js'

export async function stageFastMode({
  successfulRefs,
  referenceOutputs,
  allowCandidateOverride,
  promoteOpts,
  cwd,
  runId,
  signal,
  userPrompt,
  preset,
  isRefinement,
  historyFilePath,
  startTime,
  collectedCtx,
  liveCanvas,
  ctx = null,
}) {
  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { ok: false, abort: true, error: new Error('Turn aborted') }
  }
  const single = successfulRefs[0]
  let promotedFiles = [], promoteErr = null
  if (single.files?.length > 0) {
    try {
      promotedFiles = await promoteCandidateWorkspace(cwd, single.index, { ...promoteOpts, runId, keepMoa: allowCandidateOverride })
    } catch (e) { promoteErr = e }
  } else if (!allowCandidateOverride) {
    await cleanMoaWorkspaces(cwd, { runId })
  }
  if (promoteErr) {
    if (!allowCandidateOverride) await cleanMoaWorkspaces(cwd, { runId })
    if (signal?.aborted || promoteErr?.message?.includes('aborted') || promoteErr?.name === 'AbortError' || promoteErr?.message === 'Turn aborted') {
      return { ok: false, abort: true, error: new Error('Turn aborted') }
    }
    const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0)
    const totalCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0)).toFixed(5))
    const durationMs = Date.now() - startTime
    try {
      await recordMoaRunAsync({
        id: runId, cwd, prompt: userPrompt, preset: preset?.name || 'default',
        isRefinement, isFastMode: true, candidates: candidatesForHistory(referenceOutputs),
        aggregator: null, winnerIndex: 0, winnerModel: 'none',
        promotedFiles: [], totalTokens, totalCostUsd, durationMs,
        error: promoteErr?.message || String(promoteErr),
      }, historyFilePath || undefined)
    } catch (histErr) {
      logger.warn('[dsh-moa] Failed to record fast synthesis failure in history:', histErr?.message || histErr)
    }
    emitEvent(ctx, MOA_EVENTS.RUN_FINISH, {
      runId, durationMs, totalTokens, totalCostUsd, promotedFiles: [], winnerIndex: 0, error: promoteErr?.message || String(promoteErr),
    })
    return {
      ok: false,
      payload: {
        kind: 'failure', error: promoteErr,
        content: '🛑 Checkpoint or Promotion Failure: ' + (promoteErr?.message || String(promoteErr)),
        aggregator: 'Fast Mode (Direct)', references: referenceOutputs,
        presetName: preset?.name || 'default', isRefinement, isFastMode: true,
        winningIndex: 0, winnerModel: 'none', promotedFiles: [], runId,
        usage: {
          totalTokens, totalCostUsd,
          candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
          aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        },
        skippedFiles: collectedCtx?.skippedFiles || 0,
        skippedList: collectedCtx?.skippedList || [],
        durationMs,
      }
    }
  }

  const livePreview = await createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs, { winningIndex: single.index })
  const totalTokens = single.usage?.totalTokens || 0
  const totalCostUsd = Number((single.costUsd || 0).toFixed(5))
  const durationMs = Date.now() - startTime

  try {
    await recordMoaRunAsync({
      id: runId, cwd, prompt: userPrompt, preset: preset?.name || 'default',
      isRefinement, isFastMode: true, candidates: candidatesForHistory(referenceOutputs),
      aggregator: null, winnerIndex: single.index, winnerModel: single.label,
      promotedFiles, totalTokens, totalCostUsd, durationMs,
    }, historyFilePath || undefined)
  } catch (histErr) {
    logger.warn('[dsh-moa] Failed to record fast synthesis run in history:', histErr?.message || histErr)
  }

  emitEvent(ctx, MOA_EVENTS.RUN_FINISH, {
    runId, durationMs, totalTokens, totalCostUsd, promotedFiles, winnerIndex: single.index,
  })
  return {
    ok: true,
    payload: {
      kind: 'synthesis', content: single.text, aggregator: 'Fast Mode (Direct)', references: referenceOutputs,
      presetName: preset?.name || 'default', isRefinement, isFastMode: true, winningIndex: single.index,
      winnerModel: single.label, promotedFiles, runId, ...(livePreview ? { liveCanvas: livePreview } : {}),
      usage: { totalTokens, totalCostUsd, candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })), aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 } },
      skippedFiles: collectedCtx?.skippedFiles || 0, skippedList: collectedCtx?.skippedList || [], durationMs,
    }
  }
}
