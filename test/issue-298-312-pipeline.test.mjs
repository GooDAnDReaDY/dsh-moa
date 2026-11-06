import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runMoAPipeline } from '../lib/pipeline/runner.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #298 and #312 Pipeline Integration', () => {
  it('Blind Embedding Consensus: fast-bypasses judge round when candidates converge', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const identicalCode = '```javascript file="math.js"\nexport function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }\n```'

    const mockCallLlm = async (params) => {
      // Proposers return identical code
      return {
        text: identicalCode,
        usage: { inputTokens: 50, outputTokens: 60 },
      }
    }

    const preset = {
      name: 'test-clustering',
      enabled: true,
      ask_clarifying_questions: false,
      reference_models: [
        { provider: 'test', model: 'mock-a' },
        { provider: 'test', model: 'mock-b' },
      ],
      aggregator: { provider: 'test', model: 'judge-model' },
      embedding_clustering_enabled: true,
      embedding_consensus_threshold: 0.88,
      fallback_to_judge_on_split: true,
    }

    const payload = await runMoAPipeline({
      userPrompt: 'Implement factorial in JavaScript',
      preset,
      callLlm: mockCallLlm,
      cwd: '/tmp',
      ctx: mockCtx,
    })

    assert.equal(payload.kind, 'synthesis')
    assert.equal(payload.isEmbeddingConsensus, true)
    assert.equal(payload.aggregator, 'Blind Embedding Consensus (Bypassed)')
    assert.ok(payload.usage.skippedJudgeTokens > 0)

    const clusterEvt = events.find((e) => e.evt === MOA_EVENTS.EMBEDDING_CLUSTER)
    assert.ok(clusterEvt, 'Expected EMBEDDING_CLUSTER event')
    assert.equal(clusterEvt.payload.consensusReached, true)
  })

  it('Multi-Round Rebuttal Debate: conducts debate and passes protocol to Judge synthesis', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    let judgeSawDebateProtocol = false

    const mockCallLlm = async (params) => {
      // Check if this is the judge call
      if (params.model === 'judge-model') {
        const promptContent = params.messages[0].content
        if (promptContent.includes('MULTI-ROUND REBUTTAL DEBATE PROTOCOL')) {
          judgeSawDebateProtocol = true
        }
        return {
          text: 'Winner: Candidate 1\nWINNER_CANDIDATE_INDEX: 1\nGreat debate, candidate 1 won.',
          usage: { inputTokens: 200, outputTokens: 50 },
        }
      }

      // Check if this is a rebuttal debate call
      if (params.messages[0].content.includes('Rebuttal Debate')) {
        return {
          text: `### CRITIQUE OF PEERS\nOpponent has off-by-one error.\n### REBUTTAL & DEFENSE\nDefending my iterative algorithm.\n### REFINED SOLUTION\n\`\`\`javascript file="res.js"\nconsole.log("refined");\n\`\`\``,
          usage: { inputTokens: 100, outputTokens: 100 },
        }
      }

      // Candidate round 1
      return {
        text: 'Initial candidate response code',
        usage: { inputTokens: 40, outputTokens: 40 },
      }
    }

    const preset = {
      name: 'test-rebuttal',
      enabled: true,
      ask_clarifying_questions: false,
      reference_models: [
        { provider: 'test', model: 'mock-a' },
        { provider: 'test', model: 'mock-b' },
      ],
      aggregator: { provider: 'test', model: 'judge-model' },
      rebuttal_debate_enabled: true,
      rebuttal_rounds: 1,
    }

    const payload = await runMoAPipeline({
      userPrompt: 'Build app',
      preset,
      callLlm: mockCallLlm,
      cwd: '/tmp',
      ctx: mockCtx,
    })

    assert.equal(payload.kind, 'synthesis')
    assert.equal(judgeSawDebateProtocol, true, 'Judge must see the rebuttal debate protocol')

    const debateEvt = events.find((e) => e.evt === MOA_EVENTS.DEBATE_ROUND)
    assert.ok(debateEvt, 'Expected DEBATE_ROUND event')
    assert.equal(debateEvt.payload.roundNumber, 1)
  })
})
