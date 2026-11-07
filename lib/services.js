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
  } catch (_err) {
    /* strict context refuses get() for a service the fiber does not inject */
  }
  try {
    if (ctx && Object.prototype.hasOwnProperty.call(ctx, name)) {
      return ctx[name]
    }
  } catch (_err) {
    /* direct property inspection trapped by context proxy */
  }
  try {
    return ctx ? ctx[name] : undefined
  } catch (_err) {
    /* fallback trapped by context proxy */
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
  } catch (_err) {
    /* get('webServer') refused by un-injected context fiber */
  }
  try {
    if (Object.prototype.hasOwnProperty.call(ctx, 'webServer') && ctx.webServer && typeof ctx.webServer.register === 'function') {
      return ctx.webServer
    }
  } catch (_err) {
    /* direct hasOwnProperty trapped by context proxy */
  }
  try {
    const ws = ctx.webServer
    if (ws && typeof ws.register === 'function') return ws
  } catch (_err) {
    /* direct property read trapped by context proxy */
  }
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
