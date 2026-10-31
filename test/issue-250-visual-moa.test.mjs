import test from 'node:test'
import assert from 'node:assert/strict'
import { isVisualUiTask, extractRenderableMarkup, runVisualMoaConsensus } from '../lib/moa-visual-consensus.js'
import { PresetSchema } from '../lib/moa-schema.js'
import { COMPANION_PLUGINS } from '../lib/moa-workbench.js'

test('issue #250: PresetSchema accepts visual_moa_enabled and COMPANION_PLUGINS includes vision-bridge and live-canvas', () => {
  const parsed = PresetSchema({ name: 'vis-p', visual_moa_enabled: true })
  assert.equal(parsed.visual_moa_enabled, true)

  const ids = COMPANION_PLUGINS.map((p) => p.id)
  assert.ok(ids.includes('dsh-vision-bridge'))
  assert.ok(ids.includes('dsh-live-canvas'))
})

test('issue #250: runVisualMoaConsensus gracefully degrades when companion plugins are absent', async () => {
  const res = await runVisualMoaConsensus({
    userPrompt: 'Build a landing page',
    referenceOutputs: [
      { index: 1, label: 'p1:m1', ok: true, files: [{ relativePath: 'index.html', content: '<h1>Hello</h1>' }] },
    ],
  })
  assert.equal(res.degraded, true)
  assert.equal(res.visualScores.length, 0)
  assert.equal(res.directive, '')
})

test('issue #250: runVisualMoaConsensus renders in Live Canvas and scores layout via Vision Bridge', async () => {
  const mockLiveCanvas = {
    async createPreviewFromContent({ title }) {
      return {
        previewUrl: `http://127.0.0.1:3000/preview/${encodeURIComponent(title)}`,
        screenshot: 'base64-png-data',
      }
    },
  }

  const mockVisionBridge = {
    async evaluateVisualLayout({ candidateIndex }) {
      return {
        score: candidateIndex === 1 ? 9.4 : 6.2,
        critique: candidateIndex === 1 ? 'Pixel-perfect responsive grid' : 'Overlapping header elements',
      }
    },
  }

  const res = await runVisualMoaConsensus({
    liveCanvas: mockLiveCanvas,
    visionBridge: mockVisionBridge,
    userPrompt: 'Build responsive dashboard HTML',
    referenceOutputs: [
      { index: 1, label: 'p1:m1', ok: true, files: [{ relativePath: 'index.html', content: '<div>Grid 1</div>' }] },
      { index: 2, label: 'p2:m2', ok: true, files: [{ relativePath: 'index.html', content: '<div>Grid 2</div>' }] },
    ],
  })

  assert.equal(res.degraded, false)
  assert.equal(res.visualScores.length, 2)
  assert.equal(res.visualScores[0].visualScore, 9.4)
  assert.equal(res.visualScores[1].visualScore, 6.2)
  assert.ok(res.directive.includes('Multimodal Visual MoA Consensus'))
  assert.ok(res.directive.includes('9.4/10'))
})
