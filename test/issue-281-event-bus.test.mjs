import test from 'node:test'
import assert from 'node:assert/strict'
import { emitEvent, MOA_EVENTS } from '../lib/events.js'
import { runMoAPipeline } from '../lib/pipeline/runner.js'

test('events: emitEvent handles null ctx, missing emit, and throwing listener gracefully', () => {
  // Should not throw on null / undefined
  assert.doesNotThrow(() => emitEvent(null, MOA_EVENTS.RUN_START, { test: 1 }))
  assert.doesNotThrow(() => emitEvent({}, MOA_EVENTS.RUN_START, { test: 1 }))

  // Throwing listener must be isolated
  const throwingCtx = {
    emit: () => {
      throw new Error('Listener crash')
    },
  }
  assert.doesNotThrow(() => emitEvent(throwingCtx, MOA_EVENTS.RUN_START, { test: 1 }))
})

test('events: emitEvent successfully invokes ctx.emit with correct payload', () => {
  const events = []
  const mockCtx = {
    emit: (event, payload) => events.push({ event, payload }),
  }

  emitEvent(mockCtx, MOA_EVENTS.RUN_START, { runId: 'run-1', prompt: 'test' })
  assert.equal(events.length, 1)
  assert.equal(events[0].event, 'moa/run-start')
  assert.equal(events[0].payload.runId, 'run-1')
})

test('events: runMoAPipeline emits full lifecycle events across consensus phases', async () => {
  const emittedEvents = []
  const mockCtx = {
    emit: (name, data) => emittedEvents.push({ name, data }),
  }

  const fakePreset = {
    name: 'test-events-preset',
    references: [
      { provider: 'p1', model: 'm1' },
      { provider: 'p2', model: 'm2' },
    ],
    aggregator: { provider: 'p-judge', model: 'm-judge' },
    ask_clarifying_questions: false,
    peer_critique_enabled: true,
    composite_merge_enabled: false,
  }

  const callLlm = async (opts) => {
    // Advisor models
    if (opts.model === 'm1') {
      return { content: 'Solution from advisor 1', usage: { totalTokens: 100 } }
    }
    if (opts.model === 'm2') {
      return { content: 'Solution from advisor 2', usage: { totalTokens: 120 } }
    }
    // Judge synthesis
    if (opts.model === 'm-judge') {
      return { content: 'Winner: Candidate 1\nReasoning: clean design', usage: { totalTokens: 80 } }
    }
    return { content: 'ok' }
  }

  const res = await runMoAPipeline({
    userPrompt: 'Implement specific function add(a, b) in math.js with tests',
    preset: fakePreset,
    callLlm,
    ctx: mockCtx,
    runId: 'custom-event-run-123',
    checkpoint: false,
    force: true,
  })

  assert.equal(res.kind, 'synthesis')

  // Verify moa/run-start was emitted
  const startEvent = emittedEvents.find((e) => e.name === MOA_EVENTS.RUN_START)
  assert.ok(startEvent, 'moa/run-start must be emitted')
  assert.equal(startEvent.data.runId, 'custom-event-run-123')
  assert.equal(startEvent.data.candidatesCount, 2)

  // Verify moa/candidate-complete was emitted for advisors in round 1
  const candEvents = emittedEvents.filter((e) => e.name === MOA_EVENTS.CANDIDATE_COMPLETE)
  assert.ok(candEvents.length >= 2, 'Must emit moa/candidate-complete for advisors')
  assert.equal(candEvents[0].data.round, 1)
  assert.equal(candEvents[0].data.success, true)

  // Verify moa/critique-complete was emitted for round 2
  const critiqueEvent = emittedEvents.find((e) => e.name === MOA_EVENTS.CRITIQUE_COMPLETE)
  assert.ok(critiqueEvent, 'moa/critique-complete must be emitted')
  assert.equal(critiqueEvent.data.runId, 'custom-event-run-123')
  assert.equal(critiqueEvent.data.critiquesCount, 2)

  // Verify moa/judge-verdict was emitted
  const verdictEvent = emittedEvents.find((e) => e.name === MOA_EVENTS.JUDGE_VERDICT)
  assert.ok(verdictEvent, 'moa/judge-verdict must be emitted')
  assert.equal(verdictEvent.data.runId, 'custom-event-run-123')
  assert.equal(verdictEvent.data.winningIndex, 1)

  // Verify moa/run-finish was emitted
  const finishEvent = emittedEvents.find((e) => e.name === MOA_EVENTS.RUN_FINISH)
  assert.ok(finishEvent, 'moa/run-finish must be emitted')
  assert.equal(finishEvent.data.runId, 'custom-event-run-123')
  assert.equal(finishEvent.data.winnerIndex, 1)
  assert.ok(finishEvent.data.durationMs >= 0)
  assert.ok(finishEvent.data.totalTokens >= 200)
})

test('events: fast-mode (single candidate) emits start and finish events', async () => {
  const emittedEvents = []
  const mockCtx = {
    emit: (name, data) => emittedEvents.push({ name, data }),
  }

  const singleRefPreset = {
    name: 'fast-preset',
    references: [{ provider: 'p1', model: 'm1' }],
    aggregator: { provider: 'pj', model: 'mj' },
  }

  const callLlm = async () => ({ content: 'Single candidate output', usage: { totalTokens: 50 } })

  const res = await runMoAPipeline({
    userPrompt: 'Quick specific calculation add(1, 2)',
    preset: singleRefPreset,
    callLlm,
    ctx: mockCtx,
    runId: 'fast-run-456',
    checkpoint: false,
    force: true,
  })

  assert.equal(res.kind, 'synthesis')
  assert.equal(res.isFastMode, true)

  const startEvent = emittedEvents.find((e) => e.name === MOA_EVENTS.RUN_START)
  assert.ok(startEvent, 'moa/run-start must be emitted')

  const finishEvent = emittedEvents.find((e) => e.name === MOA_EVENTS.RUN_FINISH)
  assert.ok(finishEvent, 'moa/run-finish must be emitted')
  assert.equal(finishEvent.data.runId, 'fast-run-456')
  assert.equal(finishEvent.data.winnerIndex, 1)
})
