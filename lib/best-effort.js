/**
 * Run a non-critical side effect; never throw.
 * Logs at debug/warn when a logger is provided or via console.debug.
 *
 * @param {string} label - Context identifier for telemetry / diagnostics
 * @param {Function} fn - Operation to execute
 * @param {object} [logger] - Optional logger instance
 */
export function bestEffort(label, fn, logger) {
  const log = (err) => {
    try {
      if (logger && typeof logger.debug === 'function') {
        logger.debug(`[dsh-moa:bestEffort] ${label}:`, err?.message || err)
      } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
        console.debug(`[dsh-moa:bestEffort] ${label}:`, err?.message || err)
      }
    } catch {
      // Logger itself must never crash the process
    }
  }

  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      return result.then(
        (value) => value,
        (err) => {
          log(err)
          return undefined
        }
      )
    }
    return result
  } catch (err) {
    log(err)
    return undefined
  }
}
