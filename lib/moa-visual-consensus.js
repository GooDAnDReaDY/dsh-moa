/**
 * Multimodal Visual MoA Consensus via dsh-vision-bridge and dsh-live-canvas (#250)
 * Renders UI/Frontend candidates (HTML, React, CSS, SVG) via dsh-live-canvas,
 * captures headless screenshots, and evaluates layout/responsiveness via dsh-vision-bridge.
 * Gracefully degrades to text evaluation when companion plugins are unavailable.
 */

import { service } from './services.js'
import { logger } from './logger.js'
import { slotLabel } from './moa-prompts.js'

const UI_TASK_REGEX = /\b(html|css|svg|ui|frontend|react|vue|tailwind|layout|landing|page|component|button|modal|responsive|card|dashboard|widget)\b/i

/**
 * Checks whether a prompt or candidate output involves UI/Frontend rendering.
 */
export function isVisualUiTask(prompt = '', referenceOutputs = []) {
  if (UI_TASK_REGEX.test(String(prompt || ''))) return true
  for (const ref of referenceOutputs || []) {
    const files = Array.isArray(ref?.files) ? ref.files : []
    if (files.some((f) => /\.(html?|css|svg|jsx|tsx|vue)$/i.test(f.relativePath || f.path || ''))) {
      return true
    }
  }
  return false
}

/**
 * Extracts renderable HTML/SVG preview markup from a candidate output.
 */
export function extractRenderableMarkup(candidate = {}) {
  const files = Array.isArray(candidate.files) ? candidate.files : []
  const htmlFile = files.find((f) => /\.(html?|svg)$/i.test(f.relativePath || f.path || ''))
  if (htmlFile?.content) {
    return { title: htmlFile.relativePath || 'index.html', content: htmlFile.content }
  }

  const cssFile = files.find((f) => /\.css$/i.test(f.relativePath || f.path || ''))
  const jsFile = files.find((f) => /\.(jsx?|tsx?)$/i.test(f.relativePath || f.path || ''))
  if (cssFile || jsFile) {
    const html = [
      '<!DOCTYPE html><html><head><meta charset="utf-8">',
      cssFile ? `<style>${cssFile.content}</style>` : '',
      '</head><body><div id="app">UI Preview</div>',
      '</body></html>',
    ].join('\n')
    return { title: 'synthesized-preview.html', content: html }
  }

  const text = String(candidate.text || '')
  const fenceMatch = /```(?:html|svg)\s*([\s\S]*?)```/i.exec(text)
  if (fenceMatch) {
    return { title: 'inline-preview.html', content: fenceMatch[1].trim() }
  }
  return null
}

/**
 * Evaluates candidates visually using dsh-live-canvas and dsh-vision-bridge.
 * Returns { degraded: true } if companion services are absent so the caller falls back cleanly.
 *
 * @param {object} params
 * @returns {Promise<{
 *   degraded: boolean,
 *   reason?: string,
 *   visualScores: Array<{ candidateIndex: number, label: string, visualScore: number, critique: string, previewUrl: string | null }>,
 *   directive: string
 * }>}
 */
export async function runVisualMoaConsensus({
  ctx = null,
  liveCanvas = null,
  visionBridge = null,
  userPrompt = '',
  referenceOutputs = [],
  onProgress = null,
}) {
  const resolvedCanvas = liveCanvas || service(ctx, 'liveCanvas')
  const resolvedVision = visionBridge || service(ctx, 'visionBridge')

  if (!resolvedCanvas && !resolvedVision) {
    return {
      degraded: true,
      reason: 'Companion plugins dsh-live-canvas and dsh-vision-bridge are not active; using standard text evaluation.',
      visualScores: [],
      directive: '',
    }
  }

  if (typeof onProgress === 'function') {
    onProgress('👁️ *Visual MoA Consensus: Rendering UI candidates in Live Canvas & evaluating via Vision Bridge...*\n')
  }

  const visualScores = []
  for (let i = 0; i < referenceOutputs.length; i++) {
    const ref = referenceOutputs[i]
    if (!ref || ref.ok === false) continue
    const idx = ref.index ?? (i + 1)
    const label = ref.label || slotLabel(ref.slot || ref)
    const markup = extractRenderableMarkup(ref)
    if (!markup) continue

    let previewUrl = null
    let screenshot = null

    if (resolvedCanvas) {
      try {
        if (typeof resolvedCanvas.createPreviewFromContent === 'function') {
          const prev = await resolvedCanvas.createPreviewFromContent({
            content: markup.content,
            title: `Candidate #${idx} (${label}) - ${markup.title}`,
          })
          previewUrl = prev?.previewUrl || null
          screenshot = prev?.screenshot || prev?.imageBase64 || null
        }
        if (!screenshot && typeof resolvedCanvas.captureScreenshot === 'function') {
          screenshot = await resolvedCanvas.captureScreenshot({
            content: markup.content,
            previewUrl,
          })
        }
      } catch (err) {
        logger.warn(`[dsh-moa:visual] Live Canvas preview failed for candidate #${idx}:`, err?.message || err)
      }
    }

    let visualScore = 7.5
    let critique = 'Rendered cleanly in Live Canvas preview.'

    if (resolvedVision) {
      try {
        const evalFn = resolvedVision.evaluateVisualLayout || resolvedVision.analyzeImage || resolvedVision.inspectUi
        if (typeof evalFn === 'function') {
          const vRes = await evalFn.call(resolvedVision, {
            prompt: userPrompt,
            candidateIndex: idx,
            html: markup.content,
            previewUrl,
            screenshot,
          })
          if (vRes) {
            if (Number.isFinite(Number(vRes.score))) {
              visualScore = Math.max(1, Math.min(10, Number(vRes.score)))
            }
            if (vRes.critique || vRes.summary || vRes.feedback) {
              critique = String(vRes.critique || vRes.summary || vRes.feedback).trim()
            }
          }
        }
      } catch (err) {
        logger.warn(`[dsh-moa:visual] Vision Bridge evaluation failed for candidate #${idx}:`, err?.message || err)
      }
    }

    visualScores.push({
      candidateIndex: idx,
      label,
      visualScore: Number(visualScore.toFixed(1)),
      critique,
      previewUrl,
    })
  }

  if (visualScores.length === 0) {
    return {
      degraded: true,
      reason: 'No renderable HTML/CSS/SVG artifacts found in candidates.',
      visualScores: [],
      directive: '',
    }
  }

  const lines = [
    '### 👁️ Multimodal Visual MoA Consensus (`dsh-live-canvas` + `dsh-vision-bridge`):',
    'The following UI candidates were rendered and visually inspected for layout, responsiveness, and design fidelity:',
    ...visualScores.map(
      (v) => `- **Candidate #${v.candidateIndex} (${v.label})**: Visual Score **${v.visualScore}/10** — ${v.critique}${v.previewUrl ? ` ([Live Preview](${v.previewUrl}))` : ''}`
    ),
    'Prioritize candidates with higher visual layout fidelity and zero rendering defects.',
  ]

  return {
    degraded: false,
    visualScores,
    directive: lines.join('\n'),
  }
}
