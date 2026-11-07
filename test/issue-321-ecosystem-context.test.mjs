import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveEcosystemServices,
  extractBasicSymbols,
  stageEcosystemContext,
} from '../lib/pipeline/ecosystem-context.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #321 - Ecosystem Context Injection with Graceful Degradation', () => {
  it('extractBasicSymbols extracts functions, classes, and imports correctly', () => {
    const code = `
import { foo } from './bar.js'
import express from 'express'

export function computeSum(a, b) {
  return a + b
}

export class OrderService {
  process() {}
}

export const API_VERSION = 'v1'
export interface UserData {}
`
    const { imports, symbols } = extractBasicSymbols(code)
    assert.strictEqual(imports.length, 2)
    assert.ok(imports[0].includes('computeSum') === false)
    assert.strictEqual(symbols.length, 4)
    assert.deepStrictEqual(symbols.map((s) => s.name), ['computeSum', 'OrderService', 'API_VERSION', 'UserData'])
  })

  it('resolves ecosystem services from Cordis ctx or overrides', () => {
    const mockLens = { getSymbols: () => [] }
    const mockWiki = { getGuidelines: () => [] }

    const res1 = resolveEcosystemServices(null, { contextLens: mockLens, llmWiki: mockWiki })
    assert.strictEqual(res1.hasContextLens, true)
    assert.strictEqual(res1.hasLlmWiki, true)

    const mockCtx = {
      get: (name) => (name === 'contextLens' ? mockLens : null),
      reflect: {
        get: (name) => (name === 'llmWiki' ? mockWiki : null),
      },
    }
    const res2 = resolveEcosystemServices(mockCtx)
    assert.strictEqual(res2.hasContextLens, true)
    assert.strictEqual(res2.hasLlmWiki, true)
  })

  it('gracefully degrades when services are absent and uses local AST extraction', async () => {
    const res = await stageEcosystemContext({
      ctx: null,
      userPrompt: 'refactor calculatePrice in billing',
      targetFiles: ['lib/billing.js'],
      fileContents: {
        'lib/billing.js': 'export function calculatePrice(item) { return item.price * 1.2 }\nexport const TAX = 0.2',
      },
      options: { enableEcosystemContext: true },
    })

    assert.strictEqual(res.enabled, true)
    assert.strictEqual(res.injected, true)
    assert.strictEqual(res.hasContextLens, false)
    assert.strictEqual(res.hasLlmWiki, false)
    assert.strictEqual(res.contextLensInjected, false)
    assert.ok(res.directive.includes('Local Autonomous Fallback'))
    assert.ok(res.directive.includes('calculatePrice'))
  })

  it('injects live contextLens and llmWiki data when companion services are active', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const mockLens = {
      getLinkedSymbols: async () => ({
        target: 'lib/order.js',
        dependencies: ['lib/user.js', 'lib/payment.js'],
        symbols: ['createOrder', 'validateOrder'],
      }),
    }
    const mockWiki = {
      getInvariants: async () => [
        'All database queries must use parameterized placeholders',
        'Service methods must return Result<T, E> types',
      ],
    }

    const res = await stageEcosystemContext({
      ctx: mockCtx,
      userPrompt: 'add new order creation logic',
      targetFiles: ['lib/order.js'],
      fileContents: { 'lib/order.js': 'export function createOrder() {}' },
      options: { enableEcosystemContext: true },
      overrides: { contextLens: mockLens, llmWiki: mockWiki },
    })

    assert.strictEqual(res.enabled, true)
    assert.strictEqual(res.injected, true)
    assert.strictEqual(res.contextLensInjected, true)
    assert.strictEqual(res.llmWikiInjected, true)
    assert.ok(res.directive.includes('Ecosystem AST Context (via dsh-context-lens)'))
    assert.ok(res.directive.includes('Architectural Invariants & Guidelines (via dsh-llm-wiki)'))
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].evt, MOA_EVENTS.ECOSYSTEM_CONTEXT)
  })

  it('respects enableEcosystemContext: false toggle', async () => {
    const res = await stageEcosystemContext({
      ctx: null,
      userPrompt: 'test',
      options: { enableEcosystemContext: false },
    })
    assert.strictEqual(res.enabled, false)
    assert.strictEqual(res.injected, false)
    assert.strictEqual(res.directive, null)
  })
})
