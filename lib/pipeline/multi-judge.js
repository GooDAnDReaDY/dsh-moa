import { runMultiJudgePhase } from '../moa-multi-judge.js'
import { createBudgetAbortPayload } from '../moa-budget.js'
import { cleanMoaWorkspaces } from '../workspace/fs.js'

export async function stageMultiJudge({
  preset,
  successfulRefs,
  referenceOutputs,
  primaryJudge,
  userPrompt,
  judgeCriteria,
  prices,
  maxTokens,
  callLlm,
  signal,
  onProgress,
  cwd,
  runId,
  isRefinement,
  isFastMode,
  collectedCtx,
  startTime,
}) {
  const currentRefSpent = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0)
  const panelPhase = await runMultiJudgePhase({
    preset, successfulRefs, primaryJudge, userPrompt, judgeCriteria, prices, maxTokens, callLlm, signal, onProgress, currentSpent: currentRefSpent,
  })
  if (panelPhase.abort) {
    await cleanMoaWorkspaces(cwd, { runId })
    const abortPayload = createBudgetAbortPayload({
      reason: panelPhase.reason, primaryJudge, referenceOutputs, currentSpentUsd: currentRefSpent,
      preset, isRefinement, isFastMode, collectedCtx, startTime,
    })
    return { ok: false, abortPayload }
  }
  return { ok: true, multiJudgeResult: panelPhase.result }
}
