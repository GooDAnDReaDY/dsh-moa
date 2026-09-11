import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createLiveCanvasClient } from '../lib/live-canvas.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

function startPreviewServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let acc = ''
      req.on('data', (d) => {
        acc += d
      })
      req.on('end', () => handler(req, res, acc))
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('live-canvas client: creates a preview via real loopback HTTP', async () => {
  let seenBody = null
  const server = await startPreviewServer((req, res, body) => {
    seenBody = JSON.parse(body)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true, canvasId: 'canvas-abc123', previewUrl: '/dsh-live-canvas/sandbox/canvas-abc123' }))
  })
  try {
    const client = createLiveCanvasClient({ getPort: () => server.address().port })
    const out = await client.createPreviewFromContent({ content: '<h1>hi</h1>', title: 'index.html', filePath: '/tmp/x/index.html' })
    assert.deepEqual(out, {
      canvasId: 'canvas-abc123',
      previewUrl: '/dsh-live-canvas/sandbox/canvas-abc123',
      title: 'index.html',
    })
    assert.equal(seenBody.content, '<h1>hi</h1>')
    assert.equal(seenBody.title, 'index.html')
  } finally {
    server.close()
  }
})

test('live-canvas client: degrades to null on 404 (plugin absent) and on malformed response', async () => {
  const absent = await startPreviewServer((req, res) => {
    res.writeHead(404)
    res.end('{"error":"not found"}')
  })
  try {
    const client = createLiveCanvasClient({ getPort: () => absent.address().port })
    assert.equal(await client.createPreviewFromContent({ content: '<h1>x</h1>' }), null)
  } finally {
    absent.close()
  }

  const malformed = await startPreviewServer((req, res) => {
    res.writeHead(200)
    res.end('{"weird":true}')
  })
  try {
    const client = createLiveCanvasClient({ getPort: () => malformed.address().port })
    assert.equal(await client.createPreviewFromContent({ content: '<h1>x</h1>' }), null)
  } finally {
    malformed.close()
  }
})

test('live-canvas client: connection failure and missing port degrade to null', async () => {
  const dead = createLiveCanvasClient({ getPort: () => 1 })
  assert.equal(await dead.createPreviewFromContent({ content: '<h1>x</h1>', title: 't' }), null)

  const noPort = createLiveCanvasClient({ getPort: () => 0 })
  assert.equal(await noPort.createPreviewFromContent({ content: '<h1>x</h1>' }), null)

  const noContent = createLiveCanvasClient({ getPort: () => 5 })
  assert.equal(await noContent.createPreviewFromContent({}), null)
})

test('runMoAPipeline: attaches liveCanvas preview for promoted html in fast mode', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-lc-fast-'))
  try {
    const calls = []
    const stubClient = {
      createPreviewFromContent: async (args) => {
        calls.push(args)
        return { canvasId: 'c1', previewUrl: '/dsh-live-canvas/sandbox/c1', title: 'index.html' }
      },
    }
    const res = await runMoAPipeline({
      userPrompt: 'quick snake',
      preset: { name: 'fast', reference_models: [{ provider: 'p', model: 'm' }] },
      callLlm: async () => 'game ```html file="index.html"\n<h1>Snake</h1>\n```',
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
      liveCanvas: stubClient,
    })
    assert.equal(res.isFastMode, true)
    assert.equal(res.liveCanvas.previewUrl, '/dsh-live-canvas/sandbox/c1')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].filePath, path.join(tmpDir, 'index.html'))
    assert.ok(calls[0].content.includes('<h1>Snake</h1>'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('runMoAPipeline: attaches liveCanvas preview in judge mode and degrades without a client', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-lc-judge-'))
  try {
    const preset = {
      name: 'default',
      reference_models: [
        { provider: 'p1', model: 'm1' },
        { provider: 'p2', model: 'm2' },
      ],
      aggregator: { provider: 'agg', model: 'judge' },
    }
    const mockCallLlm = async (params) => {
      if (params.model === 'judge') return 'WINNER_CANDIDATE_INDEX: 2 verdict'
      return 'proposal ```html file="index.html"\n<h1>Calc</h1>\n```'
    }
    const stubClient = {
      createPreviewFromContent: async () => ({ canvasId: 'c2', previewUrl: '/dsh-live-canvas/sandbox/c2', title: 'index.html' }),
    }

    const res = await runMoAPipeline({
      userPrompt: 'the calculator must support keyboard input, a history panel, dark theme and scientific operations',
      preset,
      callLlm: mockCallLlm,
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
      liveCanvas: stubClient,
    })
    assert.equal(res.liveCanvas.previewUrl, '/dsh-live-canvas/sandbox/c2')

    const resNoClient = await runMoAPipeline({
      userPrompt: 'the calculator must support keyboard input, a history panel, dark theme and scientific operations',
      preset,
      callLlm: mockCallLlm,
      cwd: tmpDir,
      historyFilePath: path.join(tmpDir, 'history.jsonl'),
    })
    assert.equal(resNoClient.liveCanvas, undefined, 'no live-canvas client -> no preview link, no crash')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
