import { logger } from './logger.js'
import crypto from 'node:crypto'
import { extractFileBlocks, collectProjectContext, formatProjectContext, isRefinementTask, writeCandidateWorkspace, promoteCandidateWorkspace, cleanMoaWorkspaces, verifyFileSyntax } from './file-workspace.js'
import { estimateTokenCost, summarizeMoAUsage } from './pricing.js'
import { recordMoaRunAsync, candidatesForHistory, isTestEnvironment } from './history.js'
import { createPromotedPreview } from './live-canvas.js'
import { slotLabel, isBroadPromptRequiringQuestions, buildQuestionSynthesisPrompt, buildSynthesisPrompt, buildPeerCritiquePrompt } from './moa-prompts.js'
import { parseWinnerIndex, parseRecommendedAssembler } from './moa-parser.js'
import { REFERENCE_SYSTEM_PROMPT, callWithTransientRetry, runReferencesParallel } from './moa-candidates.js'
import { executeTestGateForCandidates } from './moa-test-gate.js'
import { executeMultiJudgePanel, buildCompositeBlockDirectives, runMultiJudgePhase } from './moa-multi-judge.js'
import { applyBudgetGuardrails, checkPhaseBudget, estimateRound2Cost, estimateDownstreamCost, calcSynthesisPromptTokens, createBudgetAbortPayload } from './moa-budget.js'
import { extractPriorTurnBaseline, pruneMultiTurnMessages } from './moa-context.js'
import { generateMoABenchmarkReport } from './moa-report.js'
// Re-exports for consumers & backward compatibility
export { slotLabel, cleanAdvisoryMessages, isBroadPromptRequiringQuestions, buildQuestionSynthesisPrompt, buildCuratorSynthesisPrompt, buildSynthesisPrompt, ANTIPATTERNS_RUBRIC } from './moa-prompts.js'
export { parseWinnerIndex, parseRecommendedAssembler, parseMoACommand, stripOrSummarizeCode, formatMoAResponse } from './moa-parser.js'
export { estimateTokenCost, summarizeMoAUsage } from './pricing.js'
export { REFERENCE_SYSTEM_PROMPT, callWithTransientRetry, runReferencesParallel } from './moa-candidates.js'
export { executeTestGateForCandidates, runCandidateTestGate } from './moa-test-gate.js'
export { streamMoATurn, streamPromoteTurn } from './moa-stream.js'
/**
 * Executes the full Mixture of Agents pipeline.
 */
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
}) {
  const runId = (customRunId && String(customRunId).trim()) || crypto.randomUUID()
  const promoteOpts = { webServerPort, timeMachineEngine, timeMachineUrl, force: Boolean(force), checkpoint, checkpointFn, signal }
  if (signal?.aborted) return { error: new Error('Turn aborted') }
  const startTime = Date.now()
  // 1. Resolve configurations
  const referenceModels = Array.isArray(preset?.reference_models) && preset.reference_models.length > 0
    ? preset.reference_models : [{ provider: '', model: '' }]
  const primaryJudge = preset?.aggregator?.provider && preset?.aggregator?.model
    ? preset.aggregator : { provider: '', model: '' }
  const fallbackJudges = Array.isArray(preset?.aggregator_fallbacks) ? preset.aggregator_fallbacks : []
  const judgesChain = [primaryJudge, ...fallbackJudges]
  const refTemp = typeof preset?.reference_temperature === 'number' ? preset.reference_temperature : 0.6
  const aggTemp = typeof preset?.aggregator_temperature === 'number' ? preset.aggregator_temperature : 0.4
  const maxTokens = typeof preset?.max_tokens === 'number' ? preset.max_tokens : 4096
  const judgeCriteria = preset?.judge_criteria || ''
  let isFastMode = referenceModels.length === 1 && !preset?.curator_synthesis
  const isCuratorSynthesis = Boolean(preset?.curator_synthesis), isStreamAggregator = preset?.stream_aggregator !== false
  const isQuorumEnabled = Boolean(preset?.quorum_enabled), gracePeriodSec = typeof preset?.grace_period_sec === 'number' ? preset.grace_period_sec : 10
  const candidateRetries = 1, refTimeoutSec = typeof preset?.reference_timeout_sec === 'number' ? preset.reference_timeout_sec : 60
  const aggTimeoutSec = typeof preset?.aggregator_timeout_sec === 'number' ? preset.aggregator_timeout_sec : 180
  const isBlindEvaluation = Boolean(preset?.blind_evaluation), isPeerCritiqueEnabled = Boolean(preset?.peer_critique_enabled)
  const allowCandidateOverride = Boolean(preset?.allow_candidate_override)
  // 1. Collect project context for refinement tasks
  const collectedCtx = await collectProjectContext(cwd, 16000)
  const isRefinement = Boolean(collectedCtx?.files?.length > 0 && isRefinementTask(userPrompt, collectedCtx.files))
  let projectContext = ''
  if (collectedCtx?.skippedFiles > 0 && typeof onProgress === 'function') {
    const preview = collectedCtx.skippedList.slice(0, 3).join(', ')
    const more = collectedCtx.skippedList.length > 3 ? ` (+${collectedCtx.skippedList.length - 3})` : ''
    onProgress(`⚠️ *Workspace scan note: ${collectedCtx.skippedFiles} file(s) skipped (${preview}${more})*\n`)
  }
  if (isRefinement) {
    if (typeof onProgress === 'function') {
      onProgress('🔍 *Reading project files for refinement context...*\n')
    }
    projectContext = formatProjectContext(collectedCtx.files, {
      skippedFiles: collectedCtx.skippedFiles,
      skippedList: collectedCtx.skippedList,
    })
  }
  // 2. Budget Guardrail check
  const budgetCheck = applyBudgetGuardrails({
    references: referenceModels,
    enabled: preset?.budget_guard_enabled,
    maxBudgetUsd: preset?.max_budget_usd,
    action: preset?.budget_action || 'trim',
    prices,
    promptLength: (userPrompt?.length || 1000) + (judgeCriteria?.length || 0) + (projectContext ? projectContext.length : 0),
    judgeCriteria,
    projectContext,
    messages,
    maxTokens,
    peerCritiqueEnabled: isPeerCritiqueEnabled,
    aggregator: primaryJudge,
    judgeModels: preset?.multi_judge_enabled ? preset?.judge_models : [],
  })
  if (!budgetCheck.allowed) {
    return createBudgetAbortPayload({ reason: budgetCheck.reason, primaryJudge, referenceOutputs: [], currentSpentUsd: 0, preset, isRefinement, isFastMode, collectedCtx, startTime })
  }
  const effectiveReferences = budgetCheck.references
  if (effectiveReferences.length === 1 && !preset?.curator_synthesis) {
    isFastMode = true
  }
  if (budgetCheck.action === 'trim' && typeof onProgress === 'function') {
    onProgress(`✂️ *${budgetCheck.reason}*\n`)
  }
  // 3. Build prompts & Feature 8 multi-turn context
  const priorTurnBaseline = preset?.multi_turn_enabled !== false ? extractPriorTurnBaseline(messages) : null
  const prunedHistory = preset?.multi_turn_enabled !== false ? pruneMultiTurnMessages(messages) : messages
  const candidateSystemPrompt = projectContext
    ? `${REFERENCE_SYSTEM_PROMPT}\n\n### Current Project Files & Context:\n${projectContext}`
    : REFERENCE_SYSTEM_PROMPT
  const askClarifyingQuestions = preset?.ask_clarifying_questions !== false
  const needsQuestions = askClarifyingQuestions && isBroadPromptRequiringQuestions(userPrompt, messages)
  const enrichedMessages = [...prunedHistory, { role: 'user', content: userPrompt }]
  // 4. Parallel fan-out to candidate models with temperature gradient & local fallback
  const referenceOutputs = await runReferencesParallel(
    effectiveReferences,
    enrichedMessages,
    {
      systemPrompt: candidateSystemPrompt,
      temperature: refTemp,
      temperature_gradient_enabled: Boolean(preset?.temperature_gradient_enabled),
      local_fallback_enabled: Boolean(preset?.local_fallback_enabled),
      local_fallback_models: preset?.local_fallback_models || [],
      maxTokens,
      prices,
      timeoutSec: refTimeoutSec,
      quorumEnabled: isQuorumEnabled,
      gracePeriodSec,
      maxRetries: candidateRetries,
      signal,
    },
    callLlm,
    onProgress
  )
  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }
  // Fail fast if all candidates failed
  const successfulRefs = referenceOutputs.filter((r) => r.ok)
  if (successfulRefs.length === 0) {
    const reasons = referenceOutputs.map((r) => `${r.label}: ${r.error || 'unknown error'}`).join('; ')
    const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0)
    const totalCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0)).toFixed(5))
    return {
      kind: 'failure', content: `⚠️ All advisor models (${referenceOutputs.length}) failed: ${reasons}`,
      aggregator: slotLabel(primaryJudge), references: referenceOutputs, presetName: preset?.name || 'default',
      isRefinement, isFastMode, winningIndex: 0, winnerModel: 'none', promotedFiles: [],
      usage: { totalTokens, totalCostUsd, candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })), aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 } },
      skippedFiles: collectedCtx?.skippedFiles || 0, skippedList: collectedCtx?.skippedList || [], durationMs: Date.now() - startTime,
    }
  }
  // 5. Extract file blocks & write candidate workspaces
  for (let i = 0; i < referenceOutputs.length; i++) {
    const ref = referenceOutputs[i]
    if (!ref.ok) continue
    const files = extractFileBlocks(ref.text)
    ref.files = files
    if (files.length > 0) {
      ref.syntaxWarning = (verifyFileSyntax(files) || []).map((w) => `${w.file}: ${w.error}`).join('; ')
      await writeCandidateWorkspace(cwd, i + 1, files, { runId })
    }
  }
  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }
  // 5b. Test Execution Gate
  await executeTestGateForCandidates({
    cwd,
    referenceOutputs,
    preset,
    options: { testGateEnabled, testCommand, execFn, runId },
    onProgress,
  })
  // 6. Questionnaire synthesis branch
  if (needsQuestions) {
    if (typeof onProgress === 'function') {
      onProgress('📋 *Judge synthesizes the clarification questionnaire...*\n')
    }
    const questionPrompt = buildQuestionSynthesisPrompt(userPrompt, referenceOutputs)
    let questionsContent = ''
    let qUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
    try {
      const qRes = await callWithTransientRetry(callLlm, {
        provider: primaryJudge.provider,
        model: primaryJudge.model,
        messages: [{ role: 'user', content: questionPrompt }],
        temperature: 0.3,
        maxTokens: 2048,
        timeoutMs: aggTimeoutSec * 1000,
      }, 1)
      questionsContent = typeof qRes === 'string' ? qRes : (qRes?.content || qRes?.text || '')
      const qFallbackUsage = (typeof qRes === 'object' && qRes?.usage) ? qRes.usage : {
        inputTokens: Math.max(1, Math.round(questionPrompt.length / 4)),
        outputTokens: Math.max(1, Math.round(questionsContent.length / 4)),
      }
      qUsage = estimateTokenCost(primaryJudge, qFallbackUsage, prices)
    } catch (err) {
      logger.warn('[dsh-moa] Questionnaire synthesis failed, proceeding with fallback questions:', err)
      questionsContent = `### Clarification of Requirements: "${userPrompt}"\n\n1. **Architecture & Scope**: Single-file deliverable or multi-module project structure?\n2. **Design & Style**: Minimalist, dark mode, or clean neutral theme?\n3. **Functional Priorities**: Core MVP or comprehensive extended implementation?\n\n*Reply with your preferences (e.g. "1, 2") or proceed with defaults.*`
    }
    await cleanMoaWorkspaces(cwd, { runId })
    const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0) + qUsage.totalTokens
    const totalCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + qUsage.costUsd).toFixed(5))
    const durationMs = Date.now() - startTime
    try {
      await recordMoaRunAsync({
        cwd,
        prompt: userPrompt,
        preset: preset?.name || 'default',
        isRefinement,
        candidates: candidatesForHistory(referenceOutputs),
        aggregator: { provider: primaryJudge.provider, model: primaryJudge.model, usage: qUsage, costUsd: qUsage.costUsd },
        winnerIndex: -1,
        winnerModel: 'none',
        promotedFiles: [],
        totalTokens,
        totalCostUsd,
        durationMs,
      }, historyFilePath || undefined)
    } catch (histErr) {
      logger.warn('[dsh-moa] Failed to record questionnaire run in history:', histErr?.message || histErr)
    }
    return {
      kind: 'questions', content: questionsContent, aggregator: slotLabel(primaryJudge),
      references: referenceOutputs, presetName: preset?.name || 'default', isRefinement, isFastMode,
      winningIndex: 0, winnerModel: 'none', promotedFiles: [],
      usage: { totalTokens, totalCostUsd, candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })), aggregator: qUsage },
      skippedFiles: collectedCtx?.skippedFiles || 0, skippedList: collectedCtx?.skippedList || [], durationMs,
    }
  }

  // 7. Fast Mode (1 candidate, bypass judge)
  if (isFastMode) {
    if (signal?.aborted) {
      await cleanMoaWorkspaces(cwd, { runId })
      return { error: new Error('Turn aborted') }
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
        return { error: new Error('Turn aborted') }
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
      return {
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

    return {
      kind: 'synthesis', content: single.text, aggregator: 'Fast Mode (Direct)', references: referenceOutputs,
      presetName: preset?.name || 'default', isRefinement, isFastMode: true, winningIndex: single.index,
      winnerModel: single.label, promotedFiles, runId, ...(livePreview ? { liveCanvas: livePreview } : {}),
      usage: { totalTokens, totalCostUsd, candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })), aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 } },
      skippedFiles: collectedCtx?.skippedFiles || 0, skippedList: collectedCtx?.skippedList || [], durationMs,
    }
  }

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }

  // 7b. Consilium Round 2 (Peer Critique) if enabled
  let runRound2 = isPeerCritiqueEnabled && successfulRefs.length > 1
  if (runRound2 && preset?.budget_guard_enabled && preset?.max_budget_usd > 0) {
    const currentSpent = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0)
    const r2Next = estimateRound2Cost(successfulRefs, prices, maxTokens)
    const downNext = estimateDownstreamCost(primaryJudge, preset?.judge_models, successfulRefs.length, prices, maxTokens)
    const phaseCheck = checkPhaseBudget({ phaseName: 'Consilium Round 2', currentSpentUsd: currentSpent, nextPhaseCostUsd: r2Next + downNext, maxBudgetUsd: preset.max_budget_usd, action: preset.budget_action || 'trim', enabled: true })
    if (!phaseCheck.allowed) {
      if (phaseCheck.action === 'abort') {
        await cleanMoaWorkspaces(cwd, { runId })
        return createBudgetAbortPayload({ reason: phaseCheck.reason, primaryJudge, referenceOutputs, currentSpentUsd: currentSpent, preset, isRefinement, isFastMode, collectedCtx, startTime })
      }
      runRound2 = false
      if (typeof onProgress === 'function') {
        onProgress(`✂️ *Skipping Round 2 to stay within budget ($${preset.max_budget_usd.toFixed(4)})*\n`)
      }
    }
  }

  if (runRound2) {
    if (typeof onProgress === 'function') {
      onProgress('🤝 *Consilium Round 2: Candidates reviewing peer proposals in parallel...*\n')
    }
    const r2Promises = successfulRefs.map(async (cand) => {
      const opponents = successfulRefs
        .filter((c) => c.index !== cand.index)
        .map((c) => ({
          label: isBlindEvaluation ? `Candidate ${c.index}` : c.label,
          role_persona: c.role_persona || c.slot?.role_persona,
          text: c.text,
        }))
      const r2Prompt = buildPeerCritiquePrompt(userPrompt, cand.text, opponents, isBlindEvaluation)
      try {
        const slot = cand.slot || { provider: cand.provider, model: cand.model }
        const res = await callWithTransientRetry(callLlm, {
          provider: slot.provider,
          model: slot.model,
          messages: [{ role: 'user', content: r2Prompt }],
          temperature: refTemp,
          maxTokens,
          timeoutMs: refTimeoutSec * 1000,
          signal,
        }, candidateRetries)
        const refinedText = typeof res === 'string' ? res : (res?.content || res?.text || cand.text)
        cand.text = refinedText
        const r2Files = extractFileBlocks(refinedText)
        if (r2Files.length > 0) {
          cand.files = r2Files
          cand.syntaxWarning = (verifyFileSyntax(r2Files) || []).map((w) => `${w.file}: ${w.error}`).join('; ')
          await writeCandidateWorkspace(cwd, cand.index, r2Files, { runId })
        }
        if (typeof res === 'object' && res?.usage) {
          cand.usage.inputTokens = (cand.usage.inputTokens || 0) + (res.usage.inputTokens || 0)
          cand.usage.outputTokens = (cand.usage.outputTokens || 0) + (res.usage.outputTokens || 0)
          cand.usage.totalTokens = (cand.usage.totalTokens || 0) + (res.usage.totalTokens || 0)
          const extraCost = estimateTokenCost(slot, res.usage, prices)
          cand.costUsd = Number(((cand.costUsd || 0) + extraCost.costUsd).toFixed(5))
        }
      } catch (r2Err) {
        logger.warn(`[dsh-moa] Round 2 peer critique failed for candidate ${cand.index}:`, r2Err?.message || r2Err)
      }
    })
    await Promise.allSettled(r2Promises)
    await executeTestGateForCandidates({
      cwd,
      referenceOutputs: successfulRefs,
      preset,
      options: { testGateEnabled, testCommand, execFn, runId },
      onProgress,
    })
  }

  // 7c. Feature 2: Multi-Judge Panel & Consensus Voting
  let multiJudgeResult = null
  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }

  const currentRefSpent = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0)
  const panelPhase = await runMultiJudgePhase({
    preset, successfulRefs, primaryJudge, userPrompt, judgeCriteria, prices, maxTokens, callLlm, signal, onProgress, currentSpent: currentRefSpent,
  })
  if (panelPhase.abort) {
    await cleanMoaWorkspaces(cwd, { runId })
    return createBudgetAbortPayload({ reason: panelPhase.reason, primaryJudge, referenceOutputs, currentSpentUsd: currentRefSpent, preset, isRefinement, isFastMode, collectedCtx, startTime })
  }
  multiJudgeResult = panelPhase.result

  // 7d. Feature 3: Composite Block Merge Directive
  const compositeMergeDirective = (preset?.composite_merge_enabled && successfulRefs.length > 1)
    ? buildCompositeBlockDirectives(successfulRefs, { blind: Boolean(preset.blind_evaluation) })
    : null

  // 8. Synthesis phase via primary judge or fallback chain
  const synthesisPrompt = buildSynthesisPrompt(userPrompt, referenceOutputs, judgeCriteria, {
    curatorSynthesis: isCuratorSynthesis,
    blindEvaluation: isBlindEvaluation,
    priorTurnBaseline,
    compositeMergeDirective,
    consensusReport: multiJudgeResult?.consensusReport,
  })
  const synthPromptTokens = Math.max(50, Math.ceil(synthesisPrompt.length / 4))

  if (preset?.budget_guard_enabled && preset?.max_budget_usd > 0 && !isFastMode) {
    const currentSpent = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + (multiJudgeResult?.totalCostUsd || 0)
    const downNext = estimateDownstreamCost(primaryJudge, [], successfulRefs.length, prices, maxTokens, synthPromptTokens)
    const phaseCheck = checkPhaseBudget({ phaseName: 'Judge Synthesis', currentSpentUsd: currentSpent, nextPhaseCostUsd: downNext, maxBudgetUsd: preset.max_budget_usd, action: preset.budget_action || 'trim', enabled: true })
    if (!phaseCheck.allowed && fallbackJudges.length === 0) {
      await cleanMoaWorkspaces(cwd, { runId })
      return createBudgetAbortPayload({ reason: phaseCheck.reason, primaryJudge, referenceOutputs, currentSpentUsd: currentSpent, preset, isRefinement, isFastMode, collectedCtx, startTime, multiJudgeResult })
    }
  }
  let synthesizedText = ''
  let aggUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
  let chosenJudge = primaryJudge
  let judgeSuccess = false
  let lastJudgeError = null

  for (let jIdx = 0; jIdx < judgesChain.length; jIdx++) {
    const currentJudge = judgesChain[jIdx]
    const currentLabel = slotLabel(currentJudge)

    if (preset?.budget_guard_enabled && preset?.max_budget_usd > 0 && !isFastMode) {
      const currentSpent = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + (multiJudgeResult?.totalCostUsd || 0)
      const judgeCost = estimateDownstreamCost(currentJudge, [], successfulRefs.length, prices, maxTokens, synthPromptTokens)
      const phaseCheck = checkPhaseBudget({ phaseName: `Judge Synthesis (${currentLabel})`, currentSpentUsd: currentSpent, nextPhaseCostUsd: judgeCost, maxBudgetUsd: preset.max_budget_usd, action: preset.budget_action || 'trim', enabled: true })
      if (!phaseCheck.allowed) {
        lastJudgeError = new Error(phaseCheck.reason)
        logger.warn(`[dsh-moa] Judge ${currentLabel} budget check failed: ${phaseCheck.reason}`)
        if (typeof onProgress === 'function') onProgress(`⚠️ *Judge ${currentLabel} skipped: exceeds budget limit.*\n`)
        continue
      }
    }

    if (typeof onProgress === 'function') {
      const modeTitle = isCuratorSynthesis ? 'Curator' : 'Judge'
      const fallbackBadge = jIdx > 0 ? ` (Fallback #${jIdx})` : ''
      onProgress(`⚖️ *${modeTitle} (${currentLabel}${fallbackBadge}) synthesizing solution...*\n`)
    }

    try {
      const aggRes = await callWithTransientRetry(callLlm, {
        provider: currentJudge.provider,
        model: currentJudge.model,
        messages: [{ role: 'user', content: synthesisPrompt }],
        temperature: aggTemp,
        maxTokens,
        timeoutMs: aggTimeoutSec * 1000,
        signal,
        onStreamDelta: (delta) => {
          if (isStreamAggregator && typeof onStreamDelta === 'function') {
            onStreamDelta(delta)
          }
        },
      }, 0)

      synthesizedText = typeof aggRes === 'string' ? aggRes : (aggRes?.content || aggRes?.text || '')

      const aggFallbackUsage = (typeof aggRes === 'object' && aggRes?.usage) ? aggRes.usage : {
        inputTokens: Math.max(1, Math.round(synthesisPrompt.length / 4)),
        outputTokens: Math.max(1, Math.round(synthesizedText.length / 4)),
      }
      aggUsage = estimateTokenCost(currentJudge, aggFallbackUsage, prices)
      chosenJudge = currentJudge
      judgeSuccess = true
      break
    } catch (err) {
      lastJudgeError = err
      logger.warn(`[dsh-moa] Judge ${currentLabel} failed:`, err)
      if (typeof onProgress === 'function') {
        const nextJudge = judgesChain[jIdx + 1]
        const nextHint = nextJudge ? ` Trying fallback ${slotLabel(nextJudge)}...` : ''
        onProgress(`⚠️ *Judge ${currentLabel} failed: ${err?.message || err}.${nextHint}*\n`)
      }
    }
  }

  if (!judgeSuccess) {
    if (preset?.budget_guard_enabled && preset?.max_budget_usd > 0 && !isFastMode && (lastJudgeError?.message?.includes('exceeds max budget') || lastJudgeError?.message?.includes('Budget Guardrail') || preset?.budget_action === 'abort')) {
      await cleanMoaWorkspaces(cwd, { runId })
      const currentSpent = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + (multiJudgeResult?.totalCostUsd || 0)
      return createBudgetAbortPayload({ reason: lastJudgeError?.message || 'Budget exceeded before judge synthesis', primaryJudge, referenceOutputs, currentSpentUsd: currentSpent, preset, isRefinement, isFastMode, collectedCtx, startTime, multiJudgeResult })
    }
    const firstErr = lastJudgeError ? (lastJudgeError.message || String(lastJudgeError)) : 'unknown error'
    synthesizedText = `⚠️ *[Aggregator error: ${firstErr}. Fallback candidate outputs:]*\n\n` +
      successfulRefs.map((r, i) => `### Candidate ${i + 1} (${r.label})\n${r.text}`).join('\n\n')
  }

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
  }

  // 9. Evaluate winner & promote files
  const winningIndex = (multiJudgeResult?.consensus && multiJudgeResult?.winningCandidateIndex)
    ? multiJudgeResult.winningCandidateIndex
    : parseWinnerIndex(synthesizedText, 1, referenceOutputs.length)

  const recommendedAssembler = isCuratorSynthesis
    ? parseRecommendedAssembler(synthesizedText, winningIndex, referenceOutputs.length)
    : null

  // Check if aggregator synthesized unified file blocks directly
  const synthesizedFiles = extractFileBlocks(synthesizedText)
  let promotedFiles = []

  const keepWorkspaces = allowCandidateOverride
  if (signal?.aborted) {
    if (!keepWorkspaces) await cleanMoaWorkspaces(cwd, { runId })
    return { error: new Error('Turn aborted') }
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
    if (signal?.aborted || promoteErr?.message === 'Turn aborted') return { error: new Error('Turn aborted') }
    throw promoteErr
  }

  const livePreview = await createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs, { winningIndex, synthesizedFiles })
  const durationMs = Date.now() - startTime
  const usageSummary = summarizeMoAUsage(referenceOutputs, aggUsage, multiJudgeResult?.totalUsage)
  const winningRef = referenceOutputs[winningIndex - 1]
  const winnerModel = winningRef?.label || slotLabel(effectiveReferences[0] || referenceModels[0])
  const finalAggLabel = slotLabel(chosenJudge)

  // Feature 9: Benchmark & Post-Mortem PR report
  let benchmarkReport = null
  if (preset?.report_generation_enabled) {
    benchmarkReport = generateMoABenchmarkReport({
      runId,
      timestamp: new Date().toISOString(),
      preset: preset?.name || 'default',
      prompt: userPrompt,
      durationMs,
      usage: usageSummary,
      costUsd: usageSummary.totalCostUsd,
      candidates: referenceOutputs,
      winningIndex,
      winningLabel: winnerModel,
      consensus: multiJudgeResult,
      testGate: referenceOutputs.filter((r) => r.testResult).map((r) => r.testResult),
      isComposite: Boolean(preset?.composite_merge_enabled),
    })
  }

  try {
    await recordMoaRunAsync({
      id: runId, cwd, prompt: userPrompt, preset: preset?.name || 'default', isRefinement,
      candidates: candidatesForHistory(referenceOutputs),
      aggregator: { provider: chosenJudge.provider, model: chosenJudge.model, usage: aggUsage, costUsd: aggUsage.costUsd },
      winnerIndex: winningIndex, winnerModel, promotedFiles, benchmarkReport, consensus: multiJudgeResult,
      totalTokens: usageSummary.totalTokens, totalCostUsd: usageSummary.totalCostUsd, durationMs,
    }, historyFilePath || undefined)
  } catch (histErr) {
    logger.warn('[dsh-moa] Failed to record run in history:', histErr)
  }

  return {
    kind: 'synthesis', content: synthesizedText, aggregator: isFastMode ? 'Fast Mode (Direct)' : finalAggLabel,
    references: referenceOutputs, presetName: preset?.name || 'default', isRefinement, isFastMode, isCuratorSynthesis,
    recommendedAssembler, winningIndex, winnerModel, promotedFiles, runId, allowCandidateOverride,
    benchmarkReport, consensus: multiJudgeResult, ...(livePreview ? { liveCanvas: livePreview } : {}),
    usage: usageSummary, skippedFiles: collectedCtx?.skippedFiles || 0, skippedList: collectedCtx?.skippedList || [], durationMs,
  }
}
