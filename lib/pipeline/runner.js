import crypto from 'node:crypto'
import { isTestEnvironment } from '../history.js'
import { cleanMoaWorkspaces } from '../workspace/fs.js'
import { buildCompositeBlockDirectives } from '../moa-multi-judge.js'
import { formatFileScoresDirective } from '../moa-workbench.js'
import { stageProjectContext } from './context.js'
import { stageCandidateRound1 } from './candidates.js'
import { stageClarifyingQuestions } from './questions.js'
import { stageFastMode } from './fast-mode.js'
import { stagePeerCritique } from './peer-critique.js'
import { stageMultiJudge } from './multi-judge.js'
import { stageSynthesis } from './synthesis.js'
import { stagePromotion } from './promotion.js'
import { emitEvent, MOA_EVENTS } from '../events.js'

export async function runMoAPipeline({
  userPrompt,
  messages = [],
  preset,
  callLlm,
  cwd = process.cwd(), prices = {}, onProgress = null,
  historyFilePath = null, liveCanvas = null, onStreamDelta = null, signal = null,
  testGateEnabled = null, testCommand = null, execFn = null,
  webServerPort = null, timeMachineEngine = null, timeMachineUrl = null,
  force = isTestEnvironment() ? true : false, checkpoint = true, checkpointFn = null, runId: customRunId = null,
  ctx = null,
}) {
  const runId = (customRunId && String(customRunId).trim()) || crypto.randomUUID()
  const promoteOpts = { webServerPort, timeMachineEngine, timeMachineUrl, force: Boolean(force), checkpoint, checkpointFn, signal }
  if (signal?.aborted) return { error: new Error('Turn aborted') }
  const startTime = Date.now()

  emitEvent(ctx, MOA_EVENTS.RUN_START, {
    runId,
    prompt: userPrompt,
    preset: preset?.name || preset?.id || 'default',
    candidatesCount: Array.isArray(preset?.references) ? preset.references.length : 0,
    timestamp: new Date(startTime).toISOString(),
  })

  // Stage 1: Context & Configuration
  const ctxStage = await stageProjectContext({
    userPrompt, messages, preset, cwd, prices, maxTokens: preset?.max_tokens, startTime, onProgress, ctx,
  })
  if (!ctxStage.ok) return ctxStage.abortPayload

  // Stage 2: Parallel Candidate Fan-out & Test Gate
  const candStage = await stageCandidateRound1({
    effectiveReferences: ctxStage.effectiveReferences,
    enrichedMessages: ctxStage.enrichedMessages,
    candidateSystemPrompt: ctxStage.candidateSystemPrompt,
    refTemp: ctxStage.refTemp,
    preset, maxTokens: ctxStage.maxTokens, prices,
    refTimeoutSec: ctxStage.refTimeoutSec,
    isQuorumEnabled: ctxStage.isQuorumEnabled,
    gracePeriodSec: ctxStage.gracePeriodSec,
    candidateRetries: ctxStage.candidateRetries,
    signal, callLlm, onProgress, cwd, runId, startTime,
    primaryJudge: ctxStage.primaryJudge,
    isRefinement: ctxStage.isRefinement,
    isFastMode: ctxStage.isFastMode,
    collectedCtx: ctxStage.collectedCtx,
    testGateEnabled, testCommand, execFn,
  })
  if (!candStage.ok) {
    if (candStage.abort) return { error: candStage.error }
    emitEvent(ctx, MOA_EVENTS.RUN_FINISH, {
      runId,
      durationMs: Date.now() - startTime,
      totalTokens: candStage.failurePayload?.usage?.totalTokens || 0,
      totalCostUsd: candStage.failurePayload?.usage?.totalCostUsd || 0,
      promotedFiles: [],
      winnerIndex: 0,
      error: candStage.failurePayload?.content,
    })
    return candStage.failurePayload
  }
  const { referenceOutputs, successfulRefs } = candStage

  for (const ref of referenceOutputs) {
    emitEvent(ctx, MOA_EVENTS.CANDIDATE_COMPLETE, {
      runId,
      round: 1,
      model: ref.model || ref.label,
      success: Boolean(ref.ok),
      durationMs: ref.durationMs || 0,
      tokens: ref.usage?.totalTokens || 0,
    })
  }

  // Stage 3: Clarifying Questions Branch
  if (ctxStage.needsQuestions) {
    return await stageClarifyingQuestions({
      userPrompt, referenceOutputs, primaryJudge: ctxStage.primaryJudge,
      aggTimeoutSec: ctxStage.aggTimeoutSec, prices, callLlm, cwd, runId,
      preset, isRefinement: ctxStage.isRefinement, isFastMode: ctxStage.isFastMode,
      collectedCtx: ctxStage.collectedCtx, startTime, historyFilePath, onProgress,
    })
  }

  // Stage 4: Fast Mode (1 candidate bypass)
  if (ctxStage.isFastMode) {
    const fastRes = await stageFastMode({
      successfulRefs, referenceOutputs,
      allowCandidateOverride: ctxStage.allowCandidateOverride,
      promoteOpts, cwd, runId, signal, userPrompt, preset,
      isRefinement: ctxStage.isRefinement, historyFilePath, startTime,
      collectedCtx: ctxStage.collectedCtx, liveCanvas, ctx,
    })
    if (!fastRes.ok) {
      if (fastRes.abort) return { error: fastRes.error }
      return fastRes.payload
    }
    return fastRes.payload
  }

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }

  // Stage 5: Consilium Round 2 (Peer Critique)
  const peerRes = await stagePeerCritique({
    isPeerCritiqueEnabled: ctxStage.isPeerCritiqueEnabled,
    successfulRefs, referenceOutputs, preset, prices,
    maxTokens: ctxStage.maxTokens, primaryJudge: ctxStage.primaryJudge,
    userPrompt, isBlindEvaluation: ctxStage.isBlindEvaluation,
    refTemp: ctxStage.refTemp, refTimeoutSec: ctxStage.refTimeoutSec,
    candidateRetries: ctxStage.candidateRetries, signal, callLlm, onProgress,
    cwd, runId, isRefinement: ctxStage.isRefinement, isFastMode: ctxStage.isFastMode,
    collectedCtx: ctxStage.collectedCtx, startTime,
    options: { testGateEnabled, testCommand, execFn },
  })
  if (!peerRes.ok) return peerRes.abortPayload
  if (ctxStage.isPeerCritiqueEnabled && peerRes.ok && peerRes.critiquesCount > 0) {
    emitEvent(ctx, MOA_EVENTS.CRITIQUE_COMPLETE, {
      runId,
      critiquesCount: peerRes.critiquesCount,
    })
  }

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }

  // Stage 6: Multi-Judge Panel
  const mjRes = await stageMultiJudge({
    preset, successfulRefs, referenceOutputs, primaryJudge: ctxStage.primaryJudge,
    userPrompt, judgeCriteria: ctxStage.judgeCriteria, prices, maxTokens: ctxStage.maxTokens,
    callLlm, signal, onProgress, cwd, runId, isRefinement: ctxStage.isRefinement,
    isFastMode: ctxStage.isFastMode, collectedCtx: ctxStage.collectedCtx, startTime,
  })
  if (!mjRes.ok) return mjRes.abortPayload
  const multiJudgeResult = mjRes.multiJudgeResult

  const compositeMergeDirective = (preset?.composite_merge_enabled && successfulRefs.length > 1)
    ? buildCompositeBlockDirectives(successfulRefs, { blind: Boolean(preset.blind_evaluation) })
    : null
  const fileScoringDirective = (preset?.interactive_workbench_enabled)
    ? formatFileScoresDirective()
    : null

  // Stage 7: Synthesis Phase
  const synthRes = await stageSynthesis({
    userPrompt, referenceOutputs, successfulRefs, judgeCriteria: ctxStage.judgeCriteria,
    isCuratorSynthesis: ctxStage.isCuratorSynthesis, isBlindEvaluation: ctxStage.isBlindEvaluation,
    priorTurnBaseline: ctxStage.priorTurnBaseline, compositeMergeDirective, fileScoringDirective,
    multiJudgeResult, preset, prices, maxTokens: ctxStage.maxTokens, isFastMode: ctxStage.isFastMode,
    primaryJudge: ctxStage.primaryJudge, fallbackJudges: ctxStage.fallbackJudges,
    judgesChain: ctxStage.judgesChain, aggTemp: ctxStage.aggTemp,
    aggTimeoutSec: ctxStage.aggTimeoutSec, isStreamAggregator: ctxStage.isStreamAggregator,
    onStreamDelta, signal, callLlm, onProgress, cwd, runId, isRefinement: ctxStage.isRefinement,
    collectedCtx: ctxStage.collectedCtx, startTime,
  })
  if (!synthRes.ok) return synthRes.abortPayload
  const { synthesizedText, chosenJudge, aggUsage } = synthRes

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }

  // Stage 8: Evaluation, Winner & Promotion
  const promRes = await stagePromotion({
    synthesizedText, referenceOutputs, successfulRefs, multiJudgeResult,
    isCuratorSynthesis: ctxStage.isCuratorSynthesis,
    allowCandidateOverride: ctxStage.allowCandidateOverride,
    promoteOpts, cwd, runId, signal, liveCanvas, startTime, chosenJudge, aggUsage,
    userPrompt, preset, isRefinement: ctxStage.isRefinement, isFastMode: ctxStage.isFastMode,
    effectiveReferences: ctxStage.effectiveReferences, referenceModels: ctxStage.referenceModels,
    historyFilePath, collectedCtx: ctxStage.collectedCtx, ctx, callLlm, onProgress, execFn,
  })
  if (!promRes.ok) {
    if (promRes.abort) return { error: promRes.error }
    throw promRes.error
  }
  return promRes.payload
}
