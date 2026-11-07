import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Testable one-shot session execution harness.
 * Mirrors the production session model override and finally-restore guarantee.
 */
export async function executeOneShotTurn({
  session,
  userPrompt,
  preset,
  runTurn,
}) {
  const originalModel = session.model
  const originalProvider = session.provider

  // Temporary switch to MoA aggregator for this turn
  const agg = preset?.aggregator || { provider: 'moa', model: 'default' }
  session.model = agg.model
  session.provider = agg.provider
  session.moaActive = true

  try {
    const result = await runTurn({
      session,
      userPrompt,
      preset,
    })
    return result
  } finally {
    // Guaranteed restore in finally block
    session.model = originalModel
    session.provider = originalProvider
    session.moaActive = false
  }
}

test('one-shot restore: reverts session model on success', async () => {
  const session = {
    id: 'sess-123',
    provider: 'deepseek',
    model: 'deepseek-chat',
  }

  const preset = {
    name: 'default',
    aggregator: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
  }

  let capturedDuringTurn = null
  const runTurn = async () => {
    capturedDuringTurn = {
      provider: session.provider,
      model: session.model,
      moaActive: session.moaActive,
    }
    return 'Turn response'
  }

  const res = await executeOneShotTurn({ session, userPrompt: 'Hello', preset, runTurn })

  assert.equal(res, 'Turn response')
  assert.deepEqual(capturedDuringTurn, {
    provider: 'anthropic',
    model: 'claude-3-7-sonnet',
    moaActive: true,
  })

  // Verify restored state
  assert.equal(session.provider, 'deepseek')
  assert.equal(session.model, 'deepseek-chat')
  assert.equal(session.moaActive, false)
})

test('one-shot restore: reverts session model even when turn throws error', async () => {
  const session = {
    id: 'sess-456',
    provider: 'openai',
    model: 'gpt-4o',
  }

  const preset = {
    name: 'default',
    aggregator: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
  }

  const runTurn = async () => {
    throw new Error('API 500 error mid-turn')
  }

  await assert.rejects(
    async () => {
      await executeOneShotTurn({ session, userPrompt: 'Failing prompt', preset, runTurn })
    },
    { message: 'API 500 error mid-turn' }
  )

  // Verify restored state after exception
  assert.equal(session.provider, 'openai')
  assert.equal(session.model, 'gpt-4o')
  assert.equal(session.moaActive, false)
})
