import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runMoAPipeline } from '../lib/moa-runner.js'
import { MOA_EVENTS } from '../lib/events.js'

test('Issue #305: runMoAPipeline applies context pruning to large base files and emits event', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-prune-test-'))
  try {
    // Create a 50-line file in workspace
    const baseLines = []
    for (let i = 1; i <= 50; i++) baseLines.push(`export const item_${i} = ${i};`)
    const baseFile = baseLines.join('\n')
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'src', 'data.js'), baseFile, 'utf8')

    // Dispatched events tracking
    const emittedEvents = []
    const mockCtx = {
      emit: (eventName, payload) => {
        emittedEvents.push({ eventName, payload })
      },
    }

    let judgePromptReceived = ''
    const mockCallLlm = async (args) => {
      const messages = args.messages || []
      const promptStr = messages.map((m) => m.content).join('\n')

      // Check if this is the Judge call (Stage 7)
      if (promptStr.includes('Judge Criteria') || promptStr.includes('Solution A')) {
        judgePromptReceived = promptStr
        return 'Winner: Candidate 1\nVerdict: High precision modifications.'
      }

      // Candidate 1: modifies line 25
      const candLines = [...baseLines]
      candLines[24] = 'export const item_25 = 99999; // updated'
      return `Here is my updated data file:
\`\`\`javascript path="src/data.js"
${candLines.join('\n')}
\`\`\``
    }

    const progressMessages = []
    const result = await runMoAPipeline({
      userPrompt: 'Update item_25 in src/data.js to 99999',
      cwd: tmpDir,
      preset: {
        name: 'test-prune',
        context_pruning_enabled: true,
        context_pruning_diff_lines: 3,
        reference_models: [{ provider: 'test', model: 'cand-1' }],
        aggregator: { provider: 'test', model: 'judge-1' },
        curator_synthesis: true, // enforce Stage 7 synthesis
      },
      callLlm: mockCallLlm,
      onProgress: (msg) => progressMessages.push(msg),
      ctx: mockCtx,
    })

    assert.ok(result)
    assert.ok(result.kind === 'success' || result.kind === 'synthesis')

    // Verify context pruning event was emitted
    const pruneEvent = emittedEvents.find((e) => e.eventName === MOA_EVENTS.CONTEXT_PRUNING)
    assert.ok(pruneEvent, 'CONTEXT_PRUNING event should be emitted')
    assert.ok(pruneEvent.payload.savedTokens > 50)
    assert.ok(pruneEvent.payload.prunedFiles.includes('src/data.js'))

    // Verify progress message
    const pruneMsg = progressMessages.find((m) => m.includes('Context Pruning'))
    assert.ok(pruneMsg, 'Context Pruning progress message should be shown')

    // Verify Judge prompt received unified diff instead of full 50-line file
    assert.ok(judgePromptReceived.includes('```diff'))
    assert.ok(judgePromptReceived.includes('// Unified diff patch for src/data.js (context pruned)'))
    assert.ok(judgePromptReceived.includes('+export const item_25 = 99999; // updated'))
    assert.ok(!judgePromptReceived.includes('export const item_50 = 50;'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
