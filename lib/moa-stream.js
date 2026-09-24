/**
 * Zero-latency Live Streaming Generator for MoA Turns
 */

import { cleanMoaWorkspaces } from './file-workspace.js'
import { formatMoAResponse } from './moa-parser.js'
import { runMoAPipeline } from './moa-runner.js'

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
    onStreamDelta: (delta) => pushUpdate(delta),
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
