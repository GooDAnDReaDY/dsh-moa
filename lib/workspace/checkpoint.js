import { logger } from '../logger.js'
import { bestEffort } from '../best-effort.js'
import { isLoopbackUrl } from './security.js'

export async function createPrePromotionCheckpoint(baseDir, candidateTarget, options = {}) {
  if (!baseDir || options.checkpoint === false) return null
  if (typeof options.checkpointFn === 'function') {
    return (await bestEffort('custom checkpointFn', () => options.checkpointFn(baseDir, candidateTarget))) || null
  }

  const label = options.checkpointLabel || `moa-pre-promotion: candidate-${candidateTarget}`
  if (options.timeMachineEngine && typeof options.timeMachineEngine.createSnapshot === 'function') {
    const snap = await bestEffort('dsh-time-machine direct service createSnapshot', async () => {
      return await options.timeMachineEngine.createSnapshot(label, { cwd: baseDir })
    })
    if (snap) return snap
  }

  const port = options.port || options.webServerPort || process.env.DSH_PORT || process.env.PORT
  if (!port && !options.timeMachineUrl) {
    logger.warn('[dsh-moa] Cannot create pre-promotion checkpoint: webServerPort is unknown and no timeMachineUrl provided')
    return null
  }

  if (options.timeMachineUrl && !isLoopbackUrl(options.timeMachineUrl)) {
    logger.warn(`[dsh-moa] Blocked non-loopback timeMachineUrl: ${options.timeMachineUrl}`)
    return null
  }

  const endpoint = options.timeMachineUrl || `http://127.0.0.1:${port}/dsh-time-machine/create`
  const snap = await bestEffort('dsh-time-machine pre-promotion checkpoint', async () => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, cwd: baseDir }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 1500),
      redirect: 'error',
    })
    if (res.ok) {
      const data = await res.json()
      return data?.snapshot || data || null
    }
    return null
  })
  return snap || null
}

/**
 * Promotes winning candidate workspace files into the base workspace.
 * Serialized per baseDir and verifies symlink boundaries on promotion.
 */
