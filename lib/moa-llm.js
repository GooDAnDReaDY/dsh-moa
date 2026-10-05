function combineSignals(signal, timeoutSignal) {
  if (!signal) return timeoutSignal
  if (typeof AbortSignal.any === 'function') {
    try {
      return AbortSignal.any([signal, timeoutSignal])
    } catch {
      // fallback if signal is not an instance of AbortSignal
    }
  }
  const combinedCtrl = new AbortController()
  const onAbort = () => {
    const reason = signal.aborted ? (signal.reason || new Error('Turn aborted')) : timeoutSignal.reason
    combinedCtrl.abort(reason)
  }
  if (signal.aborted || timeoutSignal.aborted) {
    onAbort()
    return combinedCtrl.signal
  }
  signal.addEventListener?.('abort', onAbort, { once: true })
  timeoutSignal.addEventListener?.('abort', onAbort, { once: true })
  return combinedCtrl.signal
}

/**
 * Unified LLM Dispatcher using ctx.llm.prepareCall / stream
 */

export function createLlmCaller(ctx) {
  return async ({ provider, model, messages, temperature = 0.6, maxTokens = 2048, timeoutMs, onStreamDelta, signal, stop, reasoningEffort }) => {
    if (!ctx.llm) {
      throw new Error('ctx.llm is not available in cordis context')
    }

    const callConfig = {
      provider,
      model,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(stop !== undefined ? { stop } : {}),
      ...(reasoningEffort !== undefined ? { reasoningEffort } : {}),
    }

    let prep
    try {
      // DSH 0.2.0-rc.2 API expects LlmCallConfig object, supports signal
      prep = await ctx.llm.prepareCall(callConfig, signal)
    } catch (err) {
      if (typeof ctx.llm.prepareCall === 'function') {
        try {
          prep = await ctx.llm.prepareCall(provider, model)
        } catch {
          throw err
        }
      } else {
        throw err
      }
    }
    if (!prep || typeof prep.stream !== 'function') {
      throw new Error(`LLM provider/model ${provider}:${model} could not be prepared`)
    }

    if (signal?.aborted) {
      throw (signal.reason || new Error('Turn aborted'))
    }

    const effectiveTimeoutMs = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 120000
    const abortCtrl = new AbortController()
    const timeoutId = setTimeout(() => abortCtrl.abort(new Error(`LLM call timeout after ${Math.round(effectiveTimeoutMs / 1000)}s`)), effectiveTimeoutMs)
    timeoutId.unref?.()
    const combinedSignal = combineSignals(signal, abortCtrl.signal)

    try {
      const streamConfig = prep.config || callConfig
      const stream = prep.stream({
        ...streamConfig,
        messages,
        temperature: streamConfig.temperature ?? temperature,
        maxTokens: streamConfig.maxTokens ?? maxTokens,
        signal: combinedSignal,
      })

      let fullText = ''
      let usageInfo = null

      for await (const chunk of stream) {
        if (combinedSignal?.aborted) {
          throw (combinedSignal.reason || new Error('Turn aborted'))
        }
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
          fullText += chunk.text
          if (typeof onStreamDelta === 'function') {
            onStreamDelta(chunk.text)
          }
        } else if (chunk.type === 'block-end' && chunk.block?.text) {
          if (!fullText) fullText = chunk.block.text
        } else if (chunk.type === 'usage' && chunk.usage) {
          usageInfo = chunk.usage
        } else if (chunk.type === 'finish') {
          const reason = chunk.reason
          if (reason && (reason.kind === 'error' || reason.kind === 'aborted')) {
            const failure = reason.failure || {}
            const errMsg = failure.message || failure.error?.message || reason.message || reason.error?.message || `LLM stream finished with ${reason.kind}`
            const err = new Error(errMsg)
            err.code = failure.code || reason.code || (reason.kind === 'error' ? 'LLM_ERROR' : 'ABORT_ERR')
            if (failure.cause) err.cause = failure.cause
            throw err
          }
        } else if (chunk.type === 'error') {
          const errMsg = chunk.error?.message || chunk.message || 'LLM stream error'
          const err = new Error(errMsg)
          err.code = chunk.code || chunk.error?.code || 'LLM_ERROR'
          if (chunk.error?.cause) err.cause = chunk.error.cause
          throw err
        }
      }

      if (combinedSignal?.aborted) {
        throw (combinedSignal.reason || new Error('Turn aborted'))
      }

      if (!fullText.trim()) {
        const err = new Error('LLM call returned empty response')
        err.code = 'EMPTY_RESPONSE'
        throw err
      }

      clearTimeout(timeoutId)
      return {
        content: fullText,
        text: fullText,
        usage: usageInfo || {
          inputTokens: Math.round(JSON.stringify(messages).length / 4),
          outputTokens: Math.round(fullText.length / 4),
        },
      }
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  }
}


export function callConfigEquals(a, b) {
  if (!a || !b) return false
  if (a.provider !== b.provider) return false
  if (a.model !== b.model) return false
  if (a.temperature !== b.temperature) return false
  if (a.maxTokens !== b.maxTokens) return false
  if (a.reasoningEffort !== b.reasoningEffort) return false
  return true
}
