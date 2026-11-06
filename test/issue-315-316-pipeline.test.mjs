import test from 'node:test'
import assert from 'node:assert/strict'
import { runMoAPipeline } from '../lib/pipeline/runner.js'
import { MOA_EVENTS } from '../lib/events.js'

test('runMoAPipeline: triggers Runtime Profiler Gate and emits PROFILER_COMPLETE event', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  let judgeReceivedPrompt = ''
  const mockCallLlm = async (opts) => {
    if (opts.model === 'm-fast') {
      return 'function fastAlgo() { return 123; }'
    }
    if (opts.model === 'm-slow') {
      return 'function slowAlgo() { for (let i = 0; i < 50; i++) {} return 123; }'
    }
    // Judge / Aggregator
    const promptStr = (opts.messages || []).map((m) => m.content).join('\n')
    judgeReceivedPrompt = promptStr
    return 'Winner is m-fast due to lower latency.'
  }

  const result = await runMoAPipeline({
    userPrompt: 'Write an algorithm',
    preset: {
      name: 'profiler-test',
      profiler_gate_enabled: true,
      profiler_iterations: 10,
      ask_clarifying_questions: false,
      curator_synthesis: true,
      reference_models: [
        { provider: 'p1', model: 'm-fast', role_persona: 'proposer' },
        { provider: 'p2', model: 'm-slow', role_persona: 'challenger' },
      ],
      aggregator: { provider: 'p-judge', model: 'judge-model' },
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    cwd: process.cwd(),
  })

  assert.ok(result)
  const profilerEvents = emitted.filter((e) => e.ev === MOA_EVENTS.PROFILER_COMPLETE)
  assert.equal(profilerEvents.length, 2)
  assert.equal(profilerEvents[0].p.passed, true)
  assert.equal(profilerEvents[1].p.passed, true)

  // Judge must receive the profiler directive
  assert.ok(judgeReceivedPrompt.includes('RUNTIME PERFORMANCE & CPU/MEMORY PROFILER REPORT'))
  assert.ok(judgeReceivedPrompt.includes('ops/sec'))
})

test('runMoAPipeline: triggers Mutation Testing Gate and emits MUTATION_COMPLETE event', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  let judgeReceivedPrompt = ''
  const mockCallLlm = async (opts) => {
    if (opts.model === 'm-strong-tests') {
      return `
        function sum(a, b) { return a + b; }
        assert.equal(sum(1, 2), 3);
        assert.equal(sum(-1, 1), 0);
      `
    }
    if (opts.model === 'm-weak-tests') {
      return `
        function sum(a, b) { return a + b; }
        sum(1, 2);
        assert.equal(1, 1);
      `
    }
    // Judge
    const promptStr = (opts.messages || []).map((m) => m.content).join('\n')
    judgeReceivedPrompt = promptStr
    return 'Winner is m-strong-tests. m-weak-tests has tautological tests.'
  }

  const result = await runMoAPipeline({
    userPrompt: 'Write a sum function with unit tests',
    preset: {
      name: 'mutation-test',
      mutation_testing_enabled: true,
      min_mutation_score: 0.50,
      ask_clarifying_questions: false,
      curator_synthesis: true,
      reference_models: [
        { provider: 'p1', model: 'm-strong-tests', role_persona: 'proposer' },
        { provider: 'p2', model: 'm-weak-tests', role_persona: 'challenger' },
      ],
      aggregator: { provider: 'p-judge', model: 'judge-model' },
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    cwd: process.cwd(),
  })

  assert.ok(result)
  const mutationEvents = emitted.filter((e) => e.ev === MOA_EVENTS.MUTATION_COMPLETE)
  assert.equal(mutationEvents.length, 2)
  assert.equal(mutationEvents[0].p.passed, true) // strong tests
  assert.equal(mutationEvents[1].p.passed, false) // weak tests

  // Judge must receive the mutation directive
  assert.ok(judgeReceivedPrompt.includes('RUNTIME MUTATION TESTING & FAULT INJECTION REPORT'))
  assert.ok(judgeReceivedPrompt.includes('RESILIENT TESTS'))
})
