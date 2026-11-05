import { pruneCandidateEnsemble, formatPruningDirective } from './context-pruner.js'
import { buildAstCompositeMergeDirective } from '../moa-ast-merge.js'
import { runVisualMoaConsensus } from '../moa-visual-consensus.js'
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
import { applySyntaxFilter, formatSyntaxDirective } from './syntax-filter.js'
import { stageEarlyConsensus } from './early-consensus.js'
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
    semanticCacheEnabled: ctxStage.semanticCacheEnabled,
    semanticCacheTtlHours: ctxStage.semanticCacheTtlHours,
    ctx,
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
  const { referenceOutputs, successfulRefs, adversarialTddResult } = candStage

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

  // Pre-Judge Stage 2.5: Zero-Token Local Syntax Gate (#303)
  const syntaxResult = applySyntaxFilter(successfulRefs, { enabled: ctxStage.localPreflightCheck })
  emitEvent(ctx, MOA_EVENTS.SYNTAX_VALIDATION, {
    runId,
    filterApplied: syntaxResult.filterApplied,
    validCount: syntaxResult.validCandidates.length,
    invalidCount: syntaxResult.invalidCandidates.length,
  })
  const syntaxDirective = syntaxResult.filterApplied ? formatSyntaxDirective(referenceOutputs, { blind: ctxStage.isBlindEvaluation }) : null

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
      successfulRefs: syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      referenceOutputs,
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

  // Pre-Judge Stage 4.5: Early Exit upon Semantic Consensus (#299)
  if (ctxStage.earlyExitConsensusEnabled && successfulRefs.length > 1) {
    const earlyRes = await stageEarlyConsensus({
      successfulRefs: syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      referenceOutputs,
      preset,
      userPrompt,
      prices,
      maxTokens: ctxStage.maxTokens,
      cwd,
      runId,
      signal,
      promoteOpts,
      allowCandidateOverride: ctxStage.allowCandidateOverride,
      isRefinement: ctxStage.isRefinement,
      historyFilePath,
      startTime,
      collectedCtx: ctxStage.collectedCtx,
      liveCanvas,
      ctx,
    })
    if (earlyRes.consensusReached) {
      return earlyRes.payload
    }
  }

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }

  // Stage 5: Consilium Round 2 (Peer Critique)
  const peerRes = await stagePeerCritique({
    isPeerCritiqueEnabled: ctxStage.isPeerCritiqueEnabled,
    successfulRefs: syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
    referenceOutputs, preset, prices,
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
    preset,
    successfulRefs: syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
    referenceOutputs, primaryJudge: ctxStage.primaryJudge,
    userPrompt, judgeCriteria: ctxStage.judgeCriteria, prices, maxTokens: ctxStage.maxTokens,
    callLlm, signal, onProgress, cwd, runId, isRefinement: ctxStage.isRefinement,
    isFastMode: ctxStage.isFastMode, collectedCtx: ctxStage.collectedCtx, startTime,
  })
  if (!mjRes.ok) return mjRes.abortPayload
  const multiJudgeResult = mjRes.multiJudgeResult

  let compositeMergeDirective = null
  if (preset?.ast_composite_merge_enabled && successfulRefs.length > 1) {
    const astMerge = await buildAstCompositeMergeDirective(successfulRefs, { ctx, blind: Boolean(preset.blind_evaluation) })
    compositeMergeDirective = astMerge.directive
  } else if (preset?.composite_merge_enabled && successfulRefs.length > 1) {
    compositeMergeDirective = buildCompositeBlockDirectives(successfulRefs, { blind: Boolean(preset.blind_evaluation) })
  }
  let visualResult = null
  if (preset?.visual_moa_enabled) {
    visualResult = await runVisualMoaConsensus({
      ctx,
      liveCanvas,
      userPrompt,
      referenceOutputs,
      onProgress,
    })
  }
  const rawFileDirective = (preset?.interactive_workbench_enabled)
    ? formatFileScoresDirective()
    : null

  // Pre-Judge Stage 6.8: Cross-Candidate Unchanged Base Context Pruning (#305)
  let synthCandidateRefs = syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs
  let synthReferenceOutputs = referenceOutputs
  let pruningDirective = null
  if (ctxStage.contextPruningEnabled && ctxStage.collectedCtx?.files?.length > 0) {
    const pruneRes = pruneCandidateEnsemble(synthCandidateRefs, ctxStage.collectedCtx.files, {
      enabled: true,
      contextLines: ctxStage.contextPruningDiffLines,
    })
    if (pruneRes.isPruned) {
      synthCandidateRefs = pruneRes.candidates
      const prunedByLabel = new Map(synthCandidateRefs.map((c) => [c.label, c.text]))
      synthReferenceOutputs = referenceOutputs.map((r) => {
        if (prunedByLabel.has(r.label)) {
          return { ...r, text: prunedByLabel.get(r.label) }
        }
        return r
      })
      pruningDirective = formatPruningDirective(pruneRes.prunedFiles, pruneRes.totalSavedTokens)
      emitEvent(ctx, MOA_EVENTS.CONTEXT_PRUNING, {
        runId,
        savedTokens: pruneRes.totalSavedTokens,
        prunedFiles: pruneRes.prunedFiles,
      })
      if (typeof onProgress === 'function') {
        onProgress(`✂️ *Context Pruning: Reduced ~${pruneRes.totalSavedTokens} prompt tokens across ${pruneRes.prunedFiles.length} file block(s)*\n`)
      }
    }
  }

  const fileScoringDirective = [rawFileDirective, visualResult?.directive, adversarialTddResult?.directive, syntaxDirective, pruningDirective].filter(Boolean).join("\n\n") || null

  // Stage 7: Synthesis Phase
  const synthRes = await stageSynthesis({
    userPrompt,
    referenceOutputs: synthReferenceOutputs,
    successfulRefs: synthCandidateRefs,
    judgeCriteria: ctxStage.judgeCriteria,
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
    synthesizedText, referenceOutputs,
    successfulRefs: syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
    multiJudgeResult,
    isCuratorSynthesis: ctxStage.isCuratorSynthesis,
    allowCandidateOverride: ctxStage.allowCandidateOverride,
    promoteOpts, cwd, runId, signal, liveCanvas, startTime, chosenJudge, aggUsage,
    userPrompt, preset, isRefinement: ctxStage.isRefinement, isFastMode: ctxStage.isFastMode,
    effectiveReferences: ctxStage.effectiveReferences, referenceModels: ctxStage.referenceModels,
    historyFilePath, collectedCtx: ctxStage.collectedCtx, ctx, callLlm, onProgress, execFn, visualResult,
  })
  if (!promRes.ok) {
    if (promRes.abort) return { error: promRes.error }
    throw promRes.error
  }
  return promRes.payload
}

