import { balanceCandidateQuotas } from '../moa-quota-balancer.js'
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
  ctx = null,
}) {
  const rawRefs = (Array.isArray(preset?.reference_models) && preset.reference_models.length > 0)
    ? preset.reference_models
    : (Array.isArray(preset?.references) && preset.references.length > 0 ? preset.references : [])
  const referenceModels = rawRefs.length > 0 ? rawRefs : [{ provider: '', model: '' }]
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
  const localPreflightCheck = preset?.local_preflight_check !== false
  const earlyExitConsensusEnabled = Boolean(preset?.early_exit_consensus_enabled)
  const earlyExitThreshold = typeof preset?.early_exit_threshold === 'number' ? preset.early_exit_threshold : 0.95
  const contextPruningEnabled = preset?.context_pruning_enabled !== false
  const contextPruningDiffLines = typeof preset?.context_pruning_diff_lines === 'number' ? preset.context_pruning_diff_lines : 5
  const semanticCacheEnabled = Boolean(preset?.semantic_cache_enabled)
  const semanticCacheTtlHours = typeof preset?.semantic_cache_ttl_hours === 'number' ? preset.semantic_cache_ttl_hours : 168

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

  let effectiveReferences = budgetCheck.references
  let quotaSubstitutions = []
  if (preset?.quota_aware_balancing_enabled) {
    const fallbackPool = Array.isArray(preset?.local_fallback_models) && preset.local_fallback_models.length > 0
      ? preset.local_fallback_models
      : undefined
    const bal = await balanceCandidateQuotas(effectiveReferences, {
      ctx,
      aggregator: primaryJudge,
      fallbackPool,
    })
    effectiveReferences = bal.balancedReferences
    quotaSubstitutions = bal.substitutions
    if (quotaSubstitutions.length > 0 && typeof onProgress === "function") {
      onProgress(`⚖️ *Quota-Aware Balancing: Replaced ${quotaSubstitutions.length} low-quota slot(s) to preserve aggregator budget.*\n`)
    }
  }
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
    effectiveReferences, quotaSubstitutions, priorTurnBaseline, candidateSystemPrompt,
    needsQuestions, enrichedMessages,
    localPreflightCheck, earlyExitConsensusEnabled, earlyExitThreshold,
    contextPruningEnabled, contextPruningDiffLines,
    semanticCacheEnabled, semanticCacheTtlHours,
  }
}

