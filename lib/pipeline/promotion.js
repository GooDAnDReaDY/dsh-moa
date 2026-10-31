import { logger } from '../logger.js'
import { parseWinnerIndex, parseRecommendedAssembler } from '../moa-parser.js'
import { extractFileBlocks, writeCandidateWorkspace, promoteCandidateWorkspace, cleanMoaWorkspaces } from '../workspace/fs.js'
import { createPromotedPreview } from '../live-canvas.js'
import { summarizeMoAUsage } from '../pricing.js'
import { generateMoABenchmarkReport } from '../moa-report.js'
import { parseFileScores } from '../moa-workbench.js'
import { recordMoaRunAsync, candidatesForHistory } from '../history.js'
import { slotLabel } from '../moa-prompts.js'

export async function stagePromotion({
  synthesizedText,
  referenceOutputs,
  successfulRefs,
  multiJudgeResult,
  isCuratorSynthesis,
  allowCandidateOverride,
  promoteOpts,
  cwd,
  runId,
  signal,
  liveCanvas,
  startTime,
  chosenJudge,
  aggUsage,
  userPrompt,
  preset,
  isRefinement,
  isFastMode,
  effectiveReferences,
  referenceModels,
  historyFilePath,
  collectedCtx,
}) {
  const winningIndex = (multiJudgeResult?.consensus && multiJudgeResult?.winningCandidateIndex)
    ? multiJudgeResult.winningCandidateIndex
    : parseWinnerIndex(synthesizedText, 1, referenceOutputs.length)

  const recommendedAssembler = isCuratorSynthesis
    ? parseRecommendedAssembler(synthesizedText, winningIndex, referenceOutputs.length)
    : null

  const synthesizedFiles = extractFileBlocks(synthesizedText)
  let promotedFiles = []
  const keepWorkspaces = allowCandidateOverride

  if (signal?.aborted) {
    if (!keepWorkspaces) await cleanMoaWorkspaces(cwd, { runId })
    return { ok: false, abort: true, error: new Error('Turn aborted') }
  }

  try {
    if (synthesizedFiles.length > 0) {
      await writeCandidateWorkspace(cwd, 'curator-synthesis', synthesizedFiles, { runId })
      promotedFiles = await promoteCandidateWorkspace(cwd, 'curator-synthesis', { ...promoteOpts, runId, keepMoa: keepWorkspaces })
    } else if (referenceOutputs[winningIndex - 1]?.files?.length > 0) {
      promotedFiles = await promoteCandidateWorkspace(cwd, winningIndex, { ...promoteOpts, runId, keepMoa: keepWorkspaces })
    } else if (successfulRefs[0]?.files?.length > 0) {
      const fallbackIdx = successfulRefs[0].index
      promotedFiles = await promoteCandidateWorkspace(cwd, fallbackIdx, { ...promoteOpts, runId, keepMoa: keepWorkspaces })
    } else if (!keepWorkspaces) {
      await cleanMoaWorkspaces(cwd, { runId })
    }
  } catch (promoteErr) {
    if (!keepWorkspaces) await cleanMoaWorkspaces(cwd, { runId })
    if (signal?.aborted || promoteErr?.message === 'Turn aborted') return { ok: false, abort: true, error: new Error('Turn aborted') }
    throw promoteErr
  }

  const livePreview = await createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs, { winningIndex, synthesizedFiles })
  const durationMs = Date.now() - startTime
  const usageSummary = summarizeMoAUsage(referenceOutputs, aggUsage, multiJudgeResult?.totalUsage)
  const winningRef = referenceOutputs[winningIndex - 1]
  const winnerModel = winningRef?.label || slotLabel(effectiveReferences[0] || referenceModels[0])
  const finalAggLabel = slotLabel(chosenJudge)

  let benchmarkReport = null
  if (preset?.report_generation_enabled) {
    benchmarkReport = generateMoABenchmarkReport({
      runId, timestamp: new Date().toISOString(), preset: preset?.name || 'default',
      prompt: userPrompt, durationMs, usage: usageSummary, costUsd: usageSummary.totalCostUsd,
      candidates: referenceOutputs, winningIndex, winningLabel: winnerModel,
      consensus: multiJudgeResult, testGate: referenceOutputs.filter((r) => r.testResult).map((r) => r.testResult),
      isComposite: Boolean(preset?.composite_merge_enabled),
    })
  }

  const fileScores = (preset?.interactive_workbench_enabled)
    ? parseFileScores(synthesizedText, referenceOutputs)
    : null

  try {
    await recordMoaRunAsync({
      id: runId, cwd, prompt: userPrompt, preset: preset?.name || 'default', isRefinement,
      candidates: candidatesForHistory(referenceOutputs),
      aggregator: { provider: chosenJudge.provider, model: chosenJudge.model, usage: aggUsage, costUsd: aggUsage.costUsd },
      winnerIndex: winningIndex, winnerModel, promotedFiles, benchmarkReport, consensus: multiJudgeResult,
      fileScores, totalTokens: usageSummary.totalTokens, totalCostUsd: usageSummary.totalCostUsd, durationMs,
    }, historyFilePath || undefined)
  } catch (histErr) {
    logger.warn('[dsh-moa] Failed to record run in history:', histErr)
  }

  return {
    ok: true,
    payload: {
      kind: 'synthesis', content: synthesizedText, aggregator: isFastMode ? 'Fast Mode (Direct)' : finalAggLabel,
      references: referenceOutputs, presetName: preset?.name || 'default', isRefinement, isFastMode, isCuratorSynthesis,
      recommendedAssembler, winningIndex, winnerModel, promotedFiles, runId, allowCandidateOverride,
      benchmarkReport, consensus: multiJudgeResult, fileScores, ...(livePreview ? { liveCanvas: livePreview } : {}),
      usage: usageSummary, skippedFiles: collectedCtx?.skippedFiles || 0, skippedList: collectedCtx?.skippedList || [], durationMs,
    }
  }
}
