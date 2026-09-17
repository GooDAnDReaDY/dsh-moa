import test from 'node:test'
import assert from 'node:assert/strict'
import { isSafeWriteRequest, isTrustedUpdateRequest, isLoopback, isNewerVersion } from '../lib/updater.js'

test('updater: isLoopback recognizes local addresses', () => {
  assert.equal(isLoopback('127.0.0.1'), true)
  assert.equal(isLoopback('localhost'), true)
  assert.equal(isLoopback('::1'), true)
  assert.equal(isLoopback('192.168.1.111'), false)
  assert.equal(isLoopback('example.com'), false)
})

test('updater: isNewerVersion correctly compares semver', () => {
  assert.equal(isNewerVersion('0.2.15', '0.2.16'), true)
  assert.equal(isNewerVersion('0.2.15', '0.2.15'), false)
  assert.equal(isNewerVersion('0.2.16', '0.2.15'), false)
  assert.equal(isNewerVersion('0.2.15', '0.3.0'), true)
  assert.equal(isNewerVersion('0.2.15', '1.0.0'), true)
})

test('updater: isTrustedUpdateRequest validates local update invocation', () => {
  const validReq = {
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1:3000',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(validReq), true)

  const untrustedReq = {
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'cross-site',
      origin: 'http://evil.com',
      host: '127.0.0.1:3000',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(untrustedReq), false)

  const missingHeaderReq = {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(missingHeaderReq), false)
})

test('updater: isSafeWriteRequest blocks cross-site write requests', () => {
  assert.equal(isSafeWriteRequest({
    headers: { 'sec-fetch-site': 'cross-site' },
  }), false)

  assert.equal(isSafeWriteRequest({
    headers: {
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1:3000',
    },
  }), true)

  assert.equal(isSafeWriteRequest({
    headers: {
      'sec-fetch-site': 'same-origin',
      origin: 'http://evil.com',
      host: '127.0.0.1:3000',
    },
  }), false)

  // Standard same-origin or tool invocation without origin headers
  assert.equal(isSafeWriteRequest({
    headers: {},
  }), true)
})
