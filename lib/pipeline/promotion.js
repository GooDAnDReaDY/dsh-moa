import { recordConsensusDecision } from './knowledge-graph.js'
import { classifyEloCategory } from '../moa-elo.js'
import { runSelfHealingLoop } from '../moa-self-healing.js'
import { logger } from '../logger.js'
import { parseWinnerIndex, parseRecommendedAssembler } from '../moa-parser.js'
import { extractFileBlocks, writeCandidateWorkspace, promoteCandidateWorkspace, cleanMoaWorkspaces } from '../workspace/fs.js'
import { createPromotedPreview } from '../live-canvas.js'
import { summarizeMoAUsage } from '../pricing.js'
import { generateMoABenchmarkReport } from '../moa-report.js'
import { parseFileScores } from '../moa-workbench.js'
import { recordMoaRunAsync, candidatesForHistory } from '../history.js'
import { slotLabel } from '../moa-prompts.js'
import { emitEvent, MOA_EVENTS } from '../events.js'

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
  ctx = null,
  callLlm = null,
  onProgress = null,
  execFn = null,
  visualResult = null,
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

  let selfHealingResult = null
  if (preset?.self_healing_enabled && promotedFiles.length > 0 && typeof callLlm === "function") {
    selfHealingResult = await runSelfHealingLoop({
      cwd,
      command: preset.self_healing_command || "npm test",
      maxRetries: preset.self_healing_max_retries ?? 2,
      aggregatorSlot: chosenJudge,
      callLlm,
      userPrompt,
      promotedFiles,
      checkpoint: promotedFiles.checkpoint || null,
      promoteOpts,
      onProgress,
      signal,
      execFn,
    })
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

  emitEvent(ctx, MOA_EVENTS.JUDGE_VERDICT, {
    runId,
    winningIndex,
    winningModel: winnerModel,
    scores: fileScores || multiJudgeResult?.scores || null,
  })

  try {
    await recordMoaRunAsync({
      id: runId, cwd, prompt: userPrompt, category: classifyEloCategory(userPrompt), preset: preset?.name || 'default', isRefinement,
      candidates: candidatesForHistory(referenceOutputs),
      aggregator: { provider: chosenJudge.provider, model: chosenJudge.model, usage: aggUsage, costUsd: aggUsage.costUsd },
      winnerIndex: winningIndex, winnerModel, promotedFiles, benchmarkReport, consensus: multiJudgeResult,
      fileScores, totalTokens: usageSummary.totalTokens, totalCostUsd: usageSummary.totalCostUsd, durationMs,
    }, historyFilePath || undefined)
  } catch (histErr) {
    logger.warn('[dsh-moa] Failed to record run in history:', histErr)
  }

  // Consensus Knowledge Graph Recording (#322)
  try {
    await recordConsensusDecision({
      runId,
      prompt: userPrompt,
      winnerModel,
      winningApproach: synthesizedText?.slice(0, 1000),
      verdict: multiJudgeResult?.summary || multiJudgeResult?.verdict || `Selected candidate #${winningIndex}`,
      rejectedReasons: (referenceOutputs || [])
        .filter((_, idx) => idx + 1 !== winningIndex)
        .map((r) => `${r.label || 'Candidate'}: ${r.critique || 'Not selected as primary baseline'}`),
      ctx,
      config: preset || {},
      filePath: preset?.knowledge_path,
    })
  } catch (knowErr) {
    logger.debug('[dsh-moa] Failed to record consensus in knowledge graph:', knowErr?.message || knowErr)
  }

  emitEvent(ctx, MOA_EVENTS.RUN_FINISH, {
    runId,
    durationMs,
    totalTokens: usageSummary.totalTokens,
    totalCostUsd: usageSummary.totalCostUsd,
    promotedFiles,
    winnerIndex: winningIndex,
  })

  return {
    ok: true,
    payload: {
      kind: 'synthesis', content: synthesizedText, aggregator: isFastMode ? 'Fast Mode (Direct)' : finalAggLabel,
      references: referenceOutputs, presetName: preset?.name || 'default', isRefinement, isFastMode, isCuratorSynthesis,
      recommendedAssembler, winningIndex, winnerModel, promotedFiles, runId, allowCandidateOverride,
      benchmarkReport, consensus: multiJudgeResult, fileScores, ...(selfHealingResult ? { selfHealing: selfHealingResult } : {}), ...(visualResult ? { visualConsensus: visualResult } : {}), ...(livePreview ? { liveCanvas: livePreview } : {}),
      usage: usageSummary, skippedFiles: collectedCtx?.skippedFiles || 0, skippedList: collectedCtx?.skippedList || [], durationMs,
    }
  }
}
