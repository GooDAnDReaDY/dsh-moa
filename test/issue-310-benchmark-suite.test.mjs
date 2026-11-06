import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  STANDARD_BENCHMARK_CASES,
  runBenchmarkTask,
  formatBenchmarkReport,
  runMoABenchmarkSuite,
} from '../lib/pipeline/benchmark-suite.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #310: MoA Preset Regression Benchmark Suite', () => {
  it('STANDARD_BENCHMARK_CASES: contains ground-truth validation for standard puzzles', () => {
    assert.ok(STANDARD_BENCHMARK_CASES.length >= 5)

    const divideCase = STANDARD_BENCHMARK_CASES.find((c) => c.id === 'safe-divide')
    assert.ok(divideCase)
    assert.equal(
      divideCase.validator('function safeDivide(a, b) { if (!isFinite(a) || !isFinite(b)) throw new TypeError(); if (b === 0) return null; return a / b; }'),
      true
    )
    assert.equal(divideCase.validator('function safeDivide(a, b) { return a / b; }'), false)

    const dedupCase = STANDARD_BENCHMARK_CASES.find((c) => c.id === 'array-dedup')
    assert.ok(dedupCase)
    assert.equal(
      dedupCase.validator('function uniqueValues<T>(items: T[]): T[] { return Array.from(new Set(items)); }'),
      true
    )
  })

  it('runBenchmarkTask: executes challenge and returns duration, cost, and validation pass/fail', async () => {
    const mockCall = async () => ({
      text: 'function safeDivide(a, b) { if (typeof a !== "number") throw new TypeError(); if (b === 0) return null; return a / b; }',
      usage: { inputTokens: 40, outputTokens: 60 },
    })

    const task = STANDARD_BENCHMARK_CASES[0]
    const res = await runBenchmarkTask({
      task,
      modelSlot: { provider: 'test', model: 'mock-model' },
      callLlm: mockCall,
    })

    assert.equal(res.taskId, task.id)
    assert.equal(res.passed, true)
    assert.ok(res.durationMs >= 0)
    assert.equal(res.tokens, 100)
  })

  it('formatBenchmarkReport: produces structured Markdown table with comparative metrics', () => {
    const summary = {
      presetName: 'default',
      totalTasks: 2,
      baselinePassRate: 0.5,
      moaPassRate: 1.0,
      baselineCostUsd: 0.002,
      moaCostUsd: 0.005,
      cases: [
        { taskId: 'safe-divide', title: 'Defensive Division', baselinePassed: false, moaPassed: true },
        { taskId: 'array-dedup', title: 'Array Dedup', baselinePassed: true, moaPassed: true },
      ],
    }

    const report = formatBenchmarkReport(summary)
    assert.ok(report.includes('## 📊 MoA Preset Regression Benchmark Report (default)'))
    assert.ok(report.includes('**MoA Ensemble Accuracy**: 100.0%'))
    assert.ok(report.includes('**Single Baseline Accuracy**: 50.0%'))
    assert.ok(report.includes('+50.0%'))
    assert.ok(report.includes('⭐ MoA Superior'))
  })

  it('runMoABenchmarkSuite: executes full benchmark and emits BENCHMARK_COMPLETE event', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const mockCall = async (params) => {
      // Model produces compliant code for all challenges
      return {
        text: `function safeDivide(a, b) { if (!isFinite(a)) throw new TypeError(); if (b === 0) return null; return a / b; }
function uniqueValues<T>(items: T[]): T[] { return [...new Set(items)]; }
function findUserByEmail(db, email) { return db.query('SELECT * FROM users WHERE email = $1', [email]); }`,
        usage: { inputTokens: 50, outputTokens: 80 },
      }
    }

    const preset = {
      name: 'quality-eval',
      reference_models: [{ provider: 'test', model: 'cand-a' }, { provider: 'test', model: 'cand-b' }],
      aggregator: { provider: 'test', model: 'judge-a' },
    }

    const res = await runMoABenchmarkSuite({
      preset,
      maxCases: 3,
      callLlm: mockCall,
      ctx: mockCtx,
    })

    assert.equal(res.presetName, 'quality-eval')
    assert.equal(res.totalTasks, 3)
    assert.equal(res.moaPassRate, 1.0)
    assert.ok(res.markdownReport.includes('MoA Preset Regression Benchmark Report'))

    const evt = events.find((e) => e.evt === MOA_EVENTS.BENCHMARK_COMPLETE)
    assert.ok(evt, 'Expected BENCHMARK_COMPLETE event')
    assert.equal(evt.payload.totalTasks, 3)
  })
})
