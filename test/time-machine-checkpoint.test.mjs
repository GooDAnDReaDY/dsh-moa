import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import {
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  createPrePromotionCheckpoint,
} from '../lib/file-workspace.js'

test('createPrePromotionCheckpoint: gracefully handles unreachable endpoint (best-effort)', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-tm-fallback-'))
  try {
    const snap = await createPrePromotionCheckpoint(tmpDir, 1, {
      port: 59999, // Unused port
      timeoutMs: 100,
    })
    assert.equal(snap, null, 'Returns null on connection failure without throwing')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('createPrePromotionCheckpoint: does NOT fall back to port 3000 when webServerPort is unknown', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-tm-no-port-'))
  try {
    // Should log warning and return null immediately without making network calls
    const snap = await createPrePromotionCheckpoint(tmpDir, 1, {})
    assert.equal(snap, null)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('createPrePromotionCheckpoint: respects options.checkpoint = false', async () => {
  let called = false
  const snap = await createPrePromotionCheckpoint('/fake/dir', 1, {
    checkpoint: false,
    checkpointFn: async () => { called = true },
  })
  assert.equal(snap, null)
  assert.equal(called, false)
})

test('createPrePromotionCheckpoint: invokes custom checkpointFn if provided', async () => {
  let capturedArgs = null
  const customFn = async (dir, idx) => {
    capturedArgs = { dir, idx }
    return { id: 'snap-123', label: 'custom' }
  }

  const snap = await createPrePromotionCheckpoint('/my/project', 2, {
    checkpointFn: customFn,
  })
  assert.deepEqual(capturedArgs, { dir: '/my/project', idx: 2 })
  assert.deepEqual(snap, { id: 'snap-123', label: 'custom' })
})

test('createPrePromotionCheckpoint: uses direct timeMachineEngine when available', async () => {
  let captured = null
  const mockEngine = {
    createSnapshot: async (label, opts) => {
      captured = { label, opts }
      return { id: 'direct-snap-1', label, cwd: opts.cwd }
    },
  }

  const snap = await createPrePromotionCheckpoint('/engine/project', 'winner', {
    timeMachineEngine: mockEngine,
  })
  assert.ok(snap)
  assert.equal(snap.id, 'direct-snap-1')
  assert.equal(captured.opts.cwd, '/engine/project')
  assert.equal(captured.label, 'moa-pre-promotion: candidate-winner')
})

test('promoteCandidateWorkspace: successfully promotes files and attaches checkpoint metadata', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-tm-promote-'))
  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'app.js', content: 'console.log("promoted")' },
    ])

    const mockSnap = { id: 'snap-456', label: 'moa-pre-promotion: candidate-1' }
    const promoted = await promoteCandidateWorkspace(tmpDir, 1, {
      checkpointFn: async () => mockSnap,
      keepMoa: true,
    })

    assert.ok(Array.isArray(promoted))
    assert.equal(promoted.length, 1)
    assert.equal(promoted[0], 'app.js')
    assert.deepEqual(promoted.checkpoint, mockSnap)

    const destContent = await fs.readFile(path.join(tmpDir, 'app.js'), 'utf8')
    assert.equal(destContent, 'console.log("promoted")')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('promoteCandidateWorkspace: blocks uncheckpointed file overwrite unless force: true', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-tm-block-'))
  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'important.js', content: 'new candidate code' },
    ])
    await fs.writeFile(path.join(tmpDir, 'important.js'), 'original project code', 'utf8')

    // 1. Without checkpoint and without force -> MUST throw and NOT overwrite
    await assert.rejects(
      async () => {
        await promoteCandidateWorkspace(tmpDir, 1, {
          port: 59998, // unreachable
          timeoutMs: 100,
          force: false,
          keepMoa: true,
        })
      },
      /Pre-promotion checkpoint failed.*force: true/
    )

    // Original file must remain untouched
    const origContent = await fs.readFile(path.join(tmpDir, 'important.js'), 'utf8')
    assert.equal(origContent, 'original project code')

    // 2. With force: true -> proceeds with promotion despite missing checkpoint
    const promoted = await promoteCandidateWorkspace(tmpDir, 1, {
      port: 59998,
      timeoutMs: 100,
      force: true,
      keepMoa: true,
    })
    assert.equal(promoted.length, 1)
    const updatedContent = await fs.readFile(path.join(tmpDir, 'important.js'), 'utf8')
    assert.equal(updatedContent, 'new candidate code')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('createPrePromotionCheckpoint: creates checkpoint via mock HTTP time-machine endpoint without x-dsh-trusted', async () => {
  let receivedBody = null
  let headersReceived = null
  const server = http.createServer((req, res) => {
    if (req.url === '/dsh-time-machine/create' && req.method === 'POST') {
      headersReceived = req.headers
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', () => {
        receivedBody = JSON.parse(body)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, snapshot: { id: 'snap-789', label: receivedBody.label } }))
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  try {
    const snap = await createPrePromotionCheckpoint('/test/dir', 'curator-synthesis', {
      port,
      timeoutMs: 1000,
    })

    assert.ok(snap)
    assert.equal(snap.id, 'snap-789')
    assert.equal(receivedBody.cwd, '/test/dir')
    assert.equal(receivedBody.label, 'moa-pre-promotion: candidate-curator-synthesis')

    // Verify x-dsh-trusted is NOT present
    assert.equal(headersReceived['x-dsh-trusted'], undefined, 'x-dsh-trusted header must be removed')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
