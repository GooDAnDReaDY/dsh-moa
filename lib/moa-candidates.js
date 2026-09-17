/**
 * DeepSeek Harness Mixture of Agents (MoA) — Candidate Fan-Out & Retry
 */

import { bestEffort } from './best-effort.js'
import { slotLabel, cleanAdvisoryMessages, ROLE_PERSONA_PROMPTS, SYSTEM_ROLE_PROPOSER } from './moa-prompts.js'
import { estimateTokenCost } from './pricing.js'

export const REFERENCE_SYSTEM_PROMPT = SYSTEM_ROLE_PROPOSER

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
