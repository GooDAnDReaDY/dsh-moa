import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createLlmCaller, callConfigEquals } from '../lib/moa-llm.js'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { runReferencesParallel } from '../lib/moa-candidates.js'

test('contracts #155: createLlmCaller supports strict DSH 0.2.0-rc.2 prepared-call contract', async () => {
  let receivedCallConfig = null
  let receivedStreamOptions = null
  let streamDispatched = false

  const mockCtx = {
    llm: {
      async prepareCall(config, signal) {
        receivedCallConfig = config
        const resolvedConfig = {
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          reasoningEffort: config.reasoningEffort,
        }
        return {
          config: resolvedConfig,
          stream(options) {
            receivedStreamOptions = options
            if (streamDispatched) {
              const err = new Error('prepared call dispatched twice')
              err.code = 'INVALID_PREPARED_CALL'
              throw err
            }
            if (!callConfigEquals(options, resolvedConfig)) {
              const err = new Error('prepared LLM call config changed before adapter dispatch')
              err.code = 'INVALID_PREPARED_CALL'
              throw err
            }
            streamDispatched = true
            return (async function* () {
              yield { type: 'text-delta', text: 'ok response from 0.2.0-rc.2' }
            })()
          }
        }
      }
    }
  }

  const caller = createLlmCaller(mockCtx)
  const res = await caller({
    provider: 'deepseek',
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'test contract' }],
    temperature: 0.7,
    maxTokens: 2048,
    reasoningEffort: 'low',
  })

  assert.equal(res.text, 'ok response from 0.2.0-rc.2')
  assert.equal(receivedCallConfig.provider, 'deepseek')
  assert.equal(receivedCallConfig.model, 'deepseek-chat')
  assert.equal(receivedCallConfig.temperature, 0.7)
  assert.equal(receivedCallConfig.maxTokens, 2048)
  assert.equal(receivedCallConfig.reasoningEffort, 'low')
  assert.equal(receivedStreamOptions.provider, 'deepseek')
  assert.equal(receivedStreamOptions.temperature, 0.7)
  assert.equal(receivedStreamOptions.maxTokens, 2048)
})

test('contracts #155: createLlmCaller falls back to legacy positional prepareCall', async () => {
  let positionalCalled = false
  const mockCtx = {
    llm: {
      async prepareCall(arg1, arg2) {
        if (typeof arg1 === 'object') {
          throw new Error('legacy only supports positional arguments')
        }
        positionalCalled = true
        assert.equal(arg1, 'legacy-prov')
        assert.equal(arg2, 'legacy-mod')
        return {
          stream(options) {
            return (async function* () {
              yield { type: 'text-delta', text: 'legacy response' }
            })()
          }
        }
      }
    }
  }

  const caller = createLlmCaller(mockCtx)
  const res = await caller({
    provider: 'legacy-prov',
    model: 'legacy-mod',
    messages: [{ role: 'user', content: 'hi' }]
  })

  assert.equal(positionalCalled, true)
  assert.equal(res.text, 'legacy response')
})

test('contracts #156: cancellation immediately aborts before stream and during stream', async () => {
  let providerSawAbort = false
  let chunksEmitted = 0

  const mockCtx = {
    llm: {
      async prepareCall(config, signal) {
        return {
          config,
          stream(options) {
            if (options.signal) {
              options.signal.addEventListener('abort', () => {
                providerSawAbort = true
              })
            }
            return (async function* () {
              chunksEmitted++
              yield { type: 'text-delta', text: 'chunk 1' }
              await new Promise(r => setTimeout(r, 80))
              if (options.signal?.aborted) return
              chunksEmitted++
              yield { type: 'text-delta', text: 'chunk 2' }
            })()
          }
        }
      }
    }
  }

  const caller = createLlmCaller(mockCtx)

  // 1. Pre-aborted signal fails fast
  const preCtrl = new AbortController()
  preCtrl.abort()
  await assert.rejects(
    caller({
      provider: 'p',
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      signal: preCtrl.signal,
    }),
    /aborted/i
  )

  // 2. In-flight abort interrupts stream and notifies provider
  const midCtrl = new AbortController()
  const midPromise = caller({
    provider: 'p',
    model: 'm',
    messages: [{ role: 'user', content: 'hi' }],
    signal: midCtrl.signal,
    onStreamDelta() {
      midCtrl.abort()
    }
  })

  await assert.rejects(midPromise, /aborted/i)
  assert.equal(providerSawAbort, true)
  assert.equal(chunksEmitted, 1)
})

