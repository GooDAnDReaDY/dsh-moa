/**
 * Cost Budget Guardrails & Auto-Trimming
 * Feature 6 (Cost Budget Guardrails)
 */

import { estimateTokenCost } from './pricing.js'

/**
 * Calculates conservative upfront cost estimate for a list of candidate slots.
 */
export function estimateCandidateRunCost(slots = [], prices = {}, promptTokens = 500, expectedOutputTokens = 2048) {
  let totalUsd = 0
  const slotEstimates = []

  for (const slot of slots) {
    const costInfo = estimateTokenCost(
      slot,
      { inputTokens: promptTokens, outputTokens: expectedOutputTokens },
      prices
    )
    const cost = costInfo?.costUsd || 0
    totalUsd += cost
    slotEstimates.push({ slot, costUsd: cost })
  }

  return {
    totalEstimatedUsd: Number(totalUsd.toFixed(6)),
    slotEstimates,
  }
}

/**
 * Estimates downstream synthesis costs for Round 2 and Judge panel.
 */
export function estimateDownstreamCost(aggregator, judgeModels = [], numCandidates = 1, prices = {}, expectedOutputTokens = 2048, promptTokens = 500, peerCritiqueEnabled = false) {
  let downstream = 0
  const aggInput = promptTokens + (expectedOutputTokens * numCandidates) + 200
  const aggOutput = Math.min(expectedOutputTokens, 2048)

  if (aggregator?.provider && aggregator?.model) {
    const aggCost = estimateTokenCost(aggregator, { inputTokens: aggInput, outputTokens: aggOutput }, prices)
    downstream += aggCost?.costUsd || 0
  }
  if (Array.isArray(judgeModels) && judgeModels.length > 0) {
    for (const jm of judgeModels) {
      if (jm?.provider && jm?.model) {
        const jCost = estimateTokenCost(jm, { inputTokens: aggInput, outputTokens: aggOutput }, prices)
        downstream += jCost?.costUsd || 0
      }
    }
  }
  return downstream
}

export function estimateRound2Cost(candidates = [], prices = {}, expectedOutputTokens = 2048, promptTokens = 500) {
  let r2Total = 0
  const numCandidates = candidates.length
  if (numCandidates <= 1) return 0
  // Each candidate reviews proposals from opponents (numCandidates - 1)
  const r2Input = promptTokens + (expectedOutputTokens * (numCandidates - 1)) + 150
  for (const c of candidates) {
    const slot = c.slot || { provider: c.provider, model: c.model }
    const cost = estimateTokenCost(slot, { inputTokens: r2Input, outputTokens: expectedOutputTokens }, prices)?.costUsd || 0
    r2Total += cost
  }
  return r2Total
}

/**
 * Estimates upfront token cost for multi-judge consensus panel (#158).
 */
export function estimatePanelCost(judges = [], numCandidates = 1, prices = {}, maxTokens = 2048, promptTokens = 500) {
  if (!Array.isArray(judges) || judges.length === 0 || numCandidates <= 1) return 0
  let totalCost = 0
  const inputTokens = promptTokens + (maxTokens * numCandidates) + 150
  const outputTokens = Math.min(maxTokens, 1024)
  for (const j of judges) {
    if (j?.provider && j?.model) {
      const cost = estimateTokenCost(j, { inputTokens, outputTokens }, prices)?.costUsd || 0
      totalCost += cost
    }
  }
  return totalCost
}

/**
 * Calculates accurate synthesis prompt tokens accounting for full user prompt,
 * judge criteria, and reference candidate texts (#158).
 */
export function calcSynthesisPromptTokens(firstArg = '', maybeRefs = [], maybeCriteria = '', maybeOverhead = 2600, maybeOptions = {}) {
  let userPrompt, referenceOutputs, judgeCriteria, projectContext, priorTurnBaseline, consensusReport, compositeMergeDirective, baseOverhead

  if (typeof firstArg === 'object' && firstArg !== null) {
    userPrompt = firstArg.userPrompt || ''
    referenceOutputs = firstArg.referenceOutputs || []
    judgeCriteria = firstArg.judgeCriteria || ''
    projectContext = firstArg.projectContext || ''
    priorTurnBaseline = firstArg.priorTurnBaseline
    consensusReport = firstArg.consensusReport
    compositeMergeDirective = firstArg.compositeMergeDirective
    baseOverhead = typeof firstArg.overhead === 'number' ? firstArg.overhead : 2600
  } else {
    userPrompt = typeof firstArg === 'string' ? firstArg : ''
    referenceOutputs = Array.isArray(maybeRefs) ? maybeRefs : []
    judgeCriteria = typeof maybeCriteria === 'string' ? maybeCriteria : ''
    const opts = (typeof maybeOverhead === 'object' && maybeOverhead !== null) ? maybeOverhead : (maybeOptions || {})
    projectContext = opts.projectContext || ''
    priorTurnBaseline = opts.priorTurnBaseline
    consensusReport = opts.consensusReport
    compositeMergeDirective = opts.compositeMergeDirective
    baseOverhead = typeof maybeOverhead === 'number' ? maybeOverhead : 2600
  }

  let promptChars = userPrompt.length + judgeCriteria.length + (projectContext?.length || 0) + baseOverhead

  if (Array.isArray(referenceOutputs)) {
    if (referenceOutputs.some((r) => r && r.testResult)) {
      promptChars += 550 // TEST_GATE_DIRECTIVE overhead
    }
    for (const r of referenceOutputs) {
      if (!r) continue
      promptChars += (r.text?.length || 0)
      if (r.testResult) {
        promptChars += 150 + (r.testResult.output?.length || 0)
      }
      if (r.files && r.files.length > 0) {
        promptChars += 50 + r.files.reduce((acc, f) => acc + (f.relativePath?.length || 0), 0)
      }
    }
  }
  if (priorTurnBaseline) promptChars += priorTurnBaseline.length + 50
  if (consensusReport) {
    const crText = typeof consensusReport === 'string' ? consensusReport : JSON.stringify(consensusReport)
    promptChars += crText.length + 50
  }
  if (compositeMergeDirective) promptChars += compositeMergeDirective.length + 50

  return Math.max(50, Math.ceil(promptChars / 4))
}

