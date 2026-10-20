/**
 * DeepSeek Harness Mixture of Agents (MoA) — Access Control & Route Guard (#257)
 */

import crypto from 'node:crypto'
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
  const clean = ip.trim().toLowerCase().replace(/^::ffff:/, '').replace(/^\[|\]$/g, '')
  return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost'
}

export function cookieNameForAuthority(authority) {
  if (!authority || typeof authority !== 'string') return ''
  const hash = crypto.createHash('sha256').update(authority.trim()).digest('base64url')
  return 'dsh-auth-' + hash
}

export function isLoopbackCookieName(name, host = '') {
  if (!name || typeof name !== 'string' || !name.startsWith('dsh-auth-')) return false
  const authorities = [
    host,
    '127.0.0.1:3000',
    '127.0.0.1:3080',
    '127.0.0.1:3082',
    '127.0.0.1',
    'localhost:3000',
    'localhost:3080',
    'localhost:3082',
    'localhost',
    '[::1]:3000',
    '[::1]',
  ]
  for (const auth of authorities) {
    if (auth && isLoopbackIp(auth.split(':')[0])) {
      if (cookieNameForAuthority(auth) === name) return true
    }
  }
  return false
}

export function hasClientCredentials(req) {
  if (!req || !req.headers) return false
  const cookie = req.headers.cookie
  if (!cookie || typeof cookie !== 'string') return false
  if (
    cookie.includes('dsh_token=') ||
    cookie.includes('dsh_lan_pin=') ||
    cookie.includes('dsh_auth_session=')
  ) {
    return true
  }

  const parts = cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const name = trimmed.slice(0, eqIdx).trim()
    if (name.startsWith('dsh-auth-')) {
      if (!isLoopbackCookieName(name, req.headers.host)) {
        return true
      }
    }
  }
  return false
}

/**
 * Validates whether an incoming HTTP request is authenticated and admitted (#257).
 *
 * Requirements:
 * 1. CSRF protection: rejects sec-fetch-site: cross-site with 403.
 * 2. Reverse proxy inspection: if request is forwarded with non-loopback x-forwarded-for,
 *    verify that the client itself supplied authentic credentials (not just injected loopback proxy cookie).
 * 3. Authoritative DSH connection gate: if connection.requestRejection is present,
 *    its verdict (401, 403, or undefined) is authoritative.
 * 4. Network boundary: non-loopback callers without connection service authentication
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

  // 2. Reverse-proxy / forwarded client verification (#257)
  const xff = req.headers['x-forwarded-for']
  let isForwardedRemote = false
  if (xff && typeof xff === 'string') {
    const firstIp = xff.split(',')[0].trim()
    if (firstIp && !isLoopbackIp(firstIp)) {
      isForwardedRemote = true
      if (!hasClientCredentials(req)) {
        return 401
      }
    }
  }

  // 3. Authoritative DSH connection service check (#257)
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

  // 4. Network boundary evaluation when connection service is absent
  const rawRemote = req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''
  const cleanRemote = String(rawRemote).trim().toLowerCase().replace(/^::ffff:/, '')

  if (cleanRemote && !isLoopbackIp(cleanRemote)) {
    return 401
  }

  if (isForwardedRemote) {
    return 401
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