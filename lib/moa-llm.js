/**
 * Unified LLM Dispatcher using ctx.llm.prepareCall / stream
 */

export function createLlmCaller(ctx) {
  return async ({ provider, model, messages, temperature = 0.6, maxTokens = 4096, timeoutMs, onStreamDelta, signal, stop, reasoningEffort }) => {
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

    const effectiveTimeoutMs = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 120000
    const abortCtrl = new AbortController()
    const timeoutId = setTimeout(() => abortCtrl.abort(new Error(`LLM call timeout after ${Math.round(effectiveTimeoutMs / 1000)}s`)), effectiveTimeoutMs)
    timeoutId.unref?.()

    try {
      const streamConfig = prep.config || callConfig
      const stream = prep.stream({
        ...streamConfig,
        messages,
        temperature: streamConfig.temperature ?? temperature,
        maxTokens: streamConfig.maxTokens ?? maxTokens,
        signal: abortCtrl.signal,
      })

      let fullText = ''
      let usageInfo = null

      for await (const chunk of stream) {
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
          fullText += chunk.text
          if (typeof onStreamDelta === 'function') {
            onStreamDelta(chunk.text)
          }
        } else if (chunk.type === 'block-end' && chunk.block?.text) {
          if (!fullText) fullText = chunk.block.text
        } else if (chunk.type === 'usage' && chunk.usage) {
          usageInfo = chunk.usage
        }
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
