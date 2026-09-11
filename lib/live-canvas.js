/**
 * Optional Live Canvas preview client (@goodandready/dsh-live-canvas).
 *
 * The plugin posts the promoted HTML to live-canvas's own REST contract
 * (POST /dsh-live-canvas/api/preview, served by the same harness webServer),
 * so no cross-plugin service coupling or module imports are needed. Any
 * failure — live-canvas not installed, endpoint missing, timeout, malformed
 * response — degrades to null and the MoA answer simply carries no preview
 * link, without errors in the harness log.
 */
export function createLiveCanvasClient({ getPort, fetchImpl = globalThis.fetch, timeoutMs = 3000 } = {}) {
  if (typeof fetchImpl !== 'function') return null
  return {
    async createPreviewFromContent({ content, title, filePath } = {}) {
      if (!content || typeof content !== 'string') return null
      const port = typeof getPort === 'function' ? getPort() : getPort
      if (!port) return null
      try {
        const res = await fetchImpl(`http://127.0.0.1:${port}/dsh-live-canvas/api/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, title, filePath }),
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!res.ok) return null
        const data = await res.json()
        if (!data || data.success !== true || !data.canvasId || !data.previewUrl) return null
        return { canvasId: data.canvasId, previewUrl: data.previewUrl, title: title || 'Live Preview' }
      } catch {
        return null
      }
    },
  }
}
