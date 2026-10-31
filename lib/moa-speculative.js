/**
 * Speculative MoA with Fast-Draft Model and Multi-Auditor Diffs (#247)
 * Generates a rapid initial draft using speculative_draft_model, dispatches the draft
 * to reference models in parallel as diff auditors (producing targeted SEARCH/REPLACE
 * or unified diff hunks), applies valid hunks to the draft, and gracefully falls back
 * to standard parallel MoA if the draft model fails.
 */

import { logger } from './logger.js'
import { slotLabel } from './moa-prompts.js'
import { estimateTokenCost } from './pricing.js'

/**
 * Applies SEARCH/REPLACE or unified diff patches onto a base draft text.
 *
 * @param {string} draftText
 * @param {string} patchText
 * @returns {{ patchedText: string, appliedCount: number }}
 */
export function applyAuditorPatchHunks(draftText = '', patchText = '') {
  let result = String(draftText || '')
  let appliedCount = 0

  // 1. Support SEARCH / REPLACE blocks:
  // <<<<<<< SEARCH
  // ...
  // =======
  // ...
  // >>>>>>> REPLACE
  const searchReplaceRegex = /<{5,9}\s*SEARCH\r?\n([\s\S]*?)\r?\n={5,9}\r?\n([\s\S]*?)\r?\n>{5,9}\s*REPLACE/g
  let srMatch
  while ((srMatch = searchReplaceRegex.exec(patchText)) !== null) {
    const searchBlock = srMatch[1]
    const replaceBlock = srMatch[2]
    if (searchBlock && result.includes(searchBlock)) {
      result = result.replace(searchBlock, replaceBlock)
      appliedCount++
    }
  }

  // 2. Support unified diff hunks (- oldLine / + newLine)
  if (appliedCount === 0 && /```diff[\r\n]+([\s\S]*?)```/i.test(patchText)) {
    const diffMatch = /```diff[\r\n]+([\s\S]*?)```/i.exec(patchText)
    const diffLines = diffMatch[1].split(/\r?\n/)
    const removed = []
    const added = []
    for (const line of diffLines) {
      if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) continue
      if (line.startsWith('-')) removed.push(line.slice(1))
      else if (line.startsWith('+')) added.push(line.slice(1))
    }
    if (removed.length > 0) {
      const targetChunk = removed.join('\n')
      const replacementChunk = added.join('\n')
      if (result.includes(targetChunk)) {
        result = result.replace(targetChunk, replacementChunk)
        appliedCount++
      }
    }
  }

  return { patchedText: result, appliedCount }
}

/**
 * Executes Speculative MoA:
 * 1. Calls fast draft model (`speculative_draft_model` or first reference slot).
 * 2. Dispatches draft to reference models in parallel as diff auditors.
 * 3. Applies valid diff hunks onto draft so each auditor produces a refined candidate output.
 * 4. If the draft model fails, returns `{ fallbackToStandard: true }` so the caller runs standard parallel MoA.
 */
export async function runSpeculativeMoa(references = [], messages = [], options = {}, callLlm, onProgress) {
  const draftSlot = (options.draftModel?.provider && options.draftModel?.model)
    ? options.draftModel
    : references[0]

  if (!draftSlot || !draftSlot.provider || !draftSlot.model) {
    return { fallbackToStandard: true, reason: 'No valid speculative draft model configured' }
  }

  const draftLabel = slotLabel(draftSlot)
  if (typeof onProgress === 'function') {
    onProgress(`⚡ *Speculative MoA: Generating fast initial draft with \`${draftLabel}\`...*\n`)
  }

  const draftStart = Date.now()
  let draftText = ''
  let draftUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }

  try {
    const draftRes = await callLlm({
      provider: draftSlot.provider,
      model: draftSlot.model,
      messages,
      systemPrompt: options.systemPrompt,
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 4096,
      signal: options.signal,
    })
    draftText = typeof draftRes === 'string' ? draftRes : (draftRes?.content || draftRes?.text || '')
    if (!draftText || !draftText.trim()) {
      throw new Error('Empty draft response from speculative draft model')
    }
    const rawUsage = (typeof draftRes === 'object' && draftRes?.usage) ? draftRes.usage : {
      inputTokens: 100,
      outputTokens: Math.max(1, Math.round(draftText.length / 4)),
    }
    draftUsage = estimateTokenCost(draftSlot, rawUsage, options.prices || {})
  } catch (err) {
    logger.warn(`[dsh-moa:speculative] Draft model ${draftLabel} failed (${err?.message || err}); falling back to standard parallel MoA.`)
    if (typeof onProgress === 'function') {
      onProgress(`⚠️ *Speculative draft model \`${draftLabel}\` failed; falling back to standard parallel MoA...*\n`)
    }
    return { fallbackToStandard: true, reason: err?.message || String(err) }
  }

  const draftDurationMs = Date.now() - draftStart
  if (typeof onProgress === 'function') {
    onProgress(`🔍 *Speculative MoA: Dispatching draft to ${references.length} parallel diff auditor(s)...*\n`)
  }

  const lastUserPrompt = messages[messages.length - 1]?.content || ''
  const auditTasks = references.map(async (slot, idx) => {
    const candidateIndex = idx + 1
    const label = slotLabel(slot)
    const auditStart = Date.now()

    const auditPrompt = [
      `You are Speculative Auditor #${candidateIndex} (${label}).`,
      `Review the fast draft below for the user task and provide targeted diff fixes (logic bugs, edge cases, types, security) using SEARCH/REPLACE blocks or \`\`\`diff hunks.`,
      `\n### Original User Task:\n${lastUserPrompt}`,
      `\n### Fast Draft Solution (${draftLabel}):\n${draftText}`,
      `\nOutput your audit notes and any SEARCH/REPLACE or \`\`\`diff blocks needed to perfect the draft.`,
    ].join('\n')

    try {
      const auditRes = await callLlm({
        provider: slot.provider,
        model: slot.model,
        messages: [{ role: 'user', content: auditPrompt }],
        temperature: 0.2,
        maxTokens: Math.min(options.maxTokens ?? 2048, 2048),
        signal: options.signal,
      })
      const auditText = typeof auditRes === 'string' ? auditRes : (auditRes?.content || auditRes?.text || '')
      const rawAuditUsage = (typeof auditRes === 'object' && auditRes?.usage) ? auditRes.usage : {
        inputTokens: Math.max(1, Math.round(auditPrompt.length / 4)),
        outputTokens: Math.max(1, Math.round(auditText.length / 4)),
      }
      const auditCost = estimateTokenCost(slot, rawAuditUsage, options.prices || {})

      const { patchedText, appliedCount } = applyAuditorPatchHunks(draftText, auditText)
      const combinedText = appliedCount > 0
        ? `${patchedText}\n\n#### Speculative Auditor Diff Notes (${label}, ${appliedCount} hunk(s) applied):\n${auditText}`
        : `${draftText}\n\n#### Speculative Auditor Review (${label}):\n${auditText}`

      return {
        index: candidateIndex,
        slot,
        label,
        text: combinedText,
        speculativeAppliedHunks: appliedCount,
        speculativeDraftModel: draftLabel,
        usage: {
          inputTokens: auditCost.inputTokens + (idx === 0 ? draftUsage.inputTokens : 0),
          outputTokens: auditCost.outputTokens + (idx === 0 ? draftUsage.outputTokens : 0),
          totalTokens: auditCost.totalTokens + (idx === 0 ? draftUsage.totalTokens : 0),
        },
        costUsd: Number((auditCost.costUsd + (idx === 0 ? draftUsage.costUsd : 0)).toFixed(6)),
        durationMs: (Date.now() - auditStart) + (idx === 0 ? draftDurationMs : 0),
        ok: true,
      }
    } catch (err) {
      return {
        index: candidateIndex,
        slot,
        label,
        text: draftText,
        error: err?.message || String(err),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
        durationMs: Date.now() - auditStart,
        ok: false,
      }
    }
  })

  const referenceOutputs = await Promise.all(auditTasks)
  return {
    fallbackToStandard: false,
    draftModel: draftLabel,
    draftText,
    referenceOutputs,
  }
}
