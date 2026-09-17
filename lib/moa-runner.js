import { bestEffort } from './best-effort.js'
/**
 * DeepSeek Harness Mixture of Agents (MoA) — Runner Engine
 * Parallel fan-out, Consilium Round 2 peer critique, aggregator synthesis & streaming.
 */

import path from 'node:path'
import crypto from 'node:crypto'
import { extractFileBlocks, collectProjectContext, formatProjectContext, isRefinementTask, writeCandidateWorkspace, promoteCandidateWorkspace, cleanMoaWorkspaces, verifyFileSyntax } from './file-workspace.js'
import { estimateTokenCost, summarizeMoAUsage } from './pricing.js'
import { recordMoaRun, recordMoaRunAsync, candidatesForHistory } from './history.js'
import { createPromotedPreview } from './live-canvas.js'
import { slotLabel, cleanAdvisoryMessages, isBroadPromptRequiringQuestions, buildQuestionSynthesisPrompt, buildCuratorSynthesisPrompt, buildSynthesisPrompt, buildPeerCritiquePrompt, ROLE_PERSONA_PROMPTS, SYSTEM_ROLE_PROPOSER, ANTIPATTERNS_RUBRIC } from './moa-prompts.js'
import { parseWinnerIndex, parseRecommendedAssembler, parseMoACommand, stripOrSummarizeCode, formatMoAResponse } from './moa-parser.js'

// Re-exports for consumers & backward compatibility
export { slotLabel, cleanAdvisoryMessages, isBroadPromptRequiringQuestions, buildQuestionSynthesisPrompt, buildCuratorSynthesisPrompt, buildSynthesisPrompt, ANTIPATTERNS_RUBRIC } from './moa-prompts.js'
export { parseWinnerIndex, parseRecommendedAssembler, parseMoACommand, stripOrSummarizeCode, formatMoAResponse } from './moa-parser.js'
export { estimateTokenCost, summarizeMoAUsage } from './pricing.js'

const DEFAULT_PROMPT = 'Please propose an optimal, well-structured, production-ready solution with full code and explanations.'
export const REFERENCE_SYSTEM_PROMPT = SYSTEM_ROLE_PROPOSER

/**
 * Invokes LLM call with transient retry for recoverable network/rate-limit errors.
 */
export async function callWithTransientRetry(callLlmFn, callArgs, maxRetries = 0, retryDelayMs = 1200) {
  let attempt = 0
  while (true) {
    if (callArgs?.signal?.aborted) throw new Error('Aborted')
    try {
      return await callLlmFn(callArgs)
    } catch (err) {
      attempt++
      const msg = err?.message || String(err)
      const isTransient = /429|rate limit|502|503|504|econnreset|etimedout|socket hang up/i.test(msg)
      if (attempt <= maxRetries && isTransient && !callArgs?.signal?.aborted) {
        await new Promise((r) => setTimeout(r, retryDelayMs))
        if (callArgs?.signal?.aborted) throw new Error('Aborted')
        continue
      }
      throw err
    }
  }
}

/**
 * Dispatches queries to all reference models in parallel with transient retry and quorum straggler mitigation.
 */
