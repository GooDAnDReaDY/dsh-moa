import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { formatProjectContext, isRefinementTask, cleanMoaWorkspaces } from '../lib/file-workspace.js'
import { buildPeerCritiquePrompt, buildSynthesisPrompt } from '../lib/moa-prompts.js'
import { summarizeMoAUsage } from '../lib/pricing.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

test('formatProjectContext: formats files into Markdown code fences with paths', () => {
  const empty = formatProjectContext([])
  assert.equal(empty, '')

  const formatted = formatProjectContext([
    { relativePath: 'index.html', content: '<h1>Hello</h1>' },
    { relativePath: 'style.css', content: 'body { color: red; }' },
  ])
  assert.ok(formatted.includes('### File: index.html'))
  assert.ok(formatted.includes('<h1>Hello</h1>'))
  assert.ok(formatted.includes('### File: style.css'))
  assert.ok(formatted.includes('body { color: red; }'))
})

test('isRefinementTask: supports prompt evaluation with and without project files array', () => {
  // With non-empty files
  assert.equal(isRefinementTask('fix the navigation bar style', [{ relativePath: 'app.js' }]), true)
  // With empty files
  assert.equal(isRefinementTask('fix the navigation bar style', []), false)
  // With null/omitted files (fallback heuristic)
  assert.equal(isRefinementTask('fix the navigation bar style'), true)
  assert.equal(isRefinementTask('create a brand new game from scratch'), false)
})

test('buildPeerCritiquePrompt: summarizes oversized opponent code to protect context window', () => {
  const longCode = '```javascript\n' + 'const x = 1;\n'.repeat(300) + '```'
  const prompt = buildPeerCritiquePrompt('Task', 'My proposal', [{ label: 'Candidate 2', text: longCode }], true)

  assert.ok(prompt.includes('Peer Critique'))
  // Ensure long code was summarized rather than dumped raw
  assert.ok(prompt.includes('lines saved to disk') || prompt.length < longCode.length)
})

test('buildSynthesisPrompt: summarizes candidate solutions exceeding 3000 chars regardless of candidate count', () => {
  const longCode = '```javascript\n' + 'function test() { return 42; }\n'.repeat(200) + '```'
  const prompt = buildSynthesisPrompt('Task', [
    { label: 'Model A', text: longCode },
    { label: 'Model B', text: 'Short proposal' },
  ])

  assert.ok(prompt.includes('lines saved to disk') || prompt.length < longCode.length)
})

test('summarizeMoAUsage: calculates combined token usage and cost for pipeline', () => {
  const refOutputs = [
    { label: 'c1', usage: { totalTokens: 100 }, costUsd: 0.001 },
    { label: 'c2', usage: { totalTokens: 200 }, costUsd: 0.002 },
  ]
  const aggUsage = { totalTokens: 50, costUsd: 0.0005, inputTokens: 40, outputTokens: 10 }
  const summary = summarizeMoAUsage(refOutputs, aggUsage)

  assert.equal(summary.totalTokens, 350)
  assert.equal(summary.totalCostUsd, 0.0035)
  assert.equal(summary.candidates.length, 2)
  assert.equal(summary.aggregator.totalTokens, 50)
})

test('runMoAPipeline: respects AbortSignal and cleans up workspaces without crashing', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-abort-test-'))
  const controller = new AbortController()
  controller.abort() // Pre-aborted signal

  try {
    const res = await runMoAPipeline({
      userPrompt: 'build an app',
      preset: {
        reference_models: [{ provider: 'p1', model: 'm1' }],
        aggregator: { provider: 'p1', model: 'm1' },
      },
      callLlm: async () => 'mock output',
      cwd: tmpDir,
      signal: controller.signal,
    })

    assert.ok(res.error)
    assert.equal(res.error.message, 'Turn aborted')
  } finally {
    await cleanMoaWorkspaces(tmpDir)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('runMoAPipeline: Round 2 peer critique updates candidate workspace on disk', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-r2-disk-'))
  try {
    let callCount = 0
    const mockCallLlm = async (args) => {
      callCount++
      const userMsg = (args.messages || []).find((m) => m.role === 'user')?.content || ''
      if (userMsg.includes('Consilium / Peer Critique')) {
        // Round 2 refined file output
        return 'Refined code:\n```html\n<!-- file: index.html -->\n<!DOCTYPE html><html><body>Refined V2</body></html>\n```\nWINNER_CANDIDATE_INDEX: 1'
      }
      if (userMsg.includes('expert aggregator/judge')) {
        return 'Judge chooses Candidate 1\nWINNER_CANDIDATE_INDEX: 1'
      }
      // Round 1
      return 'Draft:\n```html\n<!-- file: index.html -->\n<!DOCTYPE html><html><body>Draft V1</body></html>\n```'
    }

    const res = await runMoAPipeline({
      userPrompt: 'create a landing page',
      preset: {
        reference_models: [
          { provider: 'p1', model: 'm1' },
          { provider: 'p2', model: 'm2' },
        ],
        aggregator: { provider: 'p-agg', model: 'm-agg' },
        peer_critique_enabled: true,
        allow_candidate_override: true,
        ask_clarifying_questions: false,
      },
      callLlm: mockCallLlm,
      cwd: tmpDir,
    })

    assert.equal(res.winningIndex, 1)
    // Verify candidate-1 workspace on disk contains Round 2 refined content
    const cand1File = path.join(tmpDir, '.moa', 'candidate-1', 'index.html')
    assert.ok(fs.existsSync(cand1File), 'candidate-1 file exists in .moa')
    const fileContent = fs.readFileSync(cand1File, 'utf8')
    assert.ok(fileContent.includes('Refined V2'), 'candidate-1 on disk has Round 2 refined code')
  } finally {
    await cleanMoaWorkspaces(tmpDir)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
