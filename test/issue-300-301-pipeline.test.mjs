import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { stageProjectContext } from '../lib/pipeline/context.js'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { MOA_EVENTS } from '../lib/events.js'

test('stageProjectContext: expands single model when self_consistency_enabled is true', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, payload) => emitted.push({ ev, payload }) }

  const res = await stageProjectContext({
    userPrompt: 'Write a quicksort implementation',
    preset: {
      name: 'sc-test',
      self_consistency_enabled: true,
      self_consistency_samples: 3,
      self_consistency_temperatures: [0.1, 0.5, 0.9],
      reference_models: [{ provider: 'ollama', model: 'qwen' }],
    },
    cwd: process.cwd(),
    ctx: mockCtx,
  })

  assert.equal(res.ok, true)
  assert.equal(res.selfConsistencyExpanded, true)
  assert.equal(res.effectiveReferences.length, 3)
  assert.equal(res.isFastMode, false) // must not bypass aggregation
  assert.equal(res.effectiveReferences[0].temperature, 0.1)
  assert.equal(res.effectiveReferences[1].temperature, 0.5)
  assert.equal(res.effectiveReferences[2].temperature, 0.9)

  const expandEvent = emitted.find((e) => e.ev === MOA_EVENTS.SELF_CONSISTENCY_EXPAND)
  assert.ok(expandEvent)
  assert.equal(expandEvent.payload.sampleCount, 3)
  assert.equal(expandEvent.payload.originalModel, 'qwen')
})

test('stageProjectContext: preserves fastMode when self_consistency_enabled is false', async () => {
  const res = await stageProjectContext({
    userPrompt: 'Write a quicksort implementation',
    preset: {
      name: 'sc-off',
      self_consistency_enabled: false,
      reference_models: [{ provider: 'ollama', model: 'qwen' }],
    },
    cwd: process.cwd(),
  })

  assert.equal(res.ok, true)
  assert.equal(res.selfConsistencyExpanded, false)
  assert.equal(res.effectiveReferences.length, 1)
  assert.equal(res.isFastMode, true)
})

test('runMoAPipeline: executes Self-Consistency sampling and aggregates single-model samples', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pipeline-sc-'))
  try {
    const emittedEvents = []
    const mockCtx = { emit: (ev, payload) => emittedEvents.push({ ev, payload }) }

    const candidateCalls = []
    let judgeCalledWith = null

    const mockCallLlm = async (args) => {
      const messages = args.messages || []
      const promptStr = messages.map((m) => m.content).join('\n')

      if (promptStr.includes('Judge Criteria') || promptStr.includes('Solution A')) {
        judgeCalledWith = args
        return 'Consensus Winner: Sample 1\n```javascript\nfunction sort(arr) { return arr.sort(); }\n```'
      }

      candidateCalls.push(args)
      return `Sample solution at temp ${args.temperature || 0.6}:\nfunction sort(arr) { return arr.slice().sort((a,b)=>a-b); }`
    }

    const progressLogs = []
    const result = await runMoAPipeline({
      userPrompt: 'Implement sorting',
      cwd: tmpDir,
      preset: {
        name: 'sc-pipeline-test',
        self_consistency_enabled: true,
        self_consistency_samples: 3,
        reference_models: [{ provider: 'local', model: 'local-coder' }],
        aggregator: { provider: 'local', model: 'local-judge' },
        curator_synthesis: true,
      },
      callLlm: mockCallLlm,
      onProgress: (m) => progressLogs.push(m),
      ctx: mockCtx,
    })

    assert.ok(result)
    assert.equal(candidateCalls.length, 3, 'Should have executed 3 candidate samples in parallel')
    assert.ok(judgeCalledWith, 'Synthesis judge should have been called')

    const hasExpandEvent = emittedEvents.some((e) => e.ev === MOA_EVENTS.SELF_CONSISTENCY_EXPAND)
    assert.ok(hasExpandEvent, 'Should have emitted SELF_CONSISTENCY_EXPAND event')

    const hasConsensusLog = progressLogs.some((l) => l.includes('Self-Consistency Agreement'))
    assert.ok(hasConsensusLog, 'Should have logged Self-Consistency agreement')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('runMoAPipeline: triggers auto_upgrade judge escalation when candidate divergence exceeds threshold', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-pipeline-esc-'))
  try {
    const emittedEvents = []
    const mockCtx = { emit: (ev, payload) => emittedEvents.push({ ev, payload }) }

    let chosenJudgeModel = ''
    const mockCallLlm = async (args) => {
      const messages = args.messages || []
      const promptStr = messages.map((m) => m.content).join('\n')

      if (promptStr.includes('Judge Criteria') || promptStr.includes('Solution A')) {
        chosenJudgeModel = args.model
        return 'Escalated Judge Verdict: Candidate A is sound.'
      }

      // Candidate 1 produces math calculation
      if (args.model === 'cand-1') {
        return 'Math solution: return x * 42;'
      }
      // Candidate 2 produces divergent HTML template
      return '<html><body><h1>Not Math</h1></body></html>'
    }

    const progressLogs = []
    const result = await runMoAPipeline({
      userPrompt: 'Do the task',
      cwd: tmpDir,
      preset: {
        name: 'escalate-auto-upgrade-test',
        escalation_policy: 'auto_upgrade',
        escalation_disagreement_threshold: 0.30,
        reference_models: [
          { provider: 'test', model: 'cand-1' },
          { provider: 'test', model: 'cand-2' },
        ],
        aggregator: { provider: 'test', model: 'junior-judge' },
        escalation_judge: { provider: 'test', model: 'senior-judge' },
        curator_synthesis: true,
      },
      callLlm: mockCallLlm,
      onProgress: (m) => progressLogs.push(m),
      ctx: mockCtx,
    })

    assert.ok(result)
    assert.equal(chosenJudgeModel, 'senior-judge', 'Should have upgraded synthesis judge to senior-judge')

    const escEvent = emittedEvents.find((e) => e.ev === MOA_EVENTS.JUDGE_ESCALATION)
    assert.ok(escEvent, 'Should have emitted JUDGE_ESCALATION event')
    assert.equal(escEvent.payload.escalatedType, 'auto_upgrade')
    assert.equal(escEvent.payload.escalatedJudge?.model, 'senior-judge')

    const hasEscLog = progressLogs.some((l) => l.includes('Judge Escalation (auto_upgrade)'))
    assert.ok(hasEscLog, 'Should have reported escalation progress log')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
