import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  normalizePrompt,
  computePromptFingerprint,
  getCacheEntry,
  setCacheEntry,
  clearSemanticCache,
  getSemanticCacheStats,
  resetRuntimeCacheStats,
} from '../lib/pipeline/semantic-cache.js'

test('normalizePrompt: strips redundant whitespace and newlines', () => {
  const input = '   hello    world \r\n\r\n\r\n\r\n   foo  bar   '
  assert.equal(normalizePrompt(input), 'hello world\n\nfoo bar')
})

test('computePromptFingerprint: generates deterministic hash ignoring minor whitespace', () => {
  const hash1 = computePromptFingerprint('Write a function foo()', {
    model: 'openai:gpt-4',
    temperature: 0.6,
    systemPrompt: 'You are an expert coder.',
  })
  const hash2 = computePromptFingerprint('  Write  a  function foo()  ', {
    model: 'openai:gpt-4',
    temperature: 0.6001,
    systemPrompt: 'You are an expert coder.',
  })
  const hashDiffModel = computePromptFingerprint('Write a function foo()', {
    model: 'anthropic:claude-3',
    temperature: 0.6,
    systemPrompt: 'You are an expert coder.',
  })

  assert.equal(hash1, hash2)
  assert.notEqual(hash1, hashDiffModel)
  assert.equal(hash1.length, 64)
})

test('setCacheEntry and getCacheEntry: stores and retrieves cached responses', () => {
  resetRuntimeCacheStats()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-cache-test-'))
  try {
    const key = 'testkey123456789'
    const payload = {
      model: 'test:fast-model',
      output: 'function foo() { return 42; }',
      usage: { totalTokens: 120, promptTokens: 30, completionTokens: 90 },
      costUsd: 0.0005,
    }

    const saved = setCacheEntry(key, payload, { cacheDir: tmpDir })
    assert.equal(saved, true)

    const retrieved = getCacheEntry(key, { cacheDir: tmpDir })
    assert.ok(retrieved)
    assert.equal(retrieved.model, 'test:fast-model')
    assert.equal(retrieved.output, 'function foo() { return 42; }')
    assert.equal(retrieved.usage.totalTokens, 120)

    const stats = getSemanticCacheStats({ cacheDir: tmpDir })
    assert.equal(stats.entriesCount, 1)
    assert.equal(stats.hits, 1)
    assert.equal(stats.savedTokens, 120)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('getCacheEntry: handles expired TTL gracefully', () => {
  resetRuntimeCacheStats()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-cache-expire-'))
  try {
    const key = 'expiredkey123'
    const payload = {
      model: 'test:model',
      output: 'stale result',
      ttlMs: 50, // 50ms TTL
    }

    setCacheEntry(key, payload, { cacheDir: tmpDir, ttlMs: 50 })
    // Wait for expiration
    const start = Date.now()
    while (Date.now() - start < 70) {}

    const res = getCacheEntry(key, { cacheDir: tmpDir })
    assert.equal(res, null)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('clearSemanticCache: purges cached entries', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-cache-clear-'))
  try {
    setCacheEntry('key1', { output: 'out1' }, { cacheDir: tmpDir })
    setCacheEntry('key2', { output: 'out2' }, { cacheDir: tmpDir })

    const statsBefore = getSemanticCacheStats({ cacheDir: tmpDir })
    assert.equal(statsBefore.entriesCount, 2)

    const clearRes = clearSemanticCache({ cacheDir: tmpDir })
    assert.equal(clearRes.clearedCount, 2)

    const statsAfter = getSemanticCacheStats({ cacheDir: tmpDir })
    assert.equal(statsAfter.entriesCount, 0)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

