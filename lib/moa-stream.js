import crypto from 'node:crypto'
/**
 * Zero-latency Live Streaming Generator for MoA Turns
 */

import { cleanMoaWorkspaces } from './file-workspace.js'
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
