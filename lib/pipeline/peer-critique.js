import { logger } from '../logger.js'
import { estimateRound2Cost, estimateDownstreamCost, checkPhaseBudget, createBudgetAbortPayload } from '../moa-budget.js'
import { buildPeerCritiquePrompt } from '../moa-prompts.js'
import { callWithTransientRetry } from '../moa-candidates.js'
import { extractFileBlocks, writeCandidateWorkspace, cleanMoaWorkspaces } from '../workspace/fs.js'
import { verifyFileSyntax } from '../workspace/diff.js'
import { estimateTokenCost } from '../pricing.js'
import { executeTestGateForCandidates } from '../moa-test-gate.js'

export async function stagePeerCritique({
  isPeerCritiqueEnabled,
  successfulRefs,
  referenceOutputs,
  preset,
  prices,
  maxTokens,
  primaryJudge,
  userPrompt,
  isBlindEvaluation,
  refTemp,
  refTimeoutSec,
  candidateRetries,
  signal,
  callLlm,
  onProgress,
  cwd,
  runId,
  isRefinement,
  isFastMode,
  collectedCtx,
  startTime,
  options: { testGateEnabled, testCommand, execFn } = {},
}) {
  let runRound2 = isPeerCritiqueEnabled && successfulRefs.length > 1
  if (runRound2 && preset?.budget_guard_enabled && preset?.max_budget_usd > 0) {
    const currentSpent = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0)
    const r2Next = estimateRound2Cost(successfulRefs, prices, maxTokens)
    const downNext = estimateDownstreamCost(primaryJudge, preset?.judge_models, successfulRefs.length, prices, maxTokens)
    const phaseCheck = checkPhaseBudget({
      phaseName: 'Consilium Round 2', currentSpentUsd: currentSpent, nextPhaseCostUsd: r2Next + downNext,
      maxBudgetUsd: preset.max_budget_usd, action: preset.budget_action || 'trim', enabled: true,
    })
    if (!phaseCheck.allowed) {
      if (phaseCheck.action === 'abort') {
        await cleanMoaWorkspaces(cwd, { runId })
        const abortPayload = createBudgetAbortPayload({
          reason: phaseCheck.reason, primaryJudge, referenceOutputs, currentSpentUsd: currentSpent,
          preset, isRefinement, isFastMode, collectedCtx, startTime,
        })
        return { ok: false, abortPayload }
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

  return { ok: true }
}
