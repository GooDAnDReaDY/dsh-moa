import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MoaError,
  RateLimitError,
  ContextOverflowError,
  AuthenticationError,
  ModelNotFoundError,
  TransientNetworkError,
  classifyLlmError,
  isFailoverEligible,
} from '../lib/errors.js'
import {
  callWithTransientRetry,
  runReferencesParallel,
} from '../lib/moa-candidates.js'

test('issue #282: Error Taxonomy and inheritance', () => {
  const base = new MoaError('generic error')
  assert.ok(base instanceof Error)
  assert.equal(base.name, 'MoaError')
  assert.equal(base.code, 'MOA_ERROR')

  const rateLimit = new RateLimitError('Rate limit exceeded')
  assert.ok(rateLimit instanceof MoaError)
  assert.equal(rateLimit.name, 'RateLimitError')
  assert.equal(rateLimit.status, 429)
  assert.equal(rateLimit.isRetryable, true)
  assert.equal(rateLimit.fallbackEligible, true)

  const contextOverflow = new ContextOverflowError('Context length exceeded: 130000 tokens')
  assert.ok(contextOverflow instanceof MoaError)
  assert.equal(contextOverflow.name, 'ContextOverflowError')
  assert.equal(contextOverflow.status, 400)
  assert.equal(contextOverflow.isRetryable, false)
  assert.equal(contextOverflow.fallbackEligible, true)

  const authErr = new AuthenticationError('Invalid API key')
  assert.ok(authErr instanceof MoaError)
  assert.equal(authErr.name, 'AuthenticationError')
  assert.equal(authErr.status, 401)
  assert.equal(authErr.isRetryable, false)
  assert.equal(authErr.fallbackEligible, false)

  const notFound = new ModelNotFoundError('Model anthropic:claude-99 not found')
  assert.ok(notFound instanceof MoaError)
  assert.equal(notFound.name, 'ModelNotFoundError')
  assert.equal(notFound.status, 404)
  assert.equal(notFound.isRetryable, false)
  assert.equal(notFound.fallbackEligible, true)

  const transient = new TransientNetworkError('Gateway Timeout')
  assert.ok(transient instanceof MoaError)
  assert.equal(transient.name, 'TransientNetworkError')
  assert.equal(transient.status, 503)
  assert.equal(transient.isRetryable, true)
  assert.equal(transient.fallbackEligible, true)
})

test('issue #282: classifyLlmError accurately categorizes various error patterns', () => {
  // 429 RateLimit
  const e1 = classifyLlmError(new Error('429 Too Many Requests: TPM limit reached'))
  assert.ok(e1 instanceof RateLimitError)
  assert.equal(e1.status, 429)

  // Context overflow
  const e2 = classifyLlmError(new Error('Prompt exceeds maximum context length of 128k'))
  assert.ok(e2 instanceof ContextOverflowError)
  assert.equal(e2.status, 400)

  // Auth failure
  const e3 = classifyLlmError(new Error('401 Unauthorized: Invalid API key supplied'))
  assert.ok(e3 instanceof AuthenticationError)
  assert.equal(e3.status, 401)

  // Model not found
  const e4 = classifyLlmError(new Error('404 The model `gpt-5-preview` does not exist'))
  assert.ok(e4 instanceof ModelNotFoundError)

  // Transient network error
  const e5 = classifyLlmError(new Error('read ECONNRESET at TLSWrap.onStreamRead'))
  assert.ok(e5 instanceof TransientNetworkError)

  // Existing MoaError should pass through
  const custom = new RateLimitError('already typed')
  assert.equal(classifyLlmError(custom), custom)
})

test('issue #282: isFailoverEligible guards non-retryable fatal errors', () => {
  assert.equal(isFailoverEligible(new Error('429 Rate limit exceeded')), true)
  assert.equal(isFailoverEligible(new Error('Context window exceeded')), true)
  assert.equal(isFailoverEligible(new Error('502 Bad Gateway')), true)
  assert.equal(isFailoverEligible(new Error('401 Unauthorized')), false)
  assert.equal(isFailoverEligible(new AuthenticationError('Bad token')), false)
})

