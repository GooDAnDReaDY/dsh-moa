import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { stageProjectContext } from '../lib/pipeline/context.js'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { MOA_EVENTS } from '../lib/events.js'

test('stageProjectContext: detects project manifest, emits STACK_DETECTED, and evolves personas', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pipe-stack-'))
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'my-ts-app',
        dependencies: { react: '^18.0.0', zod: '^3.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'utf8'
    )

    const emitted = []
    const mockCtx = { emit: (ev, payload) => emitted.push({ ev, payload }) }

    const res = await stageProjectContext({
      userPrompt: 'Build a contact form',
      cwd: tmpDir,
      preset: {
        name: 'test-preset',
        stack_aware_personas_enabled: true,
        reference_models: [
          { provider: 'p1', model: 'm1' },
          { provider: 'p2', model: 'm2' },
        ],
      },
      ctx: mockCtx,
    })

    assert.equal(res.ok, true)
    assert.equal(res.stackInfo.primaryLanguage, 'typescript')
    assert.ok(res.stackInfo.manifestFound)
    assert.ok(res.stackAwareDirective.includes('Project Stack & Architecture Context'))

    // Verify candidate personas were evolved
    assert.ok(res.effectiveReferences[0].role_persona.includes('Component Architecture'))
    assert.ok(res.effectiveReferences[1].role_persona.includes('TypeScript Strict Typing'))

    // Verify event
    const stackEv = emitted.find((e) => e.ev === MOA_EVENTS.STACK_DETECTED)
    assert.ok(stackEv)
    assert.equal(stackEv.payload.primaryLanguage, 'typescript')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('runMoAPipeline: injects developer preferences and stack directives into Judge prompt', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pipe-pref-'))
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'Cargo.toml'),
      '[package]\nname = "rust_srv"\n[dependencies]\naxum = "0.7"\n',
      'utf8'
    )

    const emitted = []
    const mockCtx = { emit: (ev, payload) => emitted.push({ ev, payload }) }

    let judgeReceivedPrompt = ''
    const candidateCalls = []

    const mockCallLlm = async (args) => {
      const messages = args.messages || []
      const promptStr = messages.map((m) => m.content).join('\n')

      if (promptStr.includes('Judge Criteria') || promptStr.includes('Solution A')) {
        judgeReceivedPrompt = promptStr
        return 'Judge Verdict: Candidate 1 adheres to Rust conventions.'
      }

      candidateCalls.push(args)
      return 'fn main() { println!("Hello from candidate"); }'
    }

    const progressLogs = []
    const result = await runMoAPipeline({
      userPrompt: 'Implement HTTP handler',
      cwd: tmpDir,
      preset: {
        name: 'test-pref',
        stack_aware_personas_enabled: true,
        developer_preferences_enabled: true,
        reference_models: [
          { provider: 'p1', model: 'm1' },
          { provider: 'p2', model: 'm2' },
        ],
        aggregator: { provider: 'test', model: 'judge' },
        curator_synthesis: true,
      },
      callLlm: mockCallLlm,
      onProgress: (m) => progressLogs.push(m),
      ctx: mockCtx,
    })

    assert.ok(result)
    assert.ok(result.kind === 'synthesis')

    // Judge should receive developer preferences directive
    assert.ok(judgeReceivedPrompt.includes('Developer Coding Principles & Preferred Conventions'))
    // Judge should receive stack directive
    assert.ok(judgeReceivedPrompt.includes('Project Stack & Architecture Context'))
    assert.ok(judgeReceivedPrompt.includes('rust'))

    // Stack event was emitted
    assert.ok(emitted.some((e) => e.ev === MOA_EVENTS.STACK_DETECTED))
    // Preferences event was emitted
    assert.ok(emitted.some((e) => e.ev === MOA_EVENTS.PREFERENCES_APPLIED))

    // Check progress log
    assert.ok(progressLogs.some((l) => l.includes('Project Stack: Detected rust')))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
