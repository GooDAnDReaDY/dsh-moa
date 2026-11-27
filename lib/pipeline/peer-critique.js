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

  // Guarded critique (#387): the refined answer is never allowed to destroy
  // the original. It becomes an additional candidate (compete) that the
  // judge picks between, or is dropped entirely when it fails the checks
  // the original passed (strict).
  const guardMode = preset?.critique_guard_mode === 'strict' ? 'strict' : 'compete'
  const derivedRefs = []
  if (runRound2) {
    if (typeof onProgress === 'function') {
      onProgress('🤝 *Consilium Round 2: Candidates reviewing peer proposals in parallel...*\n')
    }
    let maxExistingIndex = 0
    for (const r of referenceOutputs) if (Number.isFinite(r.index)) maxExistingIndex = Math.max(maxExistingIndex, r.index)
    // Derived indexes are precomputed (parallel critique callbacks race otherwise)
    const derivedIndexBySource = new Map(successfulRefs.map((c, i) => [c.index, maxExistingIndex + i + 1]))
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
        const r2Files = extractFileBlocks(refinedText)
        const syntaxWarning = (verifyFileSyntax(r2Files) || []).map((w) => `${w.file}: ${w.error}`).join('; ')
        const critiqueUsage = (typeof res === 'object' && res?.usage) ? {
          inputTokens: res.usage.inputTokens || 0,
          outputTokens: res.usage.outputTokens || 0,
          totalTokens: res.usage.totalTokens || 0,
        } : null
        if (guardMode === 'compete') {
          // Derived candidate: the original stays untouched; the judge picks
          // between them. A distinct index gives the derived variant its own
          // candidate sandbox so promotion resolves the right files.
          const derivedIndex = derivedIndexBySource.get(cand.index)
          if (r2Files.length > 0) {
            await writeCandidateWorkspace(cwd, derivedIndex, r2Files, { runId })
          }
          derivedRefs.push({
            ...cand,
            text: refinedText,
            files: r2Files.length > 0 ? r2Files : [],
            syntaxWarning,
            label: `${isBlindEvaluation ? `Candidate ${cand.index}` : cand.label} (critiqued)`,
            index: derivedIndex,
            derivedFrom: cand.index,
            usage: critiqueUsage ? { ...critiqueUsage } : { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            costUsd: critiqueUsage ? Number((estimateTokenCost(slot, critiqueUsage, prices).costUsd || 0).toFixed(5)) : (cand.costUsd || 0),
          })
        } else if (syntaxWarning) {
          // strict: a refinement with syntax defects is rejected outright.
          logger.warn(`[dsh-moa] Round 2 refinement for candidate ${cand.index} rejected (syntax): ${syntaxWarning}`)
        } else {
          cand.text = refinedText
          if (r2Files.length > 0) {
            cand.files = r2Files
            await writeCandidateWorkspace(cwd, cand.index, r2Files, { runId })
          }
          if (critiqueUsage) {
            cand.usage.inputTokens = (cand.usage.inputTokens || 0) + critiqueUsage.inputTokens
            cand.usage.outputTokens = (cand.usage.outputTokens || 0) + critiqueUsage.outputTokens
            cand.usage.totalTokens = (cand.usage.totalTokens || 0) + critiqueUsage.totalTokens
            const extraCost = estimateTokenCost(slot, critiqueUsage, prices)
            cand.costUsd = Number(((cand.costUsd || 0) + extraCost.costUsd).toFixed(5))
          }
        }
      } catch (r2Err) {
        logger.warn(`[dsh-moa] Round 2 peer critique failed for candidate ${cand.index}:`, r2Err?.message || r2Err)
      }
    })
    await Promise.allSettled(r2Promises)
    if (derivedRefs.length > 0) {
      if (typeof onProgress === 'function') {
        onProgress(`🛡️ *Guarded critique (${guardMode}): ${derivedRefs.length} refined variant(s) added as extra candidate(s); originals preserved*\n`)
      }
      for (const d of derivedRefs) {
        referenceOutputs.push(d)
        successfulRefs.push(d)
      }
    }
    await executeTestGateForCandidates({
      cwd,
      referenceOutputs: successfulRefs,
      preset,
      options: { testGateEnabled, testCommand, execFn, runId },
      onProgress,
    })
    if (guardMode === 'strict') {
      // strict second gate: a refined variant that fails the test gate the
      // original passed is dropped after the run, the original stays.
      for (const d of [...derivedRefs]) {
        if (d.testResult && d.testResult.passed === false) {
          const idx = successfulRefs.indexOf(d)
          if (idx !== -1) successfulRefs.splice(idx, 1)
          const rIdx = referenceOutputs.indexOf(d)
          if (rIdx !== -1) referenceOutputs.splice(rIdx, 1)
          logger.warn(`[dsh-moa] Strict critique guard dropped refined variant ${d.label} (test gate failed)`)
        }
      }
    }
  }

  return { ok: true, critiquesCount: runRound2 ? successfulRefs.length : 0, guardMode, derivedCount: derivedRefs.length }
}
