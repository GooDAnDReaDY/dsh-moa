import { logger } from './logger.js'
import path from 'node:path'
import crypto from 'node:crypto'
import { bestEffort } from './best-effort.js'
import { extractFileBlocks, collectProjectContext, formatProjectContext, isRefinementTask, writeCandidateWorkspace, promoteCandidateWorkspace, cleanMoaWorkspaces, verifyFileSyntax } from './file-workspace.js'
import { estimateTokenCost, summarizeMoAUsage } from './pricing.js'
import { recordMoaRunAsync, candidatesForHistory } from './history.js'
import { createPromotedPreview } from './live-canvas.js'
import { slotLabel, cleanAdvisoryMessages, isBroadPromptRequiringQuestions, buildQuestionSynthesisPrompt, buildCuratorSynthesisPrompt, buildSynthesisPrompt, buildPeerCritiquePrompt, ROLE_PERSONA_PROMPTS, SYSTEM_ROLE_PROPOSER, ANTIPATTERNS_RUBRIC } from './moa-prompts.js'
import { parseWinnerIndex, parseRecommendedAssembler, parseMoACommand, stripOrSummarizeCode, formatMoAResponse } from './moa-parser.js'
import { REFERENCE_SYSTEM_PROMPT, callWithTransientRetry, runReferencesParallel } from './moa-candidates.js'
import { executeTestGateForCandidates, runCandidateTestGate } from './moa-test-gate.js'
import { executeMultiJudgePanel, buildCompositeBlockDirectives } from './moa-multi-judge.js'
import { applyBudgetGuardrails } from './moa-budget.js'
import { extractPriorTurnBaseline, pruneMultiTurnMessages } from './moa-context.js'
import { generateMoABenchmarkReport } from './moa-report.js'

// Re-exports for consumers & backward compatibility
export { slotLabel, cleanAdvisoryMessages, isBroadPromptRequiringQuestions, buildQuestionSynthesisPrompt, buildCuratorSynthesisPrompt, buildSynthesisPrompt, ANTIPATTERNS_RUBRIC } from './moa-prompts.js'
export { parseWinnerIndex, parseRecommendedAssembler, parseMoACommand, stripOrSummarizeCode, formatMoAResponse } from './moa-parser.js'
export { estimateTokenCost, summarizeMoAUsage } from './pricing.js'
export { REFERENCE_SYSTEM_PROMPT, callWithTransientRetry, runReferencesParallel } from './moa-candidates.js'
export { executeTestGateForCandidates, runCandidateTestGate } from './moa-test-gate.js'
export { streamMoATurn } from './moa-stream.js'

/**
 * Executes the full Mixture of Agents pipeline.
 */
