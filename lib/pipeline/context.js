import { collectProjectContext, formatProjectContext, isRefinementTask } from '../workspace/scanner.js'
import { applyBudgetGuardrails, createBudgetAbortPayload } from '../moa-budget.js'
import { extractPriorTurnBaseline, pruneMultiTurnMessages } from '../moa-context.js'
import { REFERENCE_SYSTEM_PROMPT } from '../moa-candidates.js'
import { isBroadPromptRequiringQuestions } from '../moa-prompts.js'

export async function stageProjectContext({
  userPrompt,
  messages = [],
  preset,
  cwd,
  prices,
  maxTokens,
  startTime,
  onProgress,
}) {
  const referenceModels = Array.isArray(preset?.reference_models) && preset.reference_models.length > 0
    ? preset.reference_models : [{ provider: '', model: '' }]
  const primaryJudge = preset?.aggregator?.provider && preset?.aggregator?.model
    ? preset.aggregator : { provider: '', model: '' }
  const fallbackJudges = Array.isArray(preset?.aggregator_fallbacks) ? preset.aggregator_fallbacks : []
  const judgesChain = [primaryJudge, ...fallbackJudges]
  const refTemp = typeof preset?.reference_temperature === 'number' ? preset.reference_temperature : 0.6
  const aggTemp = typeof preset?.aggregator_temperature === 'number' ? preset.aggregator_temperature : 0.4
  const judgeCriteria = preset?.judge_criteria || ''
  let isFastMode = referenceModels.length === 1 && !preset?.curator_synthesis
  const isCuratorSynthesis = Boolean(preset?.curator_synthesis)
  const isStreamAggregator = preset?.stream_aggregator !== false
  const isQuorumEnabled = Boolean(preset?.quorum_enabled)
  const gracePeriodSec = typeof preset?.grace_period_sec === 'number' ? preset.grace_period_sec : 10
  const candidateRetries = 1
  const refTimeoutSec = typeof preset?.reference_timeout_sec === 'number' ? preset.reference_timeout_sec : 60
  const aggTimeoutSec = typeof preset?.aggregator_timeout_sec === 'number' ? preset.aggregator_timeout_sec : 180
  const isBlindEvaluation = Boolean(preset?.blind_evaluation)
  const isPeerCritiqueEnabled = Boolean(preset?.peer_critique_enabled)
  const allowCandidateOverride = Boolean(preset?.allow_candidate_override)

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
    const abortPayload = createBudgetAbortPayload({
      reason: budgetCheck.reason, primaryJudge, referenceOutputs: [], currentSpentUsd: 0,
      preset, isRefinement, isFastMode, collectedCtx, startTime,
    })
    return { ok: false, abortPayload }
  }

  const effectiveReferences = budgetCheck.references
  if (effectiveReferences.length === 1 && !preset?.curator_synthesis) {
    isFastMode = true
  }
  if (budgetCheck.action === 'trim' && typeof onProgress === 'function') {
    onProgress(`✂️ *${budgetCheck.reason}*\n`)
  }

  const priorTurnBaseline = preset?.multi_turn_enabled !== false ? extractPriorTurnBaseline(messages) : null
  const prunedHistory = preset?.multi_turn_enabled !== false ? pruneMultiTurnMessages(messages) : messages
  const candidateSystemPrompt = projectContext
    ? `${REFERENCE_SYSTEM_PROMPT}\n\n### Current Project Files & Context:\n${projectContext}`
    : REFERENCE_SYSTEM_PROMPT
  const askClarifyingQuestions = preset?.ask_clarifying_questions !== false
  const needsQuestions = askClarifyingQuestions && isBroadPromptRequiringQuestions(userPrompt, messages)
  const enrichedMessages = [...prunedHistory, { role: 'user', content: userPrompt }]

  return {
    ok: true,
    referenceModels, primaryJudge, fallbackJudges, judgesChain,
    refTemp, aggTemp, maxTokens, judgeCriteria, isFastMode, isCuratorSynthesis,
    isStreamAggregator, isQuorumEnabled, gracePeriodSec, candidateRetries,
    refTimeoutSec, aggTimeoutSec, isBlindEvaluation, isPeerCritiqueEnabled,
    allowCandidateOverride, collectedCtx, isRefinement, projectContext,
    effectiveReferences, priorTurnBaseline, candidateSystemPrompt,
    needsQuestions, enrichedMessages,
  }
}
