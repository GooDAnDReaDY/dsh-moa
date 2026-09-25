/**
 * Context logger abstraction for dsh-moa.
 * Avoids raw direct console warnings in server-side modules and respects Cordis ctx.logger.
 */
let currentLogger = null

export function setLogger(logger) {
  currentLogger = logger
}

export const logger = {
  warn(...args) {
    if (currentLogger && typeof currentLogger.warn === 'function') {
      currentLogger.warn(...args)
    } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug(...args)
    }
  },
  debug(...args) {
    if (currentLogger && typeof currentLogger.debug === 'function') {
      currentLogger.debug(...args)
    } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug(...args)
    }
  },
  info(...args) {
    if (currentLogger && typeof currentLogger.info === 'function') {
      currentLogger.info(...args)
    } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug(...args)
    }
  },
  error(...args) {
    if (currentLogger && typeof currentLogger.error === 'function') {
      currentLogger.error(...args)
    } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug(...args)
    }
  },
}