test('contracts #156: late cancellation prevents file promotion and workspace pollution', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-contract-late-'))
  const userFile = path.join(tmpDir, 'project.js')
  fs.writeFileSync(userFile, 'const original = true\n')

  const abortCtrl = new AbortController()
  const mockCtx = {
    llm: {
      async prepareCall(config, signal) {
        return {
          config,
          stream(options) {
            return (async function* () {
              yield { type: 'text-delta', text: '```js:project.js\nconst overwritten = true\n```' }
            })()
          }
        }
      }
    }
  }

  // Abort before judge synthesis promotion
  abortCtrl.abort()

  const caller = createLlmCaller(mockCtx)
  const res = await runMoAPipeline({
    userPrompt: 'refactor code',
    cwd: tmpDir,
    callLlm: caller,
    signal: abortCtrl.signal,
    preset: {
      reference_models: [{ provider: 'p', model: 'm1' }, { provider: 'p', model: 'm2' }],
      aggregator_model: { provider: 'p', model: 'agg' },
    }
  })

  assert.equal(fs.readFileSync(userFile, 'utf8'), 'const original = true\n')
  assert.equal(res.promotedFiles?.length ?? 0, 0)
  assert.ok(res.error)

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('contracts #157: terminal finish(error) and chunk.type error throw rather than returning empty text', async () => {
  // 1. finish(error) with failure details
  const mockCtxErrorFinish = {
    llm: {
      async prepareCall(config, signal) {
        return {
          config,
          stream(options) {
            return (async function* () {
              yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 0 } }
              yield {
                type: 'finish',
                reason: {
                  kind: 'error',
                  failure: { code: 'RATE_LIMIT', message: 'Upstream rate limit exceeded' }
                }
              }
            })()
          }
        }
      }
    }
  }

  const caller1 = createLlmCaller(mockCtxErrorFinish)
  await assert.rejects(
    caller1({ provider: 'p', model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    (err) => {
      assert.equal(err.code, 'RATE_LIMIT')
      assert.match(err.message, /Upstream rate limit exceeded/)
      return true
    }
  )

  // 2. chunk.type === 'error'
  const mockCtxErrorChunk = {
    llm: {
      async prepareCall(config, signal) {
        return {
          config,
          stream(options) {
            return (async function* () {
              yield { type: 'error', code: 'SERVER_ERROR', message: 'Internal LLM crash' }
            })()
          }
        }
      }
    }
  }

  const caller2 = createLlmCaller(mockCtxErrorChunk)
  await assert.rejects(
    caller2({ provider: 'p', model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    (err) => {
      assert.equal(err.code, 'SERVER_ERROR')
      assert.match(err.message, /Internal LLM crash/)
      return true
    }
  )

  // 3. Degenerate empty completion throws EMPTY_RESPONSE
  const mockCtxEmpty = {
    llm: {
      async prepareCall(config, signal) {
        return {
          config,
          stream(options) {
            return (async function* () {
              yield { type: 'finish', reason: { kind: 'stop' } }
            })()
          }
        }
      }
    }
  }

  const caller3 = createLlmCaller(mockCtxEmpty)
  await assert.rejects(
    caller3({ provider: 'p', model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    (err) => {
      assert.equal(err.code, 'EMPTY_RESPONSE')
      return true
    }
  )
})

test('contracts #163: local fallback model receives dedicated signal and succeeds after cloud timeout', async () => {
  let cloudCalls = 0
  let fallbackCalls = 0
  let fallbackReceivedAbortedSignal = null

  const callLlm = async (opts) => {
    if (opts.provider === 'cloud') {
      cloudCalls++
      return new Promise((resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new Error('Cloud timed out'))
        })
      })
    }
    if (opts.provider === 'local') {
      fallbackCalls++
      fallbackReceivedAbortedSignal = Boolean(opts.signal?.aborted)
      if (opts.signal?.aborted) {
        throw new Error('Fallback called with already-aborted signal')
      }
      return { content: 'recovered response from local fallback', usage: { inputTokens: 10, outputTokens: 20 } }
    }
    throw new Error(`Unexpected provider ${opts.provider}`)
  }

  const res = await runReferencesParallel(
    [{ provider: 'cloud', model: 'cloud-primary' }],
    [{ role: 'user', content: 'test prompt' }],
    {
      timeoutMs: 60,
      local_fallback_enabled: true,
      local_fallback_models: [{ provider: 'local', model: 'local-rescue' }]
    },
    callLlm
  )

  assert.equal(cloudCalls, 1)
  assert.equal(fallbackCalls, 1)
  assert.equal(fallbackReceivedAbortedSignal, false)
  assert.equal(res[0]?.ok, true)
  assert.equal(res[0]?.was_fallback, true)
  assert.equal(res[0]?.text, 'recovered response from local fallback')
})

test('contracts #163: whole-turn abort terminates immediately without executing local fallbacks', async () => {
  let fallbackAttempted = false
  const turnCtrl = new AbortController()

  const callLlm = async (opts) => {
    if (opts.provider === 'cloud') {
      return new Promise((resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new Error('Cloud timed out'))
        })
      })
    }
    if (opts.provider === 'local') {
      fallbackAttempted = true
      return { content: 'should not run', usage: { inputTokens: 1, outputTokens: 1 } }
    }
    throw new Error('Unexpected')
  }

  setTimeout(() => turnCtrl.abort(), 20)

  const res = await runReferencesParallel(
    [{ provider: 'cloud', model: 'cloud-primary' }],
    [{ role: 'user', content: 'test' }],
    {
      timeoutMs: 100,
      signal: turnCtrl.signal,
      local_fallback_enabled: true,
      local_fallback_models: [{ provider: 'local', model: 'local-rescue' }]
    },
    callLlm
  )

  assert.equal(fallbackAttempted, false)
  assert.equal(res[0]?.ok, false)
  assert.match(res[0]?.error, /aborted/i)
})