/**
 * Phase-by-phase runtime budget check (#158).
 * Checks if current spent + next phase estimate would exceed budget.
 */
export function checkPhaseBudget({
  phaseName = '',
  currentSpentUsd = 0,
  nextPhaseCostUsd = 0,
  maxBudgetUsd = 0,
  action = 'abort',
  enabled = true,
}) {
  if (!enabled || typeof maxBudgetUsd !== 'number' || maxBudgetUsd <= 0) {
    return { allowed: true }
  }
  const projectedTotal = Number((currentSpentUsd + nextPhaseCostUsd).toFixed(6))
  if (projectedTotal <= maxBudgetUsd) {
    return { allowed: true, projectedTotal }
  }
  return {
    allowed: false,
    action,
    currentSpentUsd,
    projectedTotal,
    maxBudgetUsd,
    reason: `Projected cost ($${projectedTotal.toFixed(4)}) before ${phaseName} exceeds max budget ($${maxBudgetUsd.toFixed(4)}). Current spent: $${currentSpentUsd.toFixed(4)}.`,
  }
}

/**
 * Applies budget guardrails before initiating parallel candidate execution.
 * Evaluates candidate runs, peer critique (Round 2) and downstream synthesis phases.
 */
export function applyBudgetGuardrails({
  references = [],
  enabled = false,
  maxBudgetUsd = 0,
  action = 'trim', // 'trim' | 'abort'
  prices = {},
  promptLength = 1000,
  projectContext = '',
  messages = [],
  judgeCriteria = '',
  maxTokens = 2048,
  peerCritiqueEnabled = false,
  aggregator = null,
  judgeModels = [],
}) {
  if (!enabled || typeof maxBudgetUsd !== 'number' || maxBudgetUsd <= 0 || references.length === 0) {
    return {
      allowed: true,
      references,
      action: 'none',
      estimatedCostUsd: 0,
    }
  }

  // Calculate full input tokens from userPrompt length + judgeCriteria + messages context + system prompt overhead
  let contextChars = Number(promptLength) || 1000
  if (typeof judgeCriteria === 'string' && judgeCriteria.length > 0 && !String(promptLength).includes(String(judgeCriteria.length))) {
    contextChars += judgeCriteria.length
  }
  if (typeof projectContext === 'string' && projectContext.length > 0 && !String(promptLength).includes(String(projectContext.length))) {
    contextChars += projectContext.length
  }
  if (Array.isArray(messages) && messages.length > 0) {
    for (const m of messages) {
      if (typeof m?.content === 'string') {
        contextChars += m.content.length
      } else if (Array.isArray(m?.content)) {
        for (const part of m.content) {
          if (part?.text) contextChars += part.text.length
        }
      }
    }
  }
  // System prompt and framing template overhead (~600 chars = ~150 tokens)
  const promptTokens = Math.max(50, Math.round((contextChars + 600) / 4))
  const expectedOutputTokens = typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 2048

  // Base candidate cost per slot (Round 1)
  const { totalEstimatedUsd, slotEstimates } = estimateCandidateRunCost(references, prices, promptTokens, expectedOutputTokens)

  // Calculate downstream cost with specific candidate count
  function calcDownstreamUsd(numCandidates) {
    return estimateDownstreamCost(aggregator, judgeModels, numCandidates, prices, expectedOutputTokens, promptTokens, peerCritiqueEnabled)
  }

  // Calculate Round 2 (Peer Critique) cost if enabled
  function calcRound2Usd(candidates) {
    if (!peerCritiqueEnabled || candidates.length <= 1) return 0
    return estimateRound2Cost(candidates, prices, expectedOutputTokens, promptTokens)
  }

  const r2Usd = calcRound2Usd(references)
  const downstreamUsd = calcDownstreamUsd(references.length)
  const fullEstimatedUsd = Number((totalEstimatedUsd + r2Usd + downstreamUsd).toFixed(6))

  if (fullEstimatedUsd <= maxBudgetUsd) {
    return {
      allowed: true,
      references,
      action: 'pass',
      estimatedCostUsd: fullEstimatedUsd,
    }
  }

  if (action === 'abort') {
    return {
      allowed: false,
      references: [],
      action: 'abort',
      estimatedCostUsd: fullEstimatedUsd,
      maxBudgetUsd,
      reason: `Estimated MoA run cost ($${fullEstimatedUsd.toFixed(4)}) exceeds configured max budget ($${maxBudgetUsd.toFixed(4)}).`,
    }
  }

  // Action is 'trim': Sort by estimated cost ascending (cheapest first)
  // Factor downstream synthesis cost and peer critique cost into candidate selection (#158)
  const sorted = [...slotEstimates].sort((a, b) => a.costUsd - b.costUsd)
  const kept = []

  for (const item of sorted) {
    const candidatePool = [...kept, item.slot]
    const candR1 = candidatePool.reduce((acc, c) => {
      const e = slotEstimates.find((s) => s.slot === c)
      return acc + (e?.costUsd || 0)
    }, 0)
    const candR2 = calcRound2Usd(candidatePool)
    const nextDownstream = calcDownstreamUsd(candidatePool.length)
    if (candR1 + candR2 + nextDownstream <= maxBudgetUsd) {
      kept.push(item.slot)
    }
  }

  if (kept.length === 0) {
    const minCandidateCost = sorted[0]?.costUsd || 0
    const minTotal = minCandidateCost + calcDownstreamUsd(1)
    return {
      allowed: false,
      references: [],
      action: 'trim',
      originalCount: references.length,
      trimmedCount: 0,
      estimatedCostUsd: Number(minTotal.toFixed(6)),
      maxBudgetUsd,
      reason: `Cannot fit any candidate model within budget ($${maxBudgetUsd.toFixed(4)}). Cheapest candidate requires $${minTotal.toFixed(4)}.`,
    }
  }

  const finalR1 = kept.reduce((acc, c) => {
    const e = slotEstimates.find((s) => s.slot === c)
    return acc + (e?.costUsd || 0)
  }, 0)
  const finalR2 = calcRound2Usd(kept)
  const finalEstimatedUsd = Number((finalR1 + finalR2 + calcDownstreamUsd(kept.length)).toFixed(6))

  return {
    allowed: true,
    references: kept,
    action: 'trim',
    originalCount: references.length,
    trimmedCount: kept.length,
    estimatedCostUsd: finalEstimatedUsd,
    maxBudgetUsd,
    reason: `Trimmed candidate pool from ${references.length} to ${kept.length} models to stay within budget ($${maxBudgetUsd.toFixed(4)}).`,
  }
}

