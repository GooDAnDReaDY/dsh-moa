import { applyParetoAdjustment } from './pareto-frontier.js'
import { evaluateHardBudgetLimit } from './budget-guard.js'
import { sanitizeCandidatesForCloudJudge } from './privacy-sanitizer.js'
import { evaluateJudgeEscalation } from './escalation.js'
import { calculateSelfConsistencyAgreement } from './self-consistency.js'
import { pruneCandidateEnsemble, formatPruningDirective } from './context-pruner.js'
import { buildAstCompositeMergeDirective } from '../moa-ast-merge.js'
import { runVisualMoaConsensus, isVisualUiTask } from '../moa-visual-consensus.js'
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
import { runSecurityAuditGate } from './security-fuzzer.js'
import { runCoveVerificationGate } from './cove-verifier.js'
import { runProfilerGate } from './runtime-profiler.js'
import { runMutationGate } from './mutation-tester.js'
import { stageEmbeddingClustering } from './embedding-clustering.js'
import { runRebuttalDebatePhase } from './rebuttal-debate.js'
import { runGitTournamentGate } from './git-tournament.js'
import { runCouncilArbitrationGate } from './role-council.js'
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

  // Pre-Stage 0.5: Pareto Frontier Slider & Hard Budget Guard (#307, #319)
  let effectivePreset = preset
  if (effectivePreset?.pareto_slider_enabled) {
    effectivePreset = applyParetoAdjustment(effectivePreset, { ctx, runId, onProgress, prices })
  }

  if (effectivePreset?.hard_budget_guard_enabled) {
    const budgetRes = evaluateHardBudgetLimit({
      references: effectivePreset.reference_models || [],
      aggregator: effectivePreset.aggregator || {},
      limitUsd: effectivePreset.hard_budget_limit_usd ?? 0.02,
      policy: effectivePreset.hard_budget_policy || 'auto_downgrade',
      prices,
      options: { ctx, runId, onProgress },
    })
    if (!budgetRes.ok) {
      return { error: new Error(budgetRes.error) }
    }
    if (budgetRes.scaled) {
      effectivePreset = {
        ...effectivePreset,
        reference_models: budgetRes.references,
        aggregator: budgetRes.aggregator,
      }
    }
  }

  // Stage 1: Context & Configuration
  const ctxStage = await stageProjectContext({
    userPrompt, messages, preset: effectivePreset, cwd, prices, maxTokens: effectivePreset?.max_tokens, startTime, onProgress, ctx,
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
  let { referenceOutputs, successfulRefs, adversarialTddResult } = candStage

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

  if (ctxStage.selfConsistencyExpanded && successfulRefs.length > 1) {
    const scAgreement = calculateSelfConsistencyAgreement(successfulRefs)
    if (typeof onProgress === 'function') {
      onProgress(`🎯 *Self-Consistency Agreement: ${(scAgreement.agreementRatio * 100).toFixed(0)}% (${scAgreement.isStrongConsensus ? 'Strong consensus' : 'Divergent sampling'}) across ${scAgreement.sampleCount} samples*\n`)
    }
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

  // Pre-Judge Stage 4.6: Blind Embedding Clustering for Zero-LLM Fast Consensus (#312)
  if ((preset?.embedding_clustering_enabled || preset?.embeddingClusteringEnabled) && successfulRefs.length > 1) {
    const embedRes = await stageEmbeddingClustering({
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
    if (embedRes.consensusReached) {
      return embedRes.payload
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

  // Stage 5.2: Multi-Round Rebuttal Debate between Candidates (#298)
  let debateDirective = null
  if ((preset?.rebuttal_debate_enabled || preset?.rebuttalDebateEnabled) && successfulRefs.length > 1) {
    const debateRes = await runRebuttalDebatePhase({
      candidates: syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      userPrompt,
      preset,
      prices,
      maxTokens: ctxStage.maxTokens,
      isBlindEvaluation: ctxStage.isBlindEvaluation,
      callLlm,
      signal,
      onProgress,
      cwd,
      runId,
      ctx,
    })
    if (debateRes.ok && debateRes.debateDirective) {
      debateDirective = debateRes.debateDirective
      if (debateRes.updatedCandidates?.length > 0) {
        successfulRefs = debateRes.updatedCandidates
        referenceOutputs = referenceOutputs.map((r) => {
          const matching = successfulRefs.find((c) => c.index === r.index || c.label === r.label)
          return matching ? { ...r, text: matching.text } : r
        })
      }
    }
  }

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }

  // Pre-Stage 5.8: Chain-of-Verification (CoVe) Fact-Checking Gate (#314)
  let coveDirective = null
  let coveGateResult = null
  if (preset?.cove_verification_enabled) {
    coveGateResult = runCoveVerificationGate(
      syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      ctxStage,
      {
        ctx,
        runId,
        onProgress,
        maxQuestions: preset.cove_max_questions || 5,
      }
    )
    coveDirective = coveGateResult.coveDirective
  }

  // Pre-Stage 5.9: Adversarial White-Hat Security Fuzzing Gate (#302)
  let securityDirective = null
  let securityGateResult = null
  if (preset?.security_gate_enabled) {
    securityGateResult = runSecurityAuditGate(
      syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      {
        ctx,
        runId,
        onProgress,
        strictVeto: preset.security_gate_strict_veto !== false,
      }
    )
    securityDirective = securityGateResult.securityDirective
  }

  // Pre-Stage 5.10: Runtime CPU & Memory Profiler Gate (#315)
  let profilerDirective = null
  let profilerGateResult = null
  if (preset?.profiler_gate_enabled) {
    profilerGateResult = runProfilerGate(
      syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      {
        ctx,
        runId,
        onProgress,
        iterations: preset.profiler_iterations || 100,
        timeoutMs: preset.profiler_timeout_ms || 2000,
      }
    )
    profilerDirective = profilerGateResult.profilerDirective
  }

  // Pre-Stage 5.11: Mutation Testing & Fault Injection Gate (#316)
  let mutationDirective = null
  let mutationGateResult = null
  if (preset?.mutation_testing_enabled) {
    mutationGateResult = runMutationGate(
      syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      {
        ctx,
        runId,
        onProgress,
        minMutationScore: preset.min_mutation_score ?? 0.70,
      }
    )
    mutationDirective = mutationGateResult.mutationDirective
  }

  // Pre-Stage 5.12: Hybrid Edge Privacy Sanitizer Gate (#306)
  let privacyDirective = null
  let candidatesForJudge = syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs
  let sanitizedReferenceOutputs = referenceOutputs
  if (preset?.hybrid_edge_privacy_enabled || preset?.cloud_judge_sanitization_enabled) {
    const sanitizeResult = sanitizeCandidatesForCloudJudge(candidatesForJudge, {
      ctx,
      runId,
      onProgress,
      redactSecrets: preset.redact_secrets !== false,
      redactPaths: preset.redact_paths !== false,
      redactIps: preset.redact_ips !== false,
    })
    candidatesForJudge = sanitizeResult.sanitizedCandidates
    privacyDirective = sanitizeResult.privacyDirective
    sanitizedReferenceOutputs = referenceOutputs.map((r) => {
      const matching = candidatesForJudge.find((c) => c.index === r.index || c.model === r.model || c.label === r.label)
      if (matching && matching.sanitizedOutput) {
        return { ...r, text: matching.sanitizedOutput, output: matching.sanitizedOutput }
      }
      return r
    })
  }

  // Pre-Stage 5.13: Multi-Branch Git Sandbox Tournament (#304)
  let tournamentDirective = null
  let tournamentGateResult = null
  if (preset?.git_tournament_enabled || preset?.gitTournamentEnabled) {
    tournamentGateResult = await runGitTournamentGate({
      candidates: syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      preset,
      cwd,
      runId,
      signal,
      onProgress,
      ctx,
    })
    tournamentDirective = tournamentGateResult.tournamentDirective
  }

  // Pre-Stage 5.14: Multi-Persona Role-Playing Council Arbitration (#313)
  let councilDirective = null
  let councilGateResult = null
  if (preset?.council_arbitration_enabled || preset?.councilArbitrationEnabled) {
    councilGateResult = runCouncilArbitrationGate(
      syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
      preset,
      {
        ctx,
        runId,
        onProgress,
      }
    )
    councilDirective = councilGateResult.councilDirective
  }

  // Pre-Stage 6: Dynamic Consensus Threshold & Multi-Judge Escalation (#300)
  const escalationResult = evaluateJudgeEscalation({
    candidateOutputs: syntaxResult.validCandidates.length > 0 ? syntaxResult.validCandidates : successfulRefs,
    primaryJudge: ctxStage.primaryJudge,
    fallbackJudges: ctxStage.fallbackJudges,
    escalationJudge: ctxStage.escalationJudge,
    policy: ctxStage.escalationPolicy,
    threshold: ctxStage.escalationDisagreementThreshold,
  })

  let effectivePrimaryJudge = ctxStage.primaryJudge
  let effectiveFallbackJudges = ctxStage.fallbackJudges
  let effectiveJudgesChain = ctxStage.judgesChain

  if (escalationResult.escalated) {
    emitEvent(ctx, MOA_EVENTS.JUDGE_ESCALATION, {
      runId,
      policy: ctxStage.escalationPolicy,
      disagreement: escalationResult.disagreement,
      threshold: escalationResult.threshold,
      escalatedType: escalationResult.escalatedType,
      originalJudge: escalationResult.originalJudge,
      escalatedJudge: escalationResult.judge,
      councilJudges: escalationResult.councilJudges,
    })
    if (typeof onProgress === 'function') {
      onProgress(`⚖️ *Judge Escalation (${escalationResult.escalatedType}): ${escalationResult.reason}*\n`)
    }

    if (escalationResult.escalatedType === 'auto_upgrade') {
      effectivePrimaryJudge = escalationResult.judge
      effectiveFallbackJudges = ctxStage.fallbackJudges.filter(
        (j) => !(j.provider === escalationResult.judge.provider && j.model === escalationResult.judge.model)
      )
      effectiveJudgesChain = [effectivePrimaryJudge, ...effectiveFallbackJudges]
    } else if (escalationResult.escalatedType === 'council_majority') {
      effectivePreset = {
        ...preset,
        multi_judge_enabled: true,
        judge_models: escalationResult.councilJudges,
      }
    }
  }

  // Stage 6: Multi-Judge Panel
  const mjRes = await stageMultiJudge({
    preset: effectivePreset,
    successfulRefs: candidatesForJudge,
    referenceOutputs: sanitizedReferenceOutputs, primaryJudge: effectivePrimaryJudge,
    userPrompt, judgeCriteria: [ctxStage.judgeCriteria, debateDirective, coveDirective, securityDirective, profilerDirective, mutationDirective, privacyDirective, tournamentDirective, councilDirective].filter(Boolean).join('\n\n'), prices, maxTokens: ctxStage.maxTokens,
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
  if (preset?.visual_moa_enabled || (preset?.visual_moa_auto !== false && isVisualUiTask(userPrompt, referenceOutputs))) {
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
  let synthCandidateRefs = candidatesForJudge
  let synthReferenceOutputs = sanitizedReferenceOutputs
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

  const fileScoringDirective = [rawFileDirective, visualResult?.directive, adversarialTddResult?.directive, syntaxDirective, debateDirective, coveDirective, securityDirective, profilerDirective, mutationDirective, privacyDirective, tournamentDirective, councilDirective, pruningDirective, ctxStage.stackAwareDirective, ctxStage.developerPreferencesDirective].filter(Boolean).join("\n\n") || null

  // Stage 7: Synthesis Phase
  const synthRes = await stageSynthesis({
    userPrompt,
    referenceOutputs: synthReferenceOutputs,
    successfulRefs: synthCandidateRefs,
    judgeCriteria: ctxStage.judgeCriteria,
    isCuratorSynthesis: ctxStage.isCuratorSynthesis, isBlindEvaluation: ctxStage.isBlindEvaluation,
    priorTurnBaseline: ctxStage.priorTurnBaseline, compositeMergeDirective, fileScoringDirective,
    multiJudgeResult, preset: effectivePreset, prices, maxTokens: ctxStage.maxTokens, isFastMode: ctxStage.isFastMode,
    primaryJudge: effectivePrimaryJudge, fallbackJudges: effectiveFallbackJudges,
    judgesChain: effectiveJudgesChain, aggTemp: ctxStage.aggTemp,
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

