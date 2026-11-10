import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getReadRejectionStatus, assertAuthorizedRequest, hostNameOf, isTrustedLocalHost } from '../lib/access.js'
import { isSafeWriteRequest, isTrustedUpdateRequest } from '../lib/updater.js'

describe('Issue #351: Host Header & DNS Rebinding Protection', () => {
  it('hostNameOf correctly parses hostname from Host header variants', () => {
    assert.equal(hostNameOf('localhost:3000'), 'localhost')
    assert.equal(hostNameOf('127.0.0.1:3080'), '127.0.0.1')
    assert.equal(hostNameOf('[::1]:3000'), '[::1]')
    assert.equal(hostNameOf('evil.example.com:80'), 'evil.example.com')
    assert.equal(hostNameOf('evil.example.com'), 'evil.example.com')
    assert.equal(hostNameOf(['127.0.0.1:8080']), '127.0.0.1')
    assert.equal(hostNameOf(''), '')
  })

  it('isTrustedLocalHost identifies loopback and configured trusted hosts', () => {
    assert.equal(isTrustedLocalHost('127.0.0.1:3000'), true)
    assert.equal(isTrustedLocalHost('localhost:8080'), true)
    assert.equal(isTrustedLocalHost('[::1]:3000'), true)
    assert.equal(isTrustedLocalHost('evil.example:3080'), false)

    const ctx = { options: { trustedHost: 'hub.company.internal' } }
    assert.equal(isTrustedLocalHost('hub.company.internal:443', ctx), true)
    assert.equal(isTrustedLocalHost('other.example.com', ctx), false)
  })

  it('getReadRejectionStatus: rejects DNS rebinding request from loopback socket with foreign Host (403)', () => {
    // Normal loopback request
    const legitimateReq = {
      headers: { host: '127.0.0.1:3000' },
      socket: { remoteAddress: '127.0.0.1' },
    }
    assert.equal(getReadRejectionStatus(legitimateReq), undefined)

    // Attacker using DNS rebinding: socket is 127.0.0.1, but Host/Origin is evil.example:3080
    const rebindingReq = {
      headers: {
        host: 'evil.example:3080',
        origin: 'http://evil.example:3080',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }
    assert.equal(getReadRejectionStatus(rebindingReq), 403)

    // assertAuthorizedRequest returns false and writes 403
    let statusCode = 0
    let payload = null
    const mockRes = {
      writeHead: (code) => { statusCode = code },
      end: (data) => { payload = JSON.parse(data) },
    }
    const admitted = assertAuthorizedRequest(rebindingReq, mockRes)
    assert.equal(admitted, false)
    assert.equal(statusCode, 403)
    assert.equal(payload.error, 'Forbidden')
  })

  it('isSafeWriteRequest: rejects DNS rebinding on write endpoints', () => {
    // Legitimate write request
    const legitWriteReq = {
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
        'sec-fetch-site': 'same-origin',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }
    assert.equal(isSafeWriteRequest(legitWriteReq), true)

    // Attacker DNS rebinding write request
    const attackWriteReq = {
      headers: {
        host: 'evil.example:3080',
        origin: 'http://evil.example:3080',
        'sec-fetch-site': 'same-site',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }
    assert.equal(isSafeWriteRequest(attackWriteReq), false)
  })

  it('isTrustedUpdateRequest: rejects foreign Host header on update endpoint', () => {
    const attackUpdateReq = {
      headers: {
        'x-dsh-plugin-update': '1',
        host: 'evil.example:3080',
        origin: 'http://127.0.0.1:3080',
        'sec-fetch-site': 'same-origin',
      },
      socket: { remoteAddress: '127.0.0.1' },
    }
    assert.equal(isTrustedUpdateRequest(attackUpdateReq), false)
  })
})
