import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanAdvisoryMessages,
  isBroadPromptRequiringQuestions,
  buildQuestionSynthesisPrompt,
  parseWinnerIndex,
  stripOrSummarizeCode,
} from '../lib/moa-runner.js'
import {
  resetMemoryCatalog,
  resolveModelRates,
  loadCachedCatalog,
  estimateTokenCost,
  DIRECT_VENDOR_RATES,
  FALLBACK_RATES,
} from '../lib/pricing.js'

test('cleanAdvisoryMessages: handles objects, nested text blocks, nulls and tool results safely', () => {
  const complexMessages = [
    null,
    undefined,
    'plain string message',
    { role: 'system', content: 'System instruction that should be filtered' },
    { role: 'tool', content: 'Tool execution output that should be filtered' },
    { role: 'user', content: 'Standard string user query' },
    {
      role: 'assistant',
      content: [
        { type: 'thought', text: 'Internal thinking block' },
        { type: 'text', text: 'Visible assistant response block' },
        null,
      ],
    },
    { role: 'user', content: { text: 'User text inside object payload' } },
    { role: 'assistant', text: 'Direct msg.text property' },
    { role: 'user', content: '   ' }, // empty whitespace, should be dropped
  ]

  const cleaned = cleanAdvisoryMessages(complexMessages)
  assert.equal(cleaned.length, 4)
  assert.equal(cleaned[0].role, 'user')
  assert.equal(cleaned[0].content, 'Standard string user query')
  assert.equal(cleaned[1].role, 'assistant')
  assert.equal(cleaned[1].content, 'Visible assistant response block')
  assert.equal(cleaned[2].role, 'user')
  assert.equal(cleaned[2].content, 'User text inside object payload')
  assert.equal(cleaned[3].role, 'assistant')
  assert.equal(cleaned[3].content, 'Direct msg.text property')
})

test('isBroadPromptRequiringQuestions: detects short vague prompts vs specific actions', () => {
  // Broad short prompts that need questionnaire
  assert.equal(isBroadPromptRequiringQuestions('создай сайт для ресторана', []), true)
  assert.equal(isBroadPromptRequiringQuestions('make a todo app', []), true)
  assert.equal(isBroadPromptRequiringQuestions('напиши игру тетрис', []), true)

  // Specific, detailed, or continuation prompts should bypass questionnaire
  assert.equal(isBroadPromptRequiringQuestions('1, 2, темная тема', []), false)
  assert.equal(isBroadPromptRequiringQuestions('да, делай', []), false)
  assert.equal(isBroadPromptRequiringQuestions('поменяй цвет кнопки на синий в style.css и добавь onClick в index.html', []), false)
})

test('parseWinnerIndex: extracts winner index from various judge verdict formats', () => {
  assert.equal(parseWinnerIndex('WINNER_CANDIDATE_INDEX: 2', 1), 2)
  assert.equal(parseWinnerIndex('Выбран лучший вариант: Кандидат 3', 1), 3)
  assert.equal(parseWinnerIndex('The best approach is Reference 2 because...', 1), 2)
  assert.equal(parseWinnerIndex('No structured marker present', 1), 1)
})

test('pricing: resetMemoryCatalog clears cached models and refreshes correctly', () => {
  resetMemoryCatalog()
  const initial = loadCachedCatalog()
  assert.ok(typeof initial === 'object')

  // Check direct vendor rates for deepseek models
  const chatRates = resolveModelRates({ provider: 'deepseek-official', model: 'deepseek-chat' })
  assert.equal(chatRates.input, DIRECT_VENDOR_RATES['deepseek-chat'].input)
  assert.equal(chatRates.output, DIRECT_VENDOR_RATES['deepseek-chat'].output)

  // Check uncataloged model falls back to fallback rates
  const fallback = resolveModelRates({ provider: 'custom-unregistered', model: 'random-model-xyz' })
  assert.equal(fallback.input, FALLBACK_RATES.input)
  assert.equal(fallback.output, FALLBACK_RATES.output)
})

