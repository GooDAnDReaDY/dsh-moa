import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  getKnowledgeFilePath,
  loadLocalKnowledge,
  saveLocalKnowledge,
  resolveMemoryBrainService,
  recordConsensusDecision,
  recallConsensusKnowledge,
} from '../lib/pipeline/knowledge-graph.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #322 - Consensus Knowledge Graph Integration with dsh-memory-brain', () => {
  let tmpFile

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `moa-test-knowledge-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  })

  afterEach(() => {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    } catch (_e) {}
  })

  it('handles load and save of local knowledge file', () => {
    const initial = loadLocalKnowledge(tmpFile)
    assert.deepStrictEqual(initial, { version: 1, entries: [] })

    const data = {
      version: 1,
      entries: [{ id: 'test-1', prompt: 'hello', winnerModel: 'deepseek-coder' }],
    }
    const saved = saveLocalKnowledge(tmpFile, data)
    assert.strictEqual(saved, true)

    const reloaded = loadLocalKnowledge(tmpFile)
    assert.strictEqual(reloaded.entries.length, 1)
    assert.strictEqual(reloaded.entries[0].winnerModel, 'deepseek-coder')
  })

  it('records consensus decision autonomously to local knowledge file', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const recRes = await recordConsensusDecision({
      runId: 'run-101',
      prompt: 'Implement token bucket rate limiter for API gateway',
      winnerModel: 'claude-3-7-sonnet',
      winningApproach: 'Token bucket with Redis atomic Lua script',
      verdict: 'Selected for atomicity and sub-millisecond response',
      rejectedReasons: ['Candidate B: memory leak under high concurrency'],
      rules: ['Use atomic Lua scripts for distributed Redis operations'],
      tags: ['rate-limiter', 'redis'],
      ctx: mockCtx,
      config: { sync_with_memory_brain: false },
      filePath: tmpFile,
    })

    assert.strictEqual(recRes.localSaved, true)
    assert.strictEqual(recRes.memoryBrainSynced, false)

    const stored = loadLocalKnowledge(tmpFile)
    assert.strictEqual(stored.entries.length, 1)
    assert.strictEqual(stored.entries[0].id, 'run-101')
    assert.strictEqual(stored.entries[0].rules[0], 'Use atomic Lua scripts for distributed Redis operations')

    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].evt, MOA_EVENTS.KNOWLEDGE_STORED)
  })

  it('syncs consensus decision with dsh-memory-brain when service is active', async () => {
    const remembered = []
    const mockMemoryBrain = {
      remember: async (payload) => {
        remembered.push(payload)
        return { ok: true }
      },
    }

    const recRes = await recordConsensusDecision({
      runId: 'run-102',
      prompt: 'Refactor database migration handler',
      winnerModel: 'gpt-4o',
      winningApproach: 'Idempotent schema migrations with advisory locks',
      verdict: 'Prevented deadlocks across replica nodes',
      ctx: null,
      config: { sync_with_memory_brain: true },
      filePath: tmpFile,
      overrides: { memoryBrain: mockMemoryBrain },
    })

    assert.strictEqual(recRes.localSaved, true)
    assert.strictEqual(recRes.memoryBrainSynced, true)
    assert.strictEqual(remembered.length, 1)
    assert.ok(remembered[0].content.includes('Idempotent schema migrations'))
    assert.strictEqual(remembered[0].metadata.winnerModel, 'gpt-4o')
  })

  it('recalls past consensus precedents to prevent repeated debates', async () => {
    // Populate local knowledge with a precedent
    saveLocalKnowledge(tmpFile, {
      version: 1,
      entries: [
        {
          id: 'prev-1',
          prompt: 'How to handle authentication token expiration in microservices',
          winnerModel: 'claude-3-7-sonnet',
          winningApproach: 'Short-lived JWT access tokens with rotating refresh tokens',
          verdict: 'Standardized security policy',
          rules: ['Never store tokens in localStorage; use HTTP-only cookies'],
        },
      ],
    })

    const recallRes = await recallConsensusKnowledge({
      prompt: 'Implement token authentication with refresh tokens',
      ctx: null,
      config: { sync_with_memory_brain: false },
      filePath: tmpFile,
      maxEntries: 2,
    })

    assert.strictEqual(recallRes.count, 1)
    assert.ok(recallRes.directive)
    assert.ok(recallRes.directive.includes('Past MoA Consensus Decisions'))
    assert.ok(recallRes.directive.includes('Short-lived JWT access tokens'))
    assert.ok(recallRes.directive.includes('HTTP-only cookies'))
  })

  it('combines local entries and memoryBrain recall results without duplicates', async () => {
    saveLocalKnowledge(tmpFile, {
      version: 1,
      entries: [
        {
          id: 'local-1',
          prompt: 'Database connection pooling',
          winnerModel: 'deepseek-v3',
          winningApproach: 'PgBouncer in transaction pooling mode',
          rules: ['Max pool size 20 per pod'],
        },
      ],
    })

    const mockMemoryBrain = {
      recall: async () => [
        {
          id: 'mb-node-1',
          title: 'Database connection pooling memory',
          content: 'Set idle timeout to 30s to prune stale postgres connections',
          metadata: { winnerModel: 'gpt-4o', rules: ['30s idle timeout'] },
        },
      ],
    }

    const recallRes = await recallConsensusKnowledge({
      prompt: 'Setup database pooling configuration',
      ctx: null,
      config: { sync_with_memory_brain: true },
      filePath: tmpFile,
      maxEntries: 5,
      overrides: { memoryBrain: mockMemoryBrain },
    })

    assert.strictEqual(recallRes.count, 2)
    assert.strictEqual(recallRes.hasMemoryBrain, true)
    assert.ok(recallRes.directive.includes('PgBouncer in transaction pooling mode'))
    assert.ok(recallRes.directive.includes('idle timeout to 30s'))
  })
})