test('issue #282: callWithTransientRetry retries retryable errors and skips non-retryable', async () => {
  let attempts = 0
  const retryableFn = async () => {
    attempts++
    if (attempts < 2) throw new Error('429 rate limit')
    return 'success'
  }

  const res = await callWithTransientRetry(retryableFn, {}, 2, 10)
  assert.equal(res, 'success')
  assert.equal(attempts, 2)

  // Non-retryable (ContextOverflow) should throw immediately without retrying
  let nonRetryableAttempts = 0
  const fatalFn = async () => {
    nonRetryableAttempts++
    throw new Error('context window exceeded')
  }

  await assert.rejects(
    async () => callWithTransientRetry(fatalFn, {}, 3, 10),
    (err) => {
      assert.ok(err instanceof ContextOverflowError)
      return true
    }
  )
  assert.equal(nonRetryableAttempts, 1, 'did not waste attempts retrying non-retryable context error')
})

test('issue #282: candidate failover recovers from 429 RateLimit via slot.fallbacks', async () => {
  const references = [
    {
      provider: 'primary-prov',
      model: 'primary-model',
      fallbacks: [
        { provider: 'reserve-prov', model: 'reserve-model' },
      ],
    },
  ]

  const mockCallLlm = async (callArgs) => {
    if (callArgs.model === 'primary-model') {
      throw new Error('429 Too Many Requests: TPM limit exceeded')
    }
    if (callArgs.model === 'reserve-model') {
      return { content: 'Response from reserve model' }
    }
    throw new Error('Unexpected model')
  }

  const results = await runReferencesParallel(references, [{ role: 'user', content: 'test' }], {}, mockCallLlm)

  assert.equal(results.length, 1)
  const candidate = results[0]
  assert.equal(candidate.ok, true)
  assert.equal(candidate.was_fallback, true)
  assert.equal(candidate.failoverReason, 'RATE_LIMIT_EXCEEDED')
  assert.equal(candidate.text, 'Response from reserve model')
  assert.match(candidate.label, /reserve-prov:reserve-model/)
})

test('issue #282: candidate failover recovers from ContextOverflow via options.fallback_models', async () => {
  const references = [
    {
      provider: 'deepseek',
      model: 'deepseek-chat',
    },
  ]

  const options = {
    fallback_models: [
      { provider: 'ollama', model: 'qwen2.5-coder:32b' },
    ],
  }

  const mockCallLlm = async (callArgs) => {
    if (callArgs.model === 'deepseek-chat') {
      throw new Error('maximum context length of 64k tokens exceeded')
    }
    if (callArgs.model === 'qwen2.5-coder:32b') {
      return 'Long context answered by fallback'
    }
    throw new Error('Unknown model')
  }

  const results = await runReferencesParallel(references, [{ role: 'user', content: 'large prompt' }], options, mockCallLlm)

  assert.equal(results.length, 1)
  const candidate = results[0]
  assert.equal(candidate.ok, true)
  assert.equal(candidate.was_fallback, true)
  assert.equal(candidate.failoverReason, 'CONTEXT_WINDOW_EXCEEDED')
  assert.equal(candidate.text, 'Long context answered by fallback')
})

test('issue #282: candidate fails fast on AuthenticationError without attempting failover', async () => {
  const references = [
    {
      provider: 'openai',
      model: 'gpt-4o',
      fallbacks: [
        { provider: 'reserve', model: 'reserve-model' },
      ],
    },
  ]

  let fallbackAttempted = false
  const mockCallLlm = async (callArgs) => {
    if (callArgs.model === 'gpt-4o') {
      throw new Error('401 Unauthorized: Invalid API key')
    }
    if (callArgs.model === 'reserve-model') {
      fallbackAttempted = true
      return 'should not be called'
    }
    throw new Error('Unknown model')
  }

  const results = await runReferencesParallel(references, [{ role: 'user', content: 'test' }], {}, mockCallLlm)

  assert.equal(results.length, 1)
  const candidate = results[0]
  assert.equal(candidate.ok, false)
  assert.equal(candidate.errorClass, 'AuthenticationError')
  assert.equal(candidate.errorCode, 'AUTHENTICATION_FAILED')
  assert.equal(fallbackAttempted, false, 'did not attempt failover for authentication error')
})