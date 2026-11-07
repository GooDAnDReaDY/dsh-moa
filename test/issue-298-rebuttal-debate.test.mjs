import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRebuttalPrompt,
  parseRebuttalResponse,
  executeDebateRound,
  formatDebateDirective,
  runRebuttalDebatePhase,
} from '../lib/pipeline/rebuttal-debate.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #298: Multi-Round Rebuttal Debate between Candidates', () => {
  it('buildRebuttalPrompt: builds prompt containing task, previous answer, opponents and instructions', () => {
    const prompt = buildRebuttalPrompt({
      userPrompt: 'Implement a binary search algorithm',
      candidateText: 'function binarySearch(arr, target) { return -1; }',
      opponentAnswers: [
        { label: 'Candidate 2', role_persona: 'robustness', text: 'function search(a, t) { return a.indexOf(t); }' },
      ],
      roundNumber: 1,
      totalRounds: 2,
      isBlind: true,
    })

    assert.ok(prompt.includes('Multi-Agent Consilium Rebuttal Debate (Round 1 of 2)'))
    assert.ok(prompt.includes('Implement a binary search algorithm'))
    assert.ok(prompt.includes('function binarySearch(arr, target)'))
    assert.ok(prompt.includes('Peer Solution [Candidate 2] [Persona: robustness]'))
    assert.ok(prompt.includes('### CRITIQUE OF PEERS'))
    assert.ok(prompt.includes('### REBUTTAL & DEFENSE'))
    assert.ok(prompt.includes('### REFINED SOLUTION'))
  })

  it('parseRebuttalResponse: cleanly parses critiques, defense, and refined code sections', () => {
    const raw = `
### CRITIQUE OF PEERS
- Candidate 2 uses indexOf which is O(N) rather than O(log N) binary search.
- Candidate 3 lacks boundary checks for empty arrays.

### REBUTTAL & DEFENSE
My previous code was a stub. I am now providing a full iterative implementation with high/low pointers.

### REFINED SOLUTION
\`\`\`javascript file="search.js"
export function binarySearch(arr, target) {
  let low = 0, high = arr.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}
\`\`\`
`
    const parsed = parseRebuttalResponse(raw)
    assert.ok(parsed.critiqueText.includes('uses indexOf which is O(N)'))
    assert.ok(parsed.defenseText.includes('full iterative implementation'))
    assert.ok(parsed.refinedText.includes('export function binarySearch'))
    assert.ok(parsed.refinedText.includes('file="search.js"'))
  })

  it('formatDebateDirective: formats multi-round debate protocol for the Judge', () => {
    const directive = formatDebateDirective([
      {
        round: 1,
        critiques: [
          {
            candidateLabel: 'Candidate 1',
            critique: 'Candidate 2 has an off-by-one bug at mid point calculation.',
            defense: 'Defending choice of integer shift operation for performance.',
          },
        ],
      },
    ])

    assert.ok(directive.includes('=== ⚔️ MULTI-ROUND REBUTTAL DEBATE PROTOCOL ==='))
    assert.ok(directive.includes('Debate Round 1'))
    assert.ok(directive.includes('[Candidate 1] Critiques of peers:'))
    assert.ok(directive.includes('off-by-one bug at mid point'))
    assert.ok(directive.includes('Defense & Justification:'))
  })

  it('runRebuttalDebatePhase: conducts debate rounds and emits Cordis events', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const mockCallLlm = async (params) => {
      return {
        text: `### CRITIQUE OF PEERS\nFound memory leak in opponent code.\n\n### REBUTTAL & DEFENSE\nAddressed edge cases.\n\n### REFINED SOLUTION\n\`\`\`javascript file="index.js"\nconsole.log("refined v2");\n\`\`\``,
        usage: { inputTokens: 50, outputTokens: 80 },
      }
    }

    const candidates = [
      { index: 1, label: 'Model A', text: 'console.log("initial A");', provider: 'test', model: 'mock-a' },
      { index: 2, label: 'Model B', text: 'console.log("initial B");', provider: 'test', model: 'mock-b' },
    ]

    const result = await runRebuttalDebatePhase({
      candidates,
      userPrompt: 'Write console log program',
      preset: {
        rebuttal_debate_enabled: true,
        rebuttal_rounds: 2,
      },
      callLlm: mockCallLlm,
      ctx: mockCtx,
      runId: 'test-run-debate',
    })

    assert.equal(result.ok, true)
    assert.equal(result.rounds.length, 2)
    assert.ok(result.totalCritiques > 0)
    assert.ok(result.debateDirective.includes('Debate Round 1'))
    assert.ok(result.debateDirective.includes('Debate Round 2'))
    assert.ok(result.updatedCandidates[0].text.includes('console.log("refined v2");'))

    const debateEvents = events.filter((e) => e.evt === MOA_EVENTS.DEBATE_ROUND)
    assert.equal(debateEvents.length, 2)
    assert.equal(debateEvents[0].payload.roundNumber, 1)
    assert.equal(debateEvents[1].payload.roundNumber, 2)
  })

  it('runRebuttalDebatePhase: skips cleanly when disabled or insufficient candidates', async () => {
    const resultDisabled = await runRebuttalDebatePhase({
      candidates: [{ index: 1, text: 'abc' }, { index: 2, text: 'xyz' }],
      preset: { rebuttal_debate_enabled: false },
    })
    assert.equal(resultDisabled.totalCritiques, 0)
    assert.equal(resultDisabled.debateDirective, '')

    const resultSingle = await runRebuttalDebatePhase({
      candidates: [{ index: 1, text: 'abc' }],
      preset: { rebuttal_debate_enabled: true },
    })
    assert.equal(resultSingle.totalCritiques, 0)
  })
})
