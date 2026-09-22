import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSynthesisPrompt,
  buildCuratorSynthesisPrompt,
  buildQuestionSynthesisPrompt,
  LANGUAGE_MIRRORING_DIRECTIVE,
} from '../lib/moa-prompts.js'
import { runMoAPipeline } from '../lib/moa-runner.js'
import fs from 'node:fs'
import path from 'node:path'

test('buildSynthesisPrompt enforces Language Mirroring directive', () => {
  const prompt = buildSynthesisPrompt(
    'Привет, напиши быстрый алгоритм сортировки',
    [{ label: 'provider:model-a', text: 'Вот решение' }],
    'Скорость',
    { blindEvaluation: false }
  )
  assert.ok(prompt.includes(LANGUAGE_MIRRORING_DIRECTIVE))
  assert.ok(prompt.includes('Language Mirroring Requirement'))
})

test('buildSynthesisPrompt respects blindEvaluation flag', () => {
  const responses = [
    { label: 'anthropic:claude-3-5-sonnet', text: 'Solution from Claude' },
    { label: 'openai:gpt-4o', text: 'Solution from GPT' },
  ]

  // Non-blind mode includes model labels
  const normalPrompt = buildSynthesisPrompt(
    'Solve this task',
    responses,
    '',
    { blindEvaluation: false }
  )
  assert.ok(normalPrompt.includes('Reference 1 — anthropic:claude-3-5-sonnet:'))
  assert.ok(normalPrompt.includes('Reference 2 — openai:gpt-4o:'))

  // Blind mode masks model labels
  const blindPrompt = buildSynthesisPrompt(
    'Solve this task',
    responses,
    '',
    { blindEvaluation: true }
  )
  assert.ok(blindPrompt.includes('Reference 1:'))
  assert.ok(blindPrompt.includes('Reference 2:'))
  assert.ok(!blindPrompt.includes('claude-3-5-sonnet'))
  assert.ok(!blindPrompt.includes('gpt-4o'))
})

test('buildCuratorSynthesisPrompt respects blindEvaluation and language mirroring', () => {
  const responses = [
    { label: 'deepseek:deepseek-chat', text: 'Code proposal A' },
    { label: 'google:gemini-2.5-pro', text: 'Code proposal B' },
  ]

  const normalCuratorPrompt = buildCuratorSynthesisPrompt(
    'Optimize database indexes',
    responses,
    '',
    { blindEvaluation: false }
  )
  assert.ok(normalCuratorPrompt.includes(LANGUAGE_MIRRORING_DIRECTIVE))
  assert.ok(normalCuratorPrompt.includes('Candidate 1 — deepseek:deepseek-chat:'))
  assert.ok(normalCuratorPrompt.includes('Candidate 2 — google:gemini-2.5-pro:'))

  const blindCuratorPrompt = buildCuratorSynthesisPrompt(
    'Optimize database indexes',
    responses,
    '',
    { blindEvaluation: true }
  )
  assert.ok(blindCuratorPrompt.includes(LANGUAGE_MIRRORING_DIRECTIVE))
  assert.ok(blindCuratorPrompt.includes('Candidate 1:'))
  assert.ok(blindCuratorPrompt.includes('Candidate 2:'))
  assert.ok(!blindCuratorPrompt.includes('deepseek-chat'))
  assert.ok(!blindCuratorPrompt.includes('gemini-2.5-pro'))
})

test('buildQuestionSynthesisPrompt includes language mirroring directive', () => {
  const qPrompt = buildQuestionSynthesisPrompt('Wie erstelle ich einen Microservice in Go?')
  assert.ok(qPrompt.includes(LANGUAGE_MIRRORING_DIRECTIVE))
})

test('runMoAPipeline: blind_evaluation passes anonymized candidates to aggregator', async () => {
  let capturedJudgeMessages = null

  const mockCallLlm = async (callArgs) => {
    if (callArgs.model === 'judge-model') {
      capturedJudgeMessages = callArgs.messages
      return {
        content: 'WINNER_CANDIDATE_INDEX: 1\nRECOMMENDED_ASSEMBLER: 1\n\nFinal synthesized output',
        usage: { inputTokens: 50, outputTokens: 20 },
      }
    }
    return {
      content: 'Independent candidate proposal code without provider tags',
      usage: { inputTokens: 10, outputTokens: 10 },
    }
  }

  const result = await runMoAPipeline({
    userPrompt: 'Create a microservice architecture',
    preset: {
      reference_models: [
        { provider: 'prov1', model: 'model-alpha' },
        { provider: 'prov2', model: 'model-beta' },
      ],
      aggregator: { provider: 'judge-prov', model: 'judge-model' },
      blind_evaluation: true,
      ask_clarifying_questions: false,
    },
    callLlm: mockCallLlm,
  })

  assert.ok(result)
  assert.ok(capturedJudgeMessages, 'Judge LLM must be called')
  const judgePromptText = capturedJudgeMessages[capturedJudgeMessages.length - 1].content

  // Verify anonymization in judge prompt: Reference 1:, Reference 2: without prov1:model-alpha or prov2:model-beta
  assert.ok(judgePromptText.includes('Reference 1:'))
  assert.ok(judgePromptText.includes('Reference 2:'))
  assert.ok(!judgePromptText.includes('prov1:model-alpha'))
  assert.ok(!judgePromptText.includes('prov2:model-beta'))
  assert.ok(judgePromptText.includes(LANGUAGE_MIRRORING_DIRECTIVE))
})

test('index.js defines blind_evaluation, reference_timeout_sec and aggregator_timeout_sec', () => {
  const indexPath = path.resolve('lib/index.js')
  const indexCode = fs.readFileSync(indexPath, 'utf8')

  assert.ok(indexCode.includes('blind_evaluation: z.boolean().default(false)'))
  assert.ok(indexCode.includes('reference_timeout_sec: z.number().default(60)'))
  assert.ok(indexCode.includes('aggregator_timeout_sec: z.number().default(180)'))
})

test('client.js includes blind evaluation, timeouts, and leaderboard UI keys', () => {
  const clientPath = path.resolve('lib/client.js')
  const clientCode = fs.readFileSync(clientPath, 'utf8')

  assert.ok(clientCode.includes('aggregator.blind_label'))
  assert.ok(clientCode.includes('aggregator.timeout_label'))
  assert.ok(clientCode.includes('proposers.timeout_label'))
  assert.ok(clientCode.includes('leaderboard.title'))
  assert.ok(clientCode.includes('/dsh-moa/leaderboard'))
  assert.ok(clientCode.includes('blind_evaluation: e.target.checked'))
  assert.ok(clientCode.includes('aggregator_timeout_sec:'))
  assert.ok(clientCode.includes('reference_timeout_sec:'))
})
