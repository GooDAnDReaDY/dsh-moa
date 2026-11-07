import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { stageProjectContext } from '../lib/pipeline/context.js'
import { stagePromotion } from '../lib/pipeline/promotion.js'

describe('Issues #321 & #322 - Pipeline Integration Tests', () => {
  it('stageProjectContext injects ecosystem context and knowledge into candidateSystemPrompt', async () => {
    const tmpKnowledge = path.join(os.tmpdir(), `moa-pipe-know-${Date.now()}.json`)
    fs.writeFileSync(
      tmpKnowledge,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'k-1',
            prompt: 'Refactor user authentication auth token',
            winnerModel: 'claude-3-7-sonnet',
            winningApproach: 'Use asymmetric RSA256 signature verification',
            rules: ['Key rotation every 90 days'],
          },
        ],
      }),
      'utf-8'
    )

    try {
      const stageRes = await stageProjectContext({
        userPrompt: 'Refactor user auth service token verification',
        preset: {
          enable_ecosystem_context: true,
          knowledge_path: tmpKnowledge,
        },
        cwd: process.cwd(),
      })

      assert.strictEqual(stageRes.ok, true)
      assert.ok(stageRes.ecosystemContext)
      assert.ok(stageRes.consensusKnowledge)
      assert.strictEqual(stageRes.consensusKnowledge.count, 1)
      assert.ok(stageRes.candidateSystemPrompt.includes('asymmetric RSA256 signature verification'))
      assert.ok(stageRes.candidateSystemPrompt.includes('Key rotation every 90 days'))
    } finally {
      if (fs.existsSync(tmpKnowledge)) fs.unlinkSync(tmpKnowledge)
    }
  })

  it('stagePromotion records consensus decision into knowledge file', async () => {
    const tmpKnowledge = path.join(os.tmpdir(), `moa-promo-know-${Date.now()}.json`)
    try {
      const promoRes = await stagePromotion({
        synthesizedText: '### Consensus Decision\nImplemented OAuth2 PKCE flow for mobile clients.',
        referenceOutputs: [
          { label: 'Candidate 1', text: 'Implementation 1' },
          { label: 'Candidate 2', text: 'Implementation 2' },
        ],
        successfulRefs: [{ label: 'Candidate 1' }, { label: 'Candidate 2' }],
        multiJudgeResult: { summary: 'Selected Candidate 1 for PKCE compliance' },
        isCuratorSynthesis: false,
        allowCandidateOverride: false,
        promoteOpts: { dryRun: true },
        cwd: process.cwd(),
        runId: 'promo-run-99',
        signal: null,
        liveCanvas: null,
        startTime: Date.now() - 1000,
        chosenJudge: { provider: 'test', model: 'test-agg' },
        aggUsage: { totalTokens: 50, costUsd: 0 },
        userPrompt: 'Implement OAuth2 mobile login',
        preset: {
          name: 'default',
          report_generation_enabled: false,
          interactive_workbench_enabled: false,
          knowledge_path: tmpKnowledge,
          sync_with_memory_brain: false,
        },
        isRefinement: false,
        isFastMode: false,
        effectiveReferences: [{ provider: 'p1', model: 'm1' }],
        referenceModels: [{ provider: 'p1', model: 'm1' }],
        collectedCtx: null,
        ctx: null,
        callLlm: async () => '',
      })

      assert.strictEqual(promoRes.ok, true)
      assert.ok(fs.existsSync(tmpKnowledge))
      const saved = JSON.parse(fs.readFileSync(tmpKnowledge, 'utf-8'))
      assert.strictEqual(saved.entries.length, 1)
      assert.strictEqual(saved.entries[0].id, 'promo-run-99')
      assert.ok(saved.entries[0].winningApproach.includes('OAuth2 PKCE flow'))
    } finally {
      if (fs.existsSync(tmpKnowledge)) fs.unlinkSync(tmpKnowledge)
    }
  })
})