export async function runReferencesParallel(references, messages, options = {}, callLlm, onProgress) {
  if (!Array.isArray(references) || references.length === 0) {
    return []
  }

  const advisoryMessages = cleanAdvisoryMessages(messages)
  const systemPrompt = options.systemPrompt || REFERENCE_SYSTEM_PROMPT
  const timeoutMs = options.timeoutMs ?? ((options.timeoutSec ?? 60) * 1000)
  const maxRetries = options.maxRetries ?? 0
  const quorumEnabled = Boolean(options.quorumEnabled)
  const gracePeriodMs = (options.gracePeriodSec ?? 10) * 1000

  const total = references.length
  let finishedCount = 0
  const results = new Array(total)
  const abortControllers = references.map(() => new AbortController())
  if (options.signal) {
    if (options.signal.aborted) {
      return references.map((r, i) => ({
        index: i + 1,
        provider: r.provider,
        model: r.model,
        label: slotLabel(r),
        ok: false,
        text: '(aborted)',
        error: 'Turn aborted',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
      }))
    }
    if (typeof options.signal.addEventListener === 'function') {
      options.signal.addEventListener('abort', () => {
        for (const ac of abortControllers) {
          bestEffort('turn abort signal', () => ac.abort(new Error('Turn aborted')))
        }
      }, { once: true })
    }
  }

  let onTaskFinished = null
  const notifyFinished = () => {
    if (typeof onTaskFinished === 'function') onTaskFinished()
  }

  if (typeof onProgress === 'function') {
    onProgress(`⚡ *Launching ${total} candidate models in parallel...*\n`)
  }

  references.forEach((slot, i) => {
    const label = slotLabel(slot)
    const persona = slot?.role_persona && ROLE_PERSONA_PROMPTS[slot.role_persona]
      ? `\n\n${ROLE_PERSONA_PROMPTS[slot.role_persona]}`
      : ''
    const slotMessages = [{ role: 'system', content: systemPrompt + persona }, ...advisoryMessages]

    const runOne = async () => {
      try {
        const callPromise = callWithTransientRetry(
          callLlm,
          {
            provider: slot.provider,
            model: slot.model,
            messages: slotMessages,
            temperature: options.temperature ?? 0.6,
            maxTokens: options.maxTokens ?? 4096,
            timeoutMs,
            signal: abortControllers[i].signal,
          },
          maxRetries
        )

        const timeoutPromise = new Promise((_, reject) => {
          const timer = setTimeout(() => reject(new Error(`Timeout after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)
          timer.unref?.()
          abortControllers[i].signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
        })

        const res = await Promise.race([callPromise, timeoutPromise])
        const text = typeof res === 'string' ? res : (res?.content || res?.text || '')

        const fallbackUsage = (typeof res === 'object' && res?.usage) ? res.usage : {
          inputTokens: Math.max(1, Math.round(slotMessages.map((m) => m.content).join('').length / 4)),
          outputTokens: Math.max(1, Math.round(text.length / 4)),
        }
        const costInfo = estimateTokenCost(slot, fallbackUsage, options.prices)

        finishedCount++
        if (typeof onProgress === 'function') {
          const costStr = costInfo.costUsd > 0 ? ` (~\$${costInfo.costUsd.toFixed(4)})` : ''
          onProgress(`✅ *Candidate ${i + 1}/${total} (${label}) finished${costStr}*\n`)
        }

        results[i] = {
          index: i + 1,
          slot,
          label,
          text,
          usage: costInfo,
          costUsd: costInfo.costUsd,
          ok: true,
        }
      } catch (err) {
        finishedCount++
        const errMsg = err?.message || String(err)
        console.warn(`[dsh-moa] Reference ${label} failed:`, errMsg)
        if (typeof onProgress === 'function') {
          onProgress(`⚠️ *Candidate ${i + 1}/${total} (${label}) error: ${errMsg}*\n`)
        }
        results[i] = {
          index: i + 1,
          slot,
          label,
          text: `[Model ${label} error: ${errMsg}]`,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
          costUsd: 0,
          ok: false,
          error: errMsg,
        }
      } finally {
        notifyFinished()
      }
    }

    runOne()
  })

  // Straggler mitigation via Quorum + Grace Period
  if (quorumEnabled && total >= 3) {
    const quorumTarget = Math.max(2, Math.min(total - 1, Math.ceil(total * 0.6)))
    let graceTimer = null

    await new Promise((resolve) => {
      const checkQuorum = () => {
        if (finishedCount >= total) {
          if (graceTimer) clearTimeout(graceTimer)
          resolve()
          return
        }

        if (finishedCount >= quorumTarget && !graceTimer) {
          if (typeof onProgress === 'function') {
            onProgress(`⏳ *Quorum reached (${finishedCount}/${total}). Starting ${Math.round(gracePeriodMs / 1000)}s grace period for stragglers...*\n`)
          }
          graceTimer = setTimeout(() => {
            if (typeof onProgress === 'function' && finishedCount < total) {
              onProgress(`⏩ *Grace period expired. Proceeding with ${finishedCount}/${total} ready candidates.*\n`)
            }
            for (let k = 0; k < total; k++) {
              if (!results[k]) {
                bestEffort('quorum grace period abort', () => abortControllers[k].abort(new Error('Quorum grace period timed out')))
              }
            }
            resolve()
          }, gracePeriodMs)
          graceTimer.unref?.()
        }
      }

      onTaskFinished = checkQuorum
      checkQuorum()
    })

    for (let i = 0; i < total; i++) {
      if (!results[i]) {
        const slot = references[i]
        const label = slotLabel(slot)
        results[i] = {
          index: i + 1,
          slot,
          label,
          text: `[Model ${label} timed out (quorum grace period exceeded)]`,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
          costUsd: 0,
          ok: false,
          error: 'Quorum grace period timed out',
        }
      }
    }
    return results
  }

  // Standard mode: wait for all tasks to complete
  await new Promise((resolve) => {
    const checkAll = () => {
      if (finishedCount >= total) resolve()
    }
    onTaskFinished = checkAll
    checkAll()
  })

  return results
}



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
}) {
  if (signal?.aborted) return { error: new Error('Turn aborted') }
  const startTime = Date.now()

  // 1. Resolve configurations
  const referenceModels = Array.isArray(preset?.reference_models) && preset.reference_models.length > 0
    ? preset.reference_models
    : [{ provider: 'opencode-go', model: 'deepseek-v4-flash' }]

  const primaryJudge = preset?.aggregator?.provider && preset?.aggregator?.model
    ? preset.aggregator
    : { provider: 'codex', model: 'gpt-5.6-sol' }

  const fallbackJudges = Array.isArray(preset?.aggregator_fallbacks) ? preset.aggregator_fallbacks : []
  const judgesChain = [primaryJudge, ...fallbackJudges]

  const refTemp = typeof preset?.reference_temperature === 'number' ? preset.reference_temperature : 0.6
  const aggTemp = typeof preset?.aggregator_temperature === 'number' ? preset.aggregator_temperature : 0.4
  const maxTokens = typeof preset?.max_tokens === 'number' ? preset.max_tokens : 4096
  const judgeCriteria = preset?.judge_criteria || ''
  const isFastMode = referenceModels.length === 1 && !preset?.curator_synthesis
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
  const runId = crypto.randomUUID()

  // 2. Collect project context for refinement tasks
  const collectedCtx = await collectProjectContext(cwd, 16000)
  const isRefinement = Boolean(collectedCtx?.files?.length > 0 && isRefinementTask(userPrompt, collectedCtx.files))
  let projectContext = ''
  if (isRefinement) {
    if (typeof onProgress === 'function') {
      onProgress('🔍 *Reading project files for refinement context...*\n')
    }
    projectContext = formatProjectContext(collectedCtx.files)
  }

  // 3. Build prompts & evaluate broad questionnaire needs
  const candidateSystemPrompt = projectContext
    ? `${REFERENCE_SYSTEM_PROMPT}\n\n### Current Project Files & Context:\n${projectContext}`
    : REFERENCE_SYSTEM_PROMPT

  const askClarifyingQuestions = preset?.ask_clarifying_questions !== false
  const needsQuestions = askClarifyingQuestions && isBroadPromptRequiringQuestions(userPrompt, messages)

  const enrichedMessages = [...messages, { role: 'user', content: userPrompt }]

  // 4. Parallel fan-out to candidate models with quorum & transient retry
  const referenceOutputs = await runReferencesParallel(
    referenceModels,
    enrichedMessages,
    {
      systemPrompt: candidateSystemPrompt,
      temperature: refTemp,
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
      await writeCandidateWorkspace(cwd, i + 1, files)
    }
  }

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
      console.warn('[dsh-moa] Questionnaire synthesis failed, proceeding with fallback questions:', err)
      questionsContent = `### Clarification of Requirements: "${userPrompt}"\n\n` +
        '1. **Architecture & Scope**: Single-file deliverable or multi-module project structure?\n' +
        '2. **Design & Style**: Minimalist, dark mode, or clean neutral theme?\n' +
        '3. **Functional Priorities**: Core MVP or comprehensive extended implementation?\n\n' +
        '*Reply with your preferences (e.g. "1, 2") or proceed with defaults.*'
    }

    await cleanMoaWorkspaces(cwd)
    const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0) + qUsage.totalTokens
    const totalCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + qUsage.costUsd).toFixed(5))
    const durationMs = Date.now() - startTime

    try {
      recordMoaRun({
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
      console.warn('[dsh-moa] Failed to record questionnaire run in history:', histErr?.message || histErr)
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
      recordMoaRun({
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
      console.warn('[dsh-moa] Failed to record fast synthesis run in history:', histErr?.message || histErr)
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
        .map((c) => ({ label: isBlindEvaluation ? `Candidate ${c.index}` : c.label, text: c.text }))
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
        console.warn('[dsh-moa] Failed to estimate Round 2 cost:', r2CostErr?.message || r2CostErr)
      }
    })
    await Promise.allSettled(r2Promises)
  }

  // 8. Synthesis phase via primary judge or fallback chain
  const synthesisPrompt = buildSynthesisPrompt(userPrompt, referenceOutputs, judgeCriteria, {
    curatorSynthesis: isCuratorSynthesis,
    blindEvaluation: isBlindEvaluation,
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
      console.warn(`[dsh-moa] Judge ${currentLabel} failed:`, err)
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
  const winningIndex = parseWinnerIndex(synthesizedText, 1, referenceOutputs.length)
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

  try {
    recordMoaRun({
      id: runId,
      prompt: userPrompt,
      preset: preset?.name || 'default',
      isRefinement,
      candidates: candidatesForHistory(referenceOutputs),
      aggregator: { provider: chosenJudge.provider, model: chosenJudge.model, usage: aggUsage, costUsd: aggUsage.costUsd },
      winnerIndex: winningIndex,
      winnerModel,
      promotedFiles,
      totalTokens: usageSummary.totalTokens,
      totalCostUsd: usageSummary.totalCostUsd,
      durationMs,
    }, historyFilePath || undefined)
  } catch (histErr) {
    console.warn('[dsh-moa] Failed to record run in history:', histErr)
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
    ...(livePreview ? { liveCanvas: livePreview } : {}),
    usage: usageSummary,
    durationMs,
  }
}

/**
 * Streams a full MoA turn into chat with live aggregator tokens and progress feedback.
 */
export async function* streamMoATurn({ targetPreset, userPrompt, messages, callLlm, cwd, prices, historyFilePath, liveCanvas }, options = {}) {
  const signal = options?.signal
  if (signal?.aborted) return

  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'text-delta', index: 0, text: '🧠 *Mixture of Agents started...*\n\n' }

  // Async push-queue for zero-latency live delta streaming
  const queue = []
  let notify = null

  const pushUpdate = (text) => {
    queue.push({ type: 'text-delta', index: 0, text })
    if (notify) {
      notify()
      notify = null
    }
  }

  let done = false
  const pipelinePromise = runMoAPipeline({
    userPrompt,
    messages,
    preset: targetPreset,
    callLlm,
    cwd,
    onProgress: pushUpdate,
    onStreamDelta: (delta) => {
      pushUpdate(delta)
    },
    prices,
    historyFilePath,
    liveCanvas,
    signal,
  })
    .catch((err) => ({ error: err }))
    .finally(() => {
      done = true
      if (notify) {
        notify()
        notify = null
      }
    })

  const startTime = Date.now()
  let lastYieldTime = Date.now()

  try {
    while (!done || queue.length > 0) {
      if (signal?.aborted) {
        await cleanMoaWorkspaces(cwd)
        return
      }

      while (queue.length > 0) {
        const item = queue.shift()
        yield item
        lastYieldTime = Date.now()
      }

      if (done) break

      // Wait for next push item or max 2.5s heartbeat
      await Promise.race([
        new Promise((resolve) => { notify = resolve }),
        new Promise((resolve) => { const t = setTimeout(resolve, 2500); t.unref?.(); }),
      ])

      const elapsedSec = Math.floor((Date.now() - startTime) / 1000)
      if (!done && Date.now() - lastYieldTime >= 3000) {
        yield { type: 'text-delta', index: 0, text: `⏳ *[${elapsedSec}s] Still processing...*\n` }
        lastYieldTime = Date.now()
      }
    }

    const result = await pipelinePromise
    if (signal?.aborted) {
      await cleanMoaWorkspaces(cwd)
      return
    }

    if (result?.error) {
      const errText = '\n\n⚠️ **Mixture of Agents error**: ' + (result.error?.message || String(result.error))
      yield { type: 'text-delta', index: 0, text: errText }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: errText } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }

    const formatted = formatMoAResponse({
      moaResult: result,
      presetName: targetPreset?.name || 'default',
    })

    yield { type: 'text-delta', index: 0, text: '\n---\n\n' + formatted }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: formatted } }
    yield {
      type: 'usage',
      usage: {
        inputTokens: result?.usage?.totalTokens || 0,
        outputTokens: Math.round((formatted.length || 0) / 4),
      },
    }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } finally {
    // cleanup
  }
}