export async function runMoAPipeline({
  userPrompt,
  messages = [],
  preset,
  callLlm,
  cwd = process.cwd(),
  prices = {},
  onProgress = null,
  historyFilePath = null,
  liveCanvas = null,
  onStreamDelta = null,
  signal = null,
  testGateEnabled = null,
  testCommand = null,
  execFn = null,
}) {
  if (signal?.aborted) return { error: new Error('Turn aborted') }
  const startTime = Date.now()

  // 1. Resolve configurations
  const referenceModels = Array.isArray(preset?.reference_models) && preset.reference_models.length > 0
    ? preset.reference_models : [{ provider: 'opencode-go', model: 'deepseek-v4-flash' }]
  const primaryJudge = preset?.aggregator?.provider && preset?.aggregator?.model
    ? preset.aggregator : { provider: 'codex', model: 'gpt-5.6-sol' }

  const fallbackJudges = Array.isArray(preset?.aggregator_fallbacks) ? preset.aggregator_fallbacks : []
  const judgesChain = [primaryJudge, ...fallbackJudges]

  const refTemp = typeof preset?.reference_temperature === 'number' ? preset.reference_temperature : 0.6
  const aggTemp = typeof preset?.aggregator_temperature === 'number' ? preset.aggregator_temperature : 0.4
  const maxTokens = typeof preset?.max_tokens === 'number' ? preset.max_tokens : 4096
  const judgeCriteria = preset?.judge_criteria || ''
  const isFastMode = referenceModels.length === 1 && !preset?.curator_synthesis
  const isCuratorSynthesis = Boolean(preset?.curator_synthesis), isStreamAggregator = preset?.stream_aggregator !== false
  const isQuorumEnabled = Boolean(preset?.quorum_enabled), gracePeriodSec = typeof preset?.grace_period_sec === 'number' ? preset.grace_period_sec : 10
  const candidateRetries = 1, refTimeoutSec = typeof preset?.reference_timeout_sec === 'number' ? preset.reference_timeout_sec : 60
  const aggTimeoutSec = typeof preset?.aggregator_timeout_sec === 'number' ? preset.aggregator_timeout_sec : 180
  const isBlindEvaluation = Boolean(preset?.blind_evaluation), isPeerCritiqueEnabled = Boolean(preset?.peer_critique_enabled)
  const allowCandidateOverride = Boolean(preset?.allow_candidate_override), runId = crypto.randomUUID()

  // Feature 6: Budget Guardrail check
  const budgetCheck = applyBudgetGuardrails({
    references: referenceModels,
    enabled: preset?.budget_guard_enabled,
    maxBudgetUsd: preset?.max_budget_usd,
    action: preset?.budget_action || 'trim',
    prices,
    promptLength: userPrompt?.length || 1000,
  })
  if (!budgetCheck.allowed) {
    return {
      kind: 'failure',
      content: `🛑 Budget Guardrail Abort: ${budgetCheck.reason}`,
      aggregator: slotLabel(primaryJudge),
      references: [],
      presetName: preset?.name || 'default',
      isRefinement: false,
      isFastMode,
      winningIndex: 0,
      winnerModel: 'none',
      promotedFiles: [],
      usage: { totalTokens: 0, totalCostUsd: 0, candidates: [], aggregator: { totalTokens: 0, costUsd: 0 } },
      skippedFiles: 0,
      skippedList: [],
      durationMs: Date.now() - startTime,
    }
  }
  const effectiveReferences = budgetCheck.references
  if (budgetCheck.action === 'trim' && typeof onProgress === 'function') {
    onProgress(`✂️ *${budgetCheck.reason}*\n`)
  }

  // 2. Collect project context for refinement tasks
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
    await cleanMoaWorkspaces(cwd)
    return { error: new Error('Turn aborted') }
  }

  // Fail fast if all candidates failed
  const successfulRefs = referenceOutputs.filter((r) => r.ok)
  if (successfulRefs.length === 0) {
    const reasons = referenceOutputs.map((r) => `${r.label}: ${r.error || 'unknown error'}`).join('; ')
    return {
      kind: 'failure',
      content: `⚠️ All advisor models (${referenceOutputs.length}) failed: ${reasons}`,
      aggregator: slotLabel(primaryJudge),
      references: referenceOutputs,
      presetName: preset?.name || 'default',
      isRefinement,
      isFastMode,
      winningIndex: 0,
      winnerModel: 'none',
      promotedFiles: [],
      usage: {
        totalTokens: 0,
        totalCostUsd: 0,
        candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
        aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      },
      skippedFiles: collectedCtx?.skippedFiles || 0,
      skippedList: collectedCtx?.skippedList || [],
      durationMs: Date.now() - startTime,
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
      await writeCandidateWorkspace(cwd, i + 1, files)
    }
  }

  // 5b. Test Execution Gate
  await executeTestGateForCandidates({
    cwd,
    referenceOutputs,
    preset,
    options: { testGateEnabled, testCommand, execFn },
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

    await cleanMoaWorkspaces(cwd)
    const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0) + qUsage.totalTokens
    const totalCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + qUsage.costUsd).toFixed(5))
    const durationMs = Date.now() - startTime

    try {
      await recordMoaRunAsync({
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
      kind: 'questions',
      content: questionsContent,
      aggregator: slotLabel(primaryJudge),
      references: referenceOutputs,
      presetName: preset?.name || 'default',
      isRefinement,
      isFastMode,
      winningIndex: 0,
      winnerModel: 'none',
      promotedFiles: [],
      usage: {
        totalTokens,
        totalCostUsd,
        candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
        aggregator: qUsage,
      },
      skippedFiles: collectedCtx?.skippedFiles || 0,
      skippedList: collectedCtx?.skippedList || [],
      durationMs,
    }
  }

  // 7. Fast Mode (1 candidate, bypass judge)
  if (isFastMode) {
    const single = successfulRefs[0]
    let promotedFiles = []
    if (single.files?.length > 0) {
      promotedFiles = await promoteCandidateWorkspace(cwd, single.index)
    } else {
      await cleanMoaWorkspaces(cwd)
    }

    const livePreview = await createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs)
    const totalTokens = single.usage?.totalTokens || 0
    const totalCostUsd = Number((single.costUsd || 0).toFixed(5))
    const durationMs = Date.now() - startTime

    try {
      await recordMoaRunAsync({
        prompt: userPrompt,
        preset: preset?.name || 'default',
        isRefinement,
        isFastMode: true,
        candidates: candidatesForHistory(referenceOutputs),
        aggregator: null,
        winnerIndex: single.index,
        winnerModel: single.label,
        promotedFiles,
        totalTokens,
        totalCostUsd,
        durationMs,
      }, historyFilePath || undefined)
    } catch (histErr) {
      logger.warn('[dsh-moa] Failed to record fast synthesis run in history:', histErr?.message || histErr)
    }

    return {
      kind: 'synthesis',
      content: single.text,
      aggregator: 'Fast Mode (Direct)',
      references: referenceOutputs,
      presetName: preset?.name || 'default',
      isRefinement,
      isFastMode: true,
      winningIndex: single.index,
      winnerModel: single.label,
      promotedFiles,
      ...(livePreview ? { liveCanvas: livePreview } : {}),
      usage: {
        totalTokens,
        totalCostUsd,
        candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
        aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      },
      skippedFiles: collectedCtx?.skippedFiles || 0,
      skippedList: collectedCtx?.skippedList || [],
      durationMs,
    }
  }

  // 7b. Consilium Round 2 (Peer Critique) if enabled
  if (isPeerCritiqueEnabled && successfulRefs.length > 1) {
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
        const slot = referenceModels[cand.index - 1] || { provider: cand.provider, model: cand.model }
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
          await writeCandidateWorkspace(cwd, cand.index, r2Files)
        }
        if (typeof res === 'object' && res?.usage) {
          cand.usage.inputTokens = (cand.usage.inputTokens || 0) + (res.usage.inputTokens || 0)
          cand.usage.outputTokens = (cand.usage.outputTokens || 0) + (res.usage.outputTokens || 0)
          cand.usage.totalTokens = (cand.usage.totalTokens || 0) + (res.usage.totalTokens || 0)
          const extraCost = estimateTokenCost(slot, res.usage, prices)
          cand.costUsd = Number(((cand.costUsd || 0) + extraCost.costUsd).toFixed(5))
        }
      } catch (r2CostErr) {
        logger.warn('[dsh-moa] Failed to estimate Round 2 cost:', r2CostErr?.message || r2CostErr)
      }
    })
    await Promise.allSettled(r2Promises)
    await executeTestGateForCandidates({
      cwd,
      referenceOutputs: successfulRefs,
      preset,
      options: { testGateEnabled, testCommand, execFn },
      onProgress,
    })
  }

  // 7c. Feature 2: Multi-Judge Panel & Consensus Voting
  let multiJudgeResult = null
  if (preset?.multi_judge_enabled && successfulRefs.length > 1) {
    multiJudgeResult = await executeMultiJudgePanel({
      judges: (preset.judge_models && preset.judge_models.length > 0) ? preset.judge_models : [primaryJudge],
      candidates: successfulRefs,
      userPrompt,
      callLlm,
      strategy: preset.judge_voting_strategy || 'majority',
      signal,
      onProgress,
    })
  }

  // 7d. Feature 3: Composite Block Merge Directive
  const compositeMergeDirective = (preset?.composite_merge_enabled && successfulRefs.length > 1)
    ? buildCompositeBlockDirectives(successfulRefs)
    : null

  // 8. Synthesis phase via primary judge or fallback chain
  const synthesisPrompt = buildSynthesisPrompt(userPrompt, referenceOutputs, judgeCriteria, {
    curatorSynthesis: isCuratorSynthesis,
    blindEvaluation: isBlindEvaluation,
    priorTurnBaseline,
    compositeMergeDirective,
    consensusReport: multiJudgeResult?.consensusReport,
  })
  let synthesizedText = ''
  let aggUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
  let chosenJudge = primaryJudge
  let judgeSuccess = false
  let lastJudgeError = null

  for (let jIdx = 0; jIdx < judgesChain.length; jIdx++) {
    const currentJudge = judgesChain[jIdx]
    const currentLabel = slotLabel(currentJudge)

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
    const firstErr = lastJudgeError ? (lastJudgeError.message || String(lastJudgeError)) : 'unknown error'
    synthesizedText = `⚠️ *[Aggregator error: ${firstErr}. Fallback candidate outputs:]*\n\n` +
      successfulRefs.map((r, i) => `### Candidate ${i + 1} (${r.label})\n${r.text}`).join('\n\n')
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
  if (synthesizedFiles.length > 0) {
    await writeCandidateWorkspace(cwd, 'curator-synthesis', synthesizedFiles)
    promotedFiles = await promoteCandidateWorkspace(cwd, 'curator-synthesis', { keepMoa: keepWorkspaces })
  } else if (referenceOutputs[winningIndex - 1]?.files?.length > 0) {
    promotedFiles = await promoteCandidateWorkspace(cwd, winningIndex, { keepMoa: keepWorkspaces })
  } else if (successfulRefs[0]?.files?.length > 0) {
    const fallbackIdx = successfulRefs[0].index
    promotedFiles = await promoteCandidateWorkspace(cwd, fallbackIdx, { keepMoa: keepWorkspaces })
  } else if (!keepWorkspaces) {
    await cleanMoaWorkspaces(cwd)
  }

  const livePreview = await createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs)
  const durationMs = Date.now() - startTime
  const usageSummary = summarizeMoAUsage(referenceOutputs, aggUsage)
  const winningRef = referenceOutputs[winningIndex - 1]
  const winnerModel = winningRef?.label || slotLabel(referenceModels[0])
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
      testGate: referenceOutputs.find((r) => r.testResult)?.testResult || null,
      isComposite: Boolean(preset?.composite_merge_enabled),
    })
  }

  try {
    await recordMoaRunAsync({
      id: runId,
      prompt: userPrompt,
      preset: preset?.name || 'default',
      isRefinement,
      candidates: candidatesForHistory(referenceOutputs),
      aggregator: { provider: chosenJudge.provider, model: chosenJudge.model, usage: aggUsage, costUsd: aggUsage.costUsd },
      winnerIndex: winningIndex,
      winnerModel,
      promotedFiles,
      benchmarkReport,
      consensus: multiJudgeResult,
      totalTokens: usageSummary.totalTokens,
      totalCostUsd: usageSummary.totalCostUsd,
      durationMs,
    }, historyFilePath || undefined)
  } catch (histErr) {
    logger.warn('[dsh-moa] Failed to record run in history:', histErr)
  }

  return {
    kind: 'synthesis',
    content: synthesizedText,
    aggregator: isFastMode ? 'Fast Mode (Direct)' : finalAggLabel,
    references: referenceOutputs,
    presetName: preset?.name || 'default',
    isRefinement,
    isFastMode,
    isCuratorSynthesis,
    recommendedAssembler,
    winningIndex,
    winnerModel,
    promotedFiles,
    runId,
    allowCandidateOverride,
    benchmarkReport,
    consensus: multiJudgeResult,
    ...(livePreview ? { liveCanvas: livePreview } : {}),
    usage: usageSummary,
    skippedFiles: collectedCtx?.skippedFiles || 0,
    skippedList: collectedCtx?.skippedList || [],
    durationMs,
  }
}
