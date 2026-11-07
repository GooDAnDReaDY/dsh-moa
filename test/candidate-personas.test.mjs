import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ROLE_PERSONA_PROMPTS,
  buildSynthesisPrompt,
  buildCuratorSynthesisPrompt,
  buildPeerCritiquePrompt,
} from '../lib/moa-prompts.js'
import { runReferencesParallel } from '../lib/moa-candidates.js'
import { candidatesForHistory } from '../lib/history.js'

test('ROLE_PERSONA_PROMPTS contains expected specialist personas', () => {
  assert.ok(ROLE_PERSONA_PROMPTS.minimalist.includes('MINIMALIST'))
  assert.ok(ROLE_PERSONA_PROMPTS.robustness.includes('ROBUSTNESS'))
  assert.ok(ROLE_PERSONA_PROMPTS.performance.includes('HIGH PERFORMANCE'))
  assert.ok(ROLE_PERSONA_PROMPTS.tester.includes('TESTABILITY'))
  assert.equal(ROLE_PERSONA_PROMPTS.general, '')
})

test('runReferencesParallel: injects role persona instructions into candidate system messages', async () => {
  const capturedMessages = []
  const mockCallLlm = async (opts) => {
    capturedMessages.push(opts.messages)
    return {
      content: `Code from ${opts.model}`,
      usage: { inputTokens: 10, outputTokens: 20 },
    }
  }

  const references = [
    { provider: 'p1', model: 'm1', role_persona: 'minimalist' },
    { provider: 'p2', model: 'm2', role: 'robustness' }, // alias 'role'
    { provider: 'p3', model: 'm3' }, // default 'general'
  ]

  const outputs = await runReferencesParallel(
    references,
    [{ role: 'user', content: 'Create server' }],
    { systemPrompt: 'BASE_SYSTEM' },
    mockCallLlm
  )

  assert.equal(outputs.length, 3)

  // Candidate 1: minimalist
  const sys1 = capturedMessages[0][0].content
  assert.ok(sys1.includes('BASE_SYSTEM'))
  assert.ok(sys1.includes('MINIMALIST'))
  assert.equal(outputs[0].role_persona, 'minimalist')

  // Candidate 2: robustness (from alias 'role')
  const sys2 = capturedMessages[1][0].content
  assert.ok(sys2.includes('BASE_SYSTEM'))
  assert.ok(sys2.includes('ROBUSTNESS'))
  assert.equal(outputs[1].role_persona, 'robustness')

  // Candidate 3: general (no extra prompt)
  const sys3 = capturedMessages[2][0].content
  assert.equal(sys3, 'BASE_SYSTEM')
  assert.equal(outputs[2].role_persona, 'general')
})

test('buildSynthesisPrompt & buildCuratorSynthesisPrompt expose candidate focus to judge', () => {
  const mockRefs = [
    { label: 'p1:m1', role_persona: 'performance', text: 'perf code' },
    { label: 'p2:m2', role_persona: 'tester', text: 'test code' },
    { label: 'p3:m3', role_persona: 'general', text: 'base code' },
  ]

  // Standard synthesis prompt
  const stdPrompt = buildSynthesisPrompt('Do task', mockRefs, '', { blindEvaluation: false })
  assert.ok(stdPrompt.includes('[Focus: performance]'))
  assert.ok(stdPrompt.includes('[Focus: tester]'))
  assert.ok(!stdPrompt.includes('[Focus: general]'), 'Omits general focus tag for brevity')

  // Curator synthesis prompt
  const curPrompt = buildCuratorSynthesisPrompt('Do task', mockRefs, '', { blindEvaluation: false })
  assert.ok(curPrompt.includes('[Focus: performance]'))
  assert.ok(curPrompt.includes('[Focus: tester]'))

  // Blind evaluation mode
  const blindPrompt = buildSynthesisPrompt('Do task', mockRefs, '', { blindEvaluation: true })
  assert.ok(blindPrompt.includes('Reference 1 [Focus: performance]:'))
  assert.ok(blindPrompt.includes('Reference 2 [Focus: tester]:'))
  assert.ok(blindPrompt.includes('Reference 3:'))
})

test('buildPeerCritiquePrompt exposes peer focus in Consilium Round 2', () => {
  const myProposal = 'my code'
  const peers = [
    { label: 'Candidate 2', role_persona: 'minimalist', text: 'peer code' },
  ]

  const prompt = buildPeerCritiquePrompt('Task', myProposal, peers, true)
  assert.ok(prompt.includes('Candidate 1 [Focus: minimalist] Alternative Proposal:'))
})

test('candidatesForHistory includes candidate role focus in history metadata', () => {
  const mockRefs = [
    { slot: { provider: 'p1', model: 'm1' }, role_persona: 'tester', files: [] },
    { slot: { provider: 'p2', model: 'm2', role: 'robustness' }, files: [] },
  ]

  const hist = candidatesForHistory(mockRefs)
  assert.equal(hist[0].role, 'tester')
  assert.equal(hist[1].role, 'robustness')
})
