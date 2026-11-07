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
    if (ctx && Object.prototype.hasOwnProperty.call(ctx, name)) {
      return ctx[name]
    }
  } catch {}
  try {
    return ctx ? ctx[name] : undefined
  } catch {
    return undefined
  }
}

/**
 * Safely resolve webServer from a Cordis context or test mock without
 * triggering Cordis's Proxy trap (`cannot get property "webServer" without inject`)
 * when `webServer` is provided by a sibling plugin and not in static `inject`.
 * @param {object | undefined} ctx
 * @returns {object | undefined}
 */
export function getWebServer(ctx) {
  if (!ctx) return undefined
  try {
    if (typeof ctx.get === 'function') {
      const viaGet = ctx.get('webServer')
      if (viaGet && typeof viaGet.register === 'function') return viaGet
    }
  } catch {}
  try {
    if (Object.prototype.hasOwnProperty.call(ctx, 'webServer') && ctx.webServer && typeof ctx.webServer.register === 'function') {
      return ctx.webServer
    }
  } catch {}
  try {
    const ws = ctx.webServer
    if (ws && typeof ws.register === 'function') return ws
  } catch {}
  return undefined
}

/**
 * Safely resolves the web server port if webServer service is mounted.
 * @param {object | undefined} ctx
 * @returns {number | null}
 */
export function getWebServerPort(ctx) {
  const ws = getWebServer(ctx) || service(ctx, 'webServer')
  return (ws && typeof ws.port === 'number') ? ws.port : null
}
