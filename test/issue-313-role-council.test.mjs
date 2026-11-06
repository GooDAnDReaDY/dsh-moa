import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeCouncilWeights,
  evaluateCandidateByCouncil,
  formatCouncilDirective,
  runCouncilArbitrationGate,
} from '../lib/pipeline/role-council.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #313: Multi-Persona Role-Playing Council for Holistic Arbitration', () => {
  it('normalizeCouncilWeights: normalizes weights to sum to 100%', () => {
    const weights1 = normalizeCouncilWeights({ architect: 50, security: 50, minimalist: 0 })
    assert.equal(weights1.architect + weights1.security + weights1.minimalist, 100)
    assert.equal(weights1.architect, 50)
    assert.equal(weights1.security, 50)
    assert.equal(weights1.minimalist, 0)

    const weights2 = normalizeCouncilWeights({ architect: 35, security: 35, minimalist: 30 })
    assert.equal(weights2.architect + weights2.security + weights2.minimalist, 100)

    const defaultWeights = normalizeCouncilWeights({})
    assert.equal(defaultWeights.architect + defaultWeights.security + defaultWeights.minimalist, 100)
  })

  it('evaluateCandidateByCouncil: evaluates candidate across Architect, Security, and Minimalist dimensions', () => {
    const modularCandidate = {
      index: 1,
      label: 'Model A',
      files: [
        { relativePath: 'src/index.js', content: 'export default function app() {}' },
        { relativePath: 'src/util.js', content: 'export function helper() {}' },
      ],
      text: 'try { helper(); } catch (err) { console.error(err); }',
    }

    const evalA = evaluateCandidateByCouncil(modularCandidate)
    assert.equal(evalA.candidateIndex, 1)
    assert.ok(evalA.scores.architect >= 7.0, 'Modular candidate should score well on architecture')
    assert.ok(evalA.scores.security >= 7.0, 'Candidate with try/catch should score well on security')
    assert.ok(evalA.critiques.architect.length > 0)
    assert.ok(evalA.critiques.security.length > 0)
    assert.ok(evalA.critiques.minimalist.length > 0)
  })

  it('formatCouncilDirective: formats structured 3-expert report for the Judge', () => {
    const evaluations = [
      {
        label: 'Candidate 1',
        compositeScore: 8.7,
        scores: { architect: 9.0, security: 8.5, minimalist: 8.5 },
        critiques: {
          architect: 'Clean modularity.',
          security: 'Thorough input validation.',
          minimalist: 'Zero boilerplate.',
        },
      },
    ]

    const directive = formatCouncilDirective(evaluations, { architect: 35, security: 35, minimalist: 30 })
    assert.ok(directive.includes('=== 🏛️ MULTI-PERSONA ROLE-PLAYING COUNCIL ARBITRATION ==='))
    assert.ok(directive.includes('Candidate 1 — Weighted Composite: 8.7/10'))
    assert.ok(directive.includes('Systems Architect** [9/10]: Clean modularity.'))
    assert.ok(directive.includes('Security Auditor** [8.5/10]: Thorough input validation.'))
    assert.ok(directive.includes('Pragmatic Minimalist** [8.5/10]: Zero boilerplate.'))
    assert.ok(directive.includes('COUNCIL RECOMMENDATION: Candidate 1'))
  })

  it('runCouncilArbitrationGate: computes weighted composite scores, ranks candidates, and emits COUNCIL_VERDICT event', () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const candidates = [
      {
        index: 1,
        label: 'Model 1',
        files: [{ relativePath: 'a.js', content: 'export function a() {}' }, { relativePath: 'b.js', content: 'export function b() {}' }],
        text: 'try { if (!x) return null; } catch (e) {}',
      },
      {
        index: 2,
        label: 'Model 2',
        text: 'eval(userInput); // insecure pattern without try-catch',
      },
    ]

    const res = runCouncilArbitrationGate(candidates, {
      council_arbitration_enabled: true,
      council_weight_architect: 35,
      council_weight_security: 35,
      council_weight_minimalist: 30,
    }, {
      ctx: mockCtx,
      runId: 'test-council-1',
    })

    assert.equal(res.ok, true)
    assert.equal(res.councilEvaluations.length, 2)
    assert.equal(res.winnerIndex, 1, 'Model 1 should beat insecure Model 2')
    assert.ok(res.councilEvaluations[0].compositeScore > res.councilEvaluations[1].compositeScore)
    assert.ok(res.councilDirective.includes('MULTI-PERSONA ROLE-PLAYING COUNCIL ARBITRATION'))

    const evt = events.find((e) => e.evt === MOA_EVENTS.COUNCIL_VERDICT)
    assert.ok(evt, 'Expected COUNCIL_VERDICT event')
    assert.equal(evt.payload.winnerIndex, 1)
  })
})
