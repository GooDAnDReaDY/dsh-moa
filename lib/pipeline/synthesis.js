import { formatUncertaintyAnnotations } from '../moa-uncertainty.js'
import { logger } from '../logger.js'
import { buildSynthesisPrompt, slotLabel } from '../moa-prompts.js'
import { estimateDownstreamCost, checkPhaseBudget, createBudgetAbortPayload } from '../moa-budget.js'
import { callWithTransientRetry } from '../moa-candidates.js'
import { estimateTokenCost } from '../pricing.js'
import { cleanMoaWorkspaces } from '../workspace/fs.js'

export async function stageSynthesis({
  userPrompt,
  referenceOutputs,
  successfulRefs,
  judgeCriteria,
  isCuratorSynthesis,
  isBlindEvaluation,
  priorTurnBaseline,
  compositeMergeDirective,
  fileScoringDirective,
  multiJudgeResult,
  preset,
  prices,
  maxTokens,
  isFastMode,
  primaryJudge,
  fallbackJudges,
  judgesChain,
  aggTemp,
  aggTimeoutSec,
  isStreamAggregator,
  onStreamDelta,
  signal,
  callLlm,
  onProgress,
  cwd,
  runId,
  isRefinement,
  collectedCtx,
  startTime,
}) {
  let uncertaintyDirective = ''
  if (preset?.uncertainty_scoring_enabled) {
    const uncReport = formatUncertaintyAnnotations(referenceOutputs)
    if (uncReport.hasHighUncertainty) {
      uncertaintyDirective = uncReport.reportText
    }
  }
  const baseSynthesisPrompt = buildSynthesisPrompt(userPrompt, referenceOutputs, judgeCriteria, {
    curatorSynthesis: isCuratorSynthesis,
    blindEvaluation: isBlindEvaluation,
    priorTurnBaseline,
    compositeMergeDirective,
    fileScoringDirective,
    consensusReport: multiJudgeResult?.consensusReport,
  })
  const synthesisPrompt = uncertaintyDirective ? baseSynthesisPrompt + '\n' + uncertaintyDirective : baseSynthesisPrompt
  const synthPromptTokens = Math.max(50, Math.ceil(synthesisPrompt.length / 4))

  if (preset?.budget_guard_enabled && preset?.max_budget_usd > 0 && !isFastMode) {
    const currentSpent = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + (multiJudgeResult?.totalCostUsd || 0)
    const downNext = estimateDownstreamCost(primaryJudge, [], successfulRefs.length, prices, maxTokens, synthPromptTokens)
    const phaseCheck = checkPhaseBudget({
      phaseName: 'Judge Synthesis', currentSpentUsd: currentSpent, nextPhaseCostUsd: downNext,
      maxBudgetUsd: preset.max_budget_usd, action: preset.budget_action || 'trim', enabled: true,
    })
    if (!phaseCheck.allowed && fallbackJudges.length === 0) {
      await cleanMoaWorkspaces(cwd, { runId })
      const abortPayload = createBudgetAbortPayload({
        reason: phaseCheck.reason, primaryJudge, referenceOutputs, currentSpentUsd: currentSpent,
        preset, isRefinement, isFastMode, collectedCtx, startTime, multiJudgeResult,
      })
      return { ok: false, abortPayload }
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
      const phaseCheck = checkPhaseBudget({
        phaseName: `Judge Synthesis (${currentLabel})`, currentSpentUsd: currentSpent, nextPhaseCostUsd: judgeCost,
        maxBudgetUsd: preset.max_budget_usd, action: preset.budget_action || 'trim', enabled: true,
      })
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
      const abortPayload = createBudgetAbortPayload({
        reason: lastJudgeError?.message || 'Budget exceeded before judge synthesis', primaryJudge, referenceOutputs,
        currentSpentUsd: currentSpent, preset, isRefinement, isFastMode, collectedCtx, startTime, multiJudgeResult,
      })
      return { ok: false, abortPayload }
    }
    const firstErr = lastJudgeError ? (lastJudgeError.message || String(lastJudgeError)) : 'unknown error'
    synthesizedText = `⚠️ *[Aggregator error: ${firstErr}. Fallback candidate outputs:]*\n\n` +
      successfulRefs.map((r, i) => `### Candidate ${i + 1} (${r.label})\n${r.text}`).join('\n\n')
  }

  return { ok: true, synthesizedText, chosenJudge, aggUsage }
}
