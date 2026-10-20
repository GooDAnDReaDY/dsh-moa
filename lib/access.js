/**
 * DeepSeek Harness Mixture of Agents (MoA) — Access Control & Route Guard (#257)
 */

import { assertPathContained } from './file-workspace.js'

export function writeJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let acc = ''
    req.on('data', (chunk) => {
      acc += chunk
      if (acc.length > 5 * 1024 * 1024) { req.destroy(); reject(new Error('Payload Too Large')) }
    })
    req.on('end', () => resolve(acc))
    req.on('error', reject)
  })
}

export function isAllowedWorkspace(targetCwd, allowedRoots) {
  if (!targetCwd || typeof targetCwd !== 'string') return false
  for (const root of allowedRoots) {
    if (!root) continue
    try {
      assertPathContained(root, targetCwd)
      return true
    } catch {
      // not within root
    }
  }
  return false
}

export function getConnection(ctx) {
  try {
    const fromCtx = ctx?.reflect?.get
      ? (ctx.reflect.get('connection') || ctx?.connection)
      : (ctx?.get ? (ctx.get('connection') || ctx?.connection) : Reflect.get(ctx || {}, 'connection'))
    if (fromCtx) return fromCtx
    if (ctx?.root) return getConnection(ctx.root)
    return undefined
  } catch {
    return undefined
  }
}

export function isLoopbackIp(ip) {
  if (!ip || typeof ip !== 'string') return false
  const clean = ip.trim().toLowerCase().replace(/^::ffff:/, '')
  return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost'
}

/**
 * Validates whether an incoming HTTP request is authenticated and admitted (#257).
 *
 * Requirements:
 * 1. CSRF protection: rejects sec-fetch-site: cross-site with 403.
 * 2. Authoritative DSH connection gate: if connection.requestRejection is present,
 *    its verdict (401, 403, or undefined) is authoritative.
 * 3. Network boundary: non-loopback callers without connection service authentication
 *    fail closed with 401. Loopback callers are admitted.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {any} [ctx]
 * @returns {number|undefined} Rejection status (401, 403) or undefined if admitted.
 */
export function getReadRejectionStatus(req, ctx = null) {
  if (!req || !req.headers) return 403

  // 1. Strict CSRF protection: reject cross-site requests
  const site = req.headers['sec-fetch-site']
  if (site === 'cross-site') {
    return 403
  }

  // 2. Authoritative DSH connection service check (#257)
  const conn = getConnection(ctx) || req?.connectionService || ctx?.connection
  if (conn && typeof conn.requestRejection === 'function') {
    let rejection
    try {
      rejection = conn.requestRejection(req)
    } catch {
      rejection = 403
    }
    if (rejection !== undefined) {
      if (typeof rejection === 'number' && Number.isInteger(rejection) && rejection >= 400 && rejection < 600) {
        return rejection
      }
      return rejection === 401 ? 401 : 403
    }
    return undefined
  }

  // 3. Network boundary evaluation when connection service is absent
  const rawRemote = req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''
  const cleanRemote = String(rawRemote).trim().toLowerCase().replace(/^::ffff:/, '')

  if (cleanRemote && !isLoopbackIp(cleanRemote)) {
    return 401
  }

  const xff = req.headers['x-forwarded-for']
  if (xff && typeof xff === 'string') {
    const clientIp = xff.split(',')[0].trim()
    if (clientIp && !isLoopbackIp(clientIp)) {
      return 401
    }
  }

  const host = String(req.headers.host || '').trim().toLowerCase()
  if (!cleanRemote && host) {
    const hostName = host.split(':')[0]
    if (!isLoopbackIp(hostName)) {
      return 401
    }
  }

  return undefined
}

export function assertAuthorizedRequest(req, res, ctx = null) {
  const status = getReadRejectionStatus(req, ctx)
  if (status !== undefined) {
    writeJson(res, status, {
      ok: false,
      error: status === 401 ? 'Authentication required' : 'Forbidden',
    })
    return false
  }
  return true
}
