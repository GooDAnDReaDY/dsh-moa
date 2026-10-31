import { logger } from '../logger.js'
import { buildQuestionSynthesisPrompt, slotLabel } from '../moa-prompts.js'
import { callWithTransientRetry } from '../moa-candidates.js'
import { estimateTokenCost } from '../pricing.js'
import { cleanMoaWorkspaces } from '../workspace/fs.js'
import { recordMoaRunAsync, candidatesForHistory } from '../history.js'

export async function stageClarifyingQuestions({
  userPrompt,
  referenceOutputs,
  primaryJudge,
  aggTimeoutSec,
  prices,
  callLlm,
  cwd,
  runId,
  preset,
  isRefinement,
  isFastMode,
  collectedCtx,
  startTime,
  historyFilePath,
  onProgress,
}) {
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
