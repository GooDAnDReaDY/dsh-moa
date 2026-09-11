import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { collectProjectContext } from '../lib/file-workspace.js'

test('runMoAPipeline: ask_clarifying_questions=false bypasses questionnaire on broad prompts', async () => {
  const presetWithQuestions = {
    name: 'with-q',
    ask_clarifying_questions: true,
    reference_models: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
    aggregator: { provider: 'agg', model: 'judge' },
  }

  const presetWithoutQuestions = {
    name: 'no-q',
    ask_clarifying_questions: false,
    reference_models: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }],
    aggregator: { provider: 'agg', model: 'judge' },
  }

  const mockCallLlm = async (params) => {
    return `Output from ${params.model}`
  }

  const histFile = path.join(os.tmpdir(), `moa-hist-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`)

  // 1. Broad prompt with questions enabled returns questionnaire
  const res1 = await runMoAPipeline({
    userPrompt: 'создай змейку',
    preset: presetWithQuestions,
    callLlm: mockCallLlm,
    historyFilePath: histFile,
  })
  assert.equal(res1.kind, 'questions')

  // 2. Broad prompt with questions disabled proceeds directly to solution generation
  const res2 = await runMoAPipeline({
    userPrompt: 'создай змейку',
    preset: presetWithoutQuestions,
    callLlm: mockCallLlm,
    historyFilePath: histFile,
  })
  assert.notEqual(res2.kind, 'questions')
  assert.equal(res2.references.length, 2)
  assert.ok(res2.content)

  try { fs.rmSync(histFile, { force: true }) } catch {}
})

test('runMoAPipeline: fast-fails immediately when 100% of candidate models fail without calling judge', async () => {
  let judgeCalled = false
  const preset = {
    name: 'test-failure',
    reference_models: [
      { provider: 'p1', model: 'fail-1' },
      { provider: 'p2', model: 'fail-2' },
    ],
    aggregator: { provider: 'agg', model: 'judge' },
  }

  const mockCallLlm = async (params) => {
    if (params.model === 'judge') {
      judgeCalled = true
      return 'Judge should not be called'
    }
    throw new Error('401 Invalid API Key')
  }

  const res = await runMoAPipeline({
    userPrompt: 'Test all failing candidates',
    preset,
    callLlm: mockCallLlm,
  })

  assert.equal(judgeCalled, false, 'Aggregator/judge must not be called when 100% candidates fail')
  assert.equal(res.kind, 'failure')
  assert.ok(res.content.includes('All advisor models (2) failed'))
  assert.ok(res.content.includes('401 Invalid API Key'))
  assert.equal(res.usage.totalCostUsd, 0)
})

test('collectProjectContext: ignores build/cache dirs like .next, dist, .cache, .worktrees', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-ctx-test-'))
  try {
    // Create regular source files
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<h1>Hello</h1>', 'utf8')
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'src/app.js'), 'console.log(1)', 'utf8')

    // Create ignored directories and files
    fs.mkdirSync(path.join(tmpDir, '.next'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, '.next/bundle.js'), 'huge bundle content', 'utf8')

    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'dist/output.js'), 'minified code', 'utf8')

    fs.mkdirSync(path.join(tmpDir, '.cache'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, '.cache/cache.json'), '{}', 'utf8')

    const ctx = await collectProjectContext(tmpDir, 16000)
    const relPaths = ctx.files.map((f) => f.relativePath)

    assert.ok(relPaths.includes('index.html'))
    assert.ok(relPaths.includes('src/app.js'))
    assert.ok(!relPaths.some((p) => p.startsWith('.next')))
    assert.ok(!relPaths.some((p) => p.startsWith('dist')))
    assert.ok(!relPaths.some((p) => p.startsWith('.cache')))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
