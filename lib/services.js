/**
 * Optional-service helpers for Cordis runtime.
 * Avoids tripping strict-proxy guards and survives headless profiles.
 */

/**
 * Safely read an optional service from ctx without throwing strict-proxy guard errors.
 * @param {object | undefined} ctx
 * @param {string} name
 * @returns {unknown}
 */
export function service(ctx, name) {
  try {
    const viaGet = typeof ctx?.get === 'function' ? ctx.get(name) : undefined
    if (viaGet) return viaGet
  } catch {
    /* strict context refuses get() for a service the fiber does not inject */
  }
  try {
    const viaReflect = ctx?.reflect?.get?.(name, false)
    if (viaReflect) return viaReflect
  } catch {
    /* ignore reflection errors */
  }
  try {
    return ctx ? ctx[name] : undefined
  } catch {
    return undefined
  }
}

/**
 * Safely resolves the web server port if webServer service is mounted.
 * @param {object | undefined} ctx
 * @returns {number | null}
 */
export function getWebServerPort(ctx) {
  const ws = service(ctx, 'webServer')
  return (ws && typeof ws.port === 'number') ? ws.port : null
}
