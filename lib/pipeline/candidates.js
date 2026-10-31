import { runReferencesParallel } from '../moa-candidates.js'
import { extractFileBlocks, writeCandidateWorkspace, cleanMoaWorkspaces } from '../workspace/fs.js'
import { verifyFileSyntax } from '../workspace/diff.js'
import { executeTestGateForCandidates } from '../moa-test-gate.js'
import { slotLabel } from '../moa-prompts.js'

export async function stageCandidateRound1({
  effectiveReferences,
  enrichedMessages,
  candidateSystemPrompt,
  refTemp,
  preset,
  maxTokens,
  prices,
  refTimeoutSec,
  isQuorumEnabled,
  gracePeriodSec,
  candidateRetries,
  signal,
  callLlm,
  onProgress,
  cwd,
  runId,
  startTime,
  primaryJudge,
  isRefinement,
  isFastMode,
  collectedCtx,
  testGateEnabled,
  testCommand,
  execFn,
}) {
  const referenceOutputs = await runReferencesParallel(
    effectiveReferences,
    enrichedMessages,
    {
      systemPrompt: candidateSystemPrompt,
      temperature: refTemp,
      temperature_gradient_enabled: Boolean(preset?.temperature_gradient_enabled),
      local_fallback_enabled: Boolean(preset?.local_fallback_enabled),
      local_fallback_models: preset?.local_fallback_models || [],
      maxTokens,
      prices,
      timeoutSec: refTimeoutSec,
      quorumEnabled: isQuorumEnabled,
      gracePeriodSec,
      maxRetries: candidateRetries,
      signal,
    },
    callLlm,
    onProgress
  )

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { ok: false, abort: true, error: new Error('Turn aborted') }
  }

  const successfulRefs = referenceOutputs.filter((r) => r.ok)
  if (successfulRefs.length === 0) {
    const reasons = referenceOutputs.map((r) => `${r.label}: ${r.error || 'unknown error'}`).join('; ')
    const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0)
    const totalCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0)).toFixed(5))
    const failurePayload = {
      kind: 'failure', content: `⚠️ All advisor models (${referenceOutputs.length}) failed: ${reasons}`,
      aggregator: slotLabel(primaryJudge), references: referenceOutputs, presetName: preset?.name || 'default',
      isRefinement, isFastMode, winningIndex: 0, winnerModel: 'none', promotedFiles: [],
      usage: { totalTokens, totalCostUsd, candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })), aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 } },
      skippedFiles: collectedCtx?.skippedFiles || 0, skippedList: collectedCtx?.skippedList || [], durationMs: Date.now() - startTime,
    }
    return { ok: false, failurePayload }
  }

  for (let i = 0; i < referenceOutputs.length; i++) {
    const ref = referenceOutputs[i]
    if (!ref.ok) continue
    const files = extractFileBlocks(ref.text)
    ref.files = files
    if (files.length > 0) {
      ref.syntaxWarning = (verifyFileSyntax(files) || []).map((w) => `${w.file}: ${w.error}`).join('; ')
      await writeCandidateWorkspace(cwd, i + 1, files, { runId })
    }
  }

  if (signal?.aborted) {
    await cleanMoaWorkspaces(cwd, { runId })
    return { ok: false, abort: true, error: new Error('Turn aborted') }
  }

  await executeTestGateForCandidates({
    cwd,
    referenceOutputs,
    preset,
    options: { testGateEnabled, testCommand, execFn, runId },
    onProgress,
  })

  return { ok: true, referenceOutputs, successfulRefs }
}
