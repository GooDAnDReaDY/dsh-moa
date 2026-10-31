/**
 * Centralized LLM and MoA Pipeline Error Taxonomy and Classification
 */

export class MoaError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   */
  constructor(message, options = {}) {
    super(message)
    this.name = new.target.name || 'MoaError'
    this.code = options.code || 'MOA_ERROR'
    this.status = typeof options.status === 'number' ? options.status : undefined
    this.isRetryable = Boolean(options.isRetryable)
    this.fallbackEligible = options.fallbackEligible !== false
    this.cause = options.cause
  }
}

export class RateLimitError extends MoaError {
  constructor(message, options = {}) {
    super(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      isRetryable: true,
      fallbackEligible: true,
      ...options,
    })
  }
}

export class ContextOverflowError extends MoaError {
  constructor(message, options = {}) {
    super(message, {
      code: 'CONTEXT_WINDOW_EXCEEDED',
      status: 400,
      isRetryable: false,
      fallbackEligible: true,
      ...options,
    })
  }
}

export class AuthenticationError extends MoaError {
  constructor(message, options = {}) {
    super(message, {
      code: 'AUTHENTICATION_FAILED',
      status: options.status || 401,
      isRetryable: false,
      fallbackEligible: false,
      ...options,
    })
  }
}

export class ModelNotFoundError extends MoaError {
  constructor(message, options = {}) {
    super(message, {
      code: 'MODEL_NOT_FOUND',
      status: 404,
      isRetryable: false,
      fallbackEligible: true,
      ...options,
    })
  }
}

export class TransientNetworkError extends MoaError {
  constructor(message, options = {}) {
    super(message, {
      code: 'TRANSIENT_NETWORK_ERROR',
      status: options.status || 503,
      isRetryable: true,
      fallbackEligible: true,
      ...options,
    })
  }
}

/**
 * Classifies an unknown error or exception into a structured MoA domain error.
 *
 * @param {unknown} err
 * @returns {MoaError}
 */
export function classifyLlmError(err) {
  if (!err) return new MoaError('Unknown error')
  if (err instanceof MoaError) return err

  const msg = String(err.message || err).toLowerCase()
  const status = Number(err.status || err.statusCode || (msg.match(/\b(401|403|404|429|500|502|503|504)\b/)?.[1])) || undefined
  const code = String(err.code || '').toUpperCase()

  // Rate limit / Quota
  if (
    status === 429 ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('tpm') ||
    msg.includes('rpm') ||
    msg.includes('quota exceeded') ||
    code.includes('RATE_LIMIT') ||
    code.includes('QUOTA')
  ) {
    return new RateLimitError(err.message || String(err), { status: 429, cause: err })
  }

  // Context window overflow
  if (
    msg.includes('context window') ||
    msg.includes('context length') ||
    msg.includes('maximum context') ||
    msg.includes('too long') ||
    msg.includes('token limit') ||
    code.includes('CONTEXT_WINDOW')
  ) {
    return new ContextOverflowError(err.message || String(err), { status: 400, cause: err })
  }

  // Authentication & permissions
  if (
    status === 401 ||
    status === 403 ||
    msg.includes('unauthorized') ||
    msg.includes('invalid api key') ||
    msg.includes('forbidden') ||
    msg.includes('authentication') ||
    code.includes('AUTH') ||
    code.includes('INVALID_CREDENTIAL')
  ) {
    return new AuthenticationError(err.message || String(err), { status: status || 401, cause: err })
  }

  // Model not found / unavailable
  if (
    status === 404 ||
    msg.includes('model not found') ||
    msg.includes('does not exist') ||
    msg.includes('unknown model') ||
    code.includes('MODEL_NOT_FOUND')
  ) {
    return new ModelNotFoundError(err.message || String(err), { status: 404, cause: err })
  }

  // Transient network / gateway / timeout
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('socket hang up') ||
    msg.includes('service unavailable') ||
    msg.includes('bad gateway') ||
    code.includes('TIMEOUT') ||
    code.includes('ECONNRESET')
  ) {
    return new TransientNetworkError(err.message || String(err), { status: status || 503, cause: err })
  }

  return new MoaError(err.message || String(err), { status, cause: err })
}

/**
 * Returns true if the error qualifies for candidate failover to a reserve model.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isFailoverEligible(err) {
  const classified = classifyLlmError(err)
  return classified.fallbackEligible
}
