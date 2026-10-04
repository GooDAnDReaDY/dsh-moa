import crypto from 'node:crypto'
/**
 * Zero-latency Live Streaming Generator for MoA Turns
 */

import { cleanMoaWorkspaces, promoteCandidateWorkspace } from './file-workspace.js'
import { isTestEnvironment, getMoaHistory } from './history.js'
import { formatMoAResponse } from './moa-parser.js'
import { runMoAPipeline } from './moa-runner.js'

/**
 * Streams a full MoA turn into chat with live aggregator tokens and progress feedback.
 */
export async function* streamMoATurn({ targetPreset, userPrompt, messages, callLlm, cwd, prices, historyFilePath, liveCanvas, webServerPort, timeMachineEngine, force }, options = {}) {
  const signal = options?.signal
  const runId = options?.runId || null
  if (signal?.aborted) return

  const internalAbortCtrl = new AbortController()
  let combinedSignal = internalAbortCtrl.signal
  if (typeof AbortSignal?.any === 'function' && (signal instanceof AbortSignal)) {
    combinedSignal = AbortSignal.any([signal, internalAbortCtrl.signal])
  } else if (signal && typeof signal.addEventListener === 'function') {
    signal.addEventListener('abort', () => internalAbortCtrl.abort(), { once: true })
  }

  let done = false

  try {
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

    const pipelinePromise = runMoAPipeline({
      userPrompt,
      messages,
      preset: targetPreset,
      callLlm,
      cwd,
      onProgress: pushUpdate,
      onStreamDelta: (delta) => pushUpdate(delta),
      prices,
      historyFilePath,
      liveCanvas,
      webServerPort,
      timeMachineEngine,
      force,
      signal: combinedSignal,
      runId,
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

    while (!done || queue.length > 0) {
      if (combinedSignal.aborted) {
        await cleanMoaWorkspaces(cwd, runId ? { runId } : {})
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
    if (combinedSignal.aborted) {
      await cleanMoaWorkspaces(cwd, runId ? { runId } : {})
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
        inputTokens: result?.usage?.totalInputTokens ?? (result?.usage?.totalTokens || 0),
        outputTokens: result?.usage?.totalOutputTokens ?? Math.round((formatted.length || 0) / 4),
      },
    }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } finally {
    internalAbortCtrl.abort()
    if (!done) {
      await cleanMoaWorkspaces(cwd, runId ? { runId } : {}).catch(() => {})
    }
  }
}

/**
 * Streams a /moa promote candidate turn directly to chat with zero LLM calls (#177).
 */
export async function* streamPromoteTurn({ runId, candidateIndex, cwd, webServerPort, timeMachineEngine, force = isTestEnvironment() }, options = {}) {
  const signal = options?.signal
  if (signal?.aborted) return

  yield { type: 'block-start', index: 0, blockType: 'text' }

  if (typeof candidateIndex !== 'number' || isNaN(candidateIndex) || candidateIndex < 1) {
    const errText = '⚠️ **MoA Promote Error**: Valid candidate index required (>= 1).'
    yield { type: 'text-delta', index: 0, text: errText }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: errText } }
    yield { type: 'finish', reason: { kind: 'stop' } }
    return
  }

  try {
    const effectiveRunId = runId || getMoaHistory(1, 0).runs[0]?.id || null
    yield { type: 'text-delta', index: 0, text: `🔄 *Promoting candidate ${candidateIndex}${effectiveRunId ? ` for run \`${effectiveRunId}\`` : ''}...*\n\n` }

    const promotedFiles = await promoteCandidateWorkspace(cwd, candidateIndex, {
      runId: effectiveRunId,
      keepMoa: true,
      port: webServerPort,
      timeMachineEngine,
      force: Boolean(force || options?.force),
    })

    if (!promotedFiles || promotedFiles.length === 0) {
      const noFilesText = `⚠️ **MoA Promote Notice**: No candidate files found for candidate ${candidateIndex}${effectiveRunId ? ` in run \`${effectiveRunId}\`` : ''}. Workspace may have expired or run does not exist.`
      yield { type: 'text-delta', index: 0, text: noFilesText }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: noFilesText } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }

    const fileList = promotedFiles.map((f) => `\`${f}\``).join(', ')
    const checkpointId = promotedFiles.checkpoint || null
    let successMsg = `✅ **MoA Candidate ${candidateIndex} promoted successfully!**\n\n`
    successMsg += `> 📦 **Files applied to workspace**: ${fileList}\n`
    if (checkpointId) {
      successMsg += `> 🛡️ **Time Machine Checkpoint**: \`${checkpointId}\`\n`
    }

    yield { type: 'text-delta', index: 0, text: successMsg }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: successMsg } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } catch (err) {
    const errText = `⚠️ **MoA Promote Failed**: ${err?.message || String(err)}`
    yield { type: 'text-delta', index: 0, text: errText }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: errText } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