/**
 * Constructs a structured budget abort failure payload (#158).
 */
export function createBudgetAbortPayload({
  reason,
  primaryJudge,
  referenceOutputs = [],
  currentSpentUsd = 0,
  preset = {},
  isRefinement = false,
  isFastMode = false,
  collectedCtx = {},
  startTime = Date.now(),
  multiJudgeResult = null,
}) {
  const aggLabel = (primaryJudge?.provider && primaryJudge?.model) ? `${primaryJudge.provider}:${primaryJudge.model}` : "none";
  const refTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens ?? ((r.usage?.inputTokens || 0) + (r.usage?.outputTokens || 0))), 0);
  const refInTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.inputTokens || r.usage?.promptTokens || 0), 0);
  const refOutTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.outputTokens || r.usage?.completionTokens || 0), 0);

  const mjUsage = multiJudgeResult?.totalUsage;
  const panelTokens = mjUsage?.totalTokens ?? ((mjUsage?.inputTokens || 0) + (mjUsage?.outputTokens || 0));
  const panelInTokens = mjUsage?.inputTokens || mjUsage?.promptTokens || 0;
  const panelOutTokens = mjUsage?.outputTokens || mjUsage?.completionTokens || 0;
  const panelCostUsd = mjUsage?.costUsd || multiJudgeResult?.totalCostUsd || 0;

  const refCost = referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0);
  const totalCostUsd = Number(Math.max(currentSpentUsd, refCost + panelCostUsd).toFixed(5));

  const totalTokens = refTokens + panelTokens;
  const totalInputTokens = refInTokens + panelInTokens;
  const totalOutputTokens = refOutTokens + panelOutTokens;

  return {
    kind: "failure",
    content: `🛑 Budget Guardrail Abort: ${reason}`,
    aggregator: aggLabel,
    references: referenceOutputs,
    presetName: preset?.name || "default",
    isRefinement,
    isFastMode,
    winningIndex: 0,
    winnerModel: "none",
    promotedFiles: [],
    usage: {
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
      aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      ...(multiJudgeResult ? { multiJudge: mjUsage || { inputTokens: panelInTokens, outputTokens: panelOutTokens, totalTokens: panelTokens, costUsd: panelCostUsd } } : {}),
    },
    multiJudgeResult: multiJudgeResult || undefined,
    skippedFiles: collectedCtx?.skippedFiles || 0,
    skippedList: collectedCtx?.skippedList || [],
    durationMs: Date.now() - startTime,
  };
}
