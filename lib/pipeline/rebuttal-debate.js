/**
 * Multi-Round Rebuttal Debate between Candidates (#298)
 *
 * Implements multi-round cross-examination and rebuttal discussion between candidate models
 * before final arbitration by the Judge. Candidates anonymize and analyze peer solutions,
 * identify flaws, security edge-cases, and hallucinations, and refine their own answers.
 * The structured debate protocol is then passed to the Judge for weighted arbitration.
 */

import { logger } from '../logger.js'
import { callWithTransientRetry } from '../moa-candidates.js'
import { extractFileBlocks, writeCandidateWorkspace } from '../workspace/fs.js'
import { verifyFileSyntax } from '../workspace/diff.js'
import { estimateTokenCost } from '../pricing.js'
import { emitEvent, MOA_EVENTS } from '../events.js'

/**
 * Builds the rebuttal prompt for a candidate in a given debate round.
 * @param {object} params
 * @returns {string}
 */
export function buildRebuttalPrompt({
  userPrompt,
  candidateText,
  opponentAnswers,
  roundNumber = 1,
  totalRounds = 1,
  isBlind = true,
}) {
  const opponentsFormatted = opponentAnswers
    .map((op, idx) => {
      const label = op.label || `Candidate ${idx + 1}`
      const persona = op.role_persona ? ` [Persona: ${op.role_persona}]` : ''
      return `### ⚔️ Peer Solution [${label}]${persona}:\n${op.text}`
    })
    .join('\n\n')

  return `You are an expert software engineer participating in a rigorous Multi-Agent Consilium Rebuttal Debate (Round ${roundNumber} of ${totalRounds}).
Your objective is to stress-test peer solutions, expose bugs, logical vulnerabilities, and hallucinations, and defend and refine your own solution.

=== ORIGINAL USER REQUEST ===
${userPrompt}

=== YOUR PREVIOUS PROPOSAL ===
${candidateText}

=== ALTERNATIVE PEER SOLUTIONS ===
${opponentsFormatted}

=== REBUTTAL DEBATE INSTRUCTIONS ===
Analyze the peer solutions with uncompromising technical rigor.
Structure your response EXACTLY into these three labeled sections:

### CRITIQUE OF PEERS
For each peer candidate, cite concrete issues:
- Identify logic bugs, off-by-one errors, uncaught exceptions, or security holes.
- Highlight missing edge cases or unhandled failure states.
- Point out inaccurate assumptions or hallucinations.

### REBUTTAL & DEFENSE
- Address the potential weaknesses or tradeoffs in your own approach.
- Explain why your architectural or algorithmic choices are superior or more maintainable.

### REFINED SOLUTION
- Provide your complete, improved, and final solution incorporating valid insights from the debate.
- Output complete code without placeholders or omissions.`
}

/**
 * Parses structured rebuttal debate output from a model response.
 * @param {string} rawText
 * @returns {{ critiqueText: string, defenseText: string, refinedText: string }}
 */
export function parseRebuttalResponse(rawText = '') {
  if (typeof rawText !== 'string') {
    return { critiqueText: '', defenseText: '', refinedText: '' }
  }

  let critiqueText = ''
  let defenseText = ''
  let refinedText = rawText

  const critiqueMatch = rawText.match(/### CRITIQUE OF PEERS\s*([\s\S]*?)(?=### REBUTTAL & DEFENSE|### REFINED SOLUTION|$)/i)
  if (critiqueMatch) {
    critiqueText = critiqueMatch[1].trim()
  }

  const defenseMatch = rawText.match(/### REBUTTAL & DEFENSE\s*([\s\S]*?)(?=### REFINED SOLUTION|$)/i)
  if (defenseMatch) {
    defenseText = defenseMatch[1].trim()
  }

  const refinedMatch = rawText.match(/### REFINED SOLUTION\s*([\s\S]*)$/i)
  if (refinedMatch && refinedMatch[1].trim().length > 50) {
    refinedText = refinedMatch[1].trim()
  }

  return {
    critiqueText,
    defenseText,
    refinedText,
  }
}

/**
 * Executes a single round of rebuttal debate across all active candidates.
 * @param {object} params
 * @returns {Promise<{ round: number, critiques: Array<object>, updatedCandidates: Array<object> }>}
 */
export async function executeDebateRound({
  candidates = [],
  userPrompt = '',
  roundNumber = 1,
  totalRounds = 1,
  isBlindEvaluation = true,
  callLlm,
  refTemp = 0.5,
  maxTokens = 4096,
  refTimeoutSec = 60,
  candidateRetries = 2,
  prices = {},
  signal = null,
  onProgress = null,
  cwd = process.cwd(),
  runId = '',
  ctx = null,
}) {
  if (typeof onProgress === 'function') {
    onProgress(`🗣️ *Rebuttal Debate Round ${roundNumber}/${totalRounds}: Candidates cross-examining peer solutions in parallel...*\n`)
  }

  const roundCritiques = []

  const debatePromises = candidates.map(async (cand) => {
    const opponents = candidates
      .filter((c) => c.index !== cand.index)
      .map((c) => ({
        index: c.index,
        label: isBlindEvaluation ? `Candidate ${c.index}` : c.label,
        role_persona: c.role_persona || c.slot?.role_persona,
        text: c.text,
      }))

    const rebuttalPrompt = buildRebuttalPrompt({
      userPrompt,
      candidateText: cand.text,
      opponentAnswers: opponents,
      roundNumber,
      totalRounds,
      isBlind: isBlindEvaluation,
    })

    const slot = cand.slot || { provider: cand.provider, model: cand.model }

    try {
      const res = await callWithTransientRetry(
        callLlm,
        {
          provider: slot.provider,
          model: slot.model,
          messages: [{ role: 'user', content: rebuttalPrompt }],
          temperature: refTemp,
          maxTokens,
          timeoutMs: refTimeoutSec * 1000,
          signal,
          onProgress,
        },
        candidateRetries
      )

      const parsed = parseRebuttalResponse(res.text)
      const costEst = estimateTokenCost({
        provider: slot.provider,
        model: slot.model,
        inputTokens: res.usage?.inputTokens || 0,
        outputTokens: res.usage?.outputTokens || 0,
        cacheHitTokens: res.usage?.cacheHitTokens || 0,
        prices,
      })

      const newFiles = extractFileBlocks(parsed.refinedText)
      if (newFiles.length > 0) {
        await writeCandidateWorkspace(cwd, cand.index, newFiles, { runId })
      }

      const syntaxValidation = verifyFileSyntax(newFiles)

      const critiqueRecord = {
        candidateIndex: cand.index,
        candidateLabel: isBlindEvaluation ? `Candidate ${cand.index}` : cand.label,
        critique: parsed.critiqueText,
        defense: parsed.defenseText,
      }
      roundCritiques.push(critiqueRecord)

      return {
        ...cand,
        text: parsed.refinedText,
        files: newFiles.length > 0 ? newFiles : cand.files,
        syntaxValidation: syntaxValidation.valid ? syntaxValidation : cand.syntaxValidation,
        usage: {
          inputTokens: (cand.usage?.inputTokens || 0) + (res.usage?.inputTokens || 0),
          outputTokens: (cand.usage?.outputTokens || 0) + (res.usage?.outputTokens || 0),
          totalTokens: (cand.usage?.totalTokens || 0) + (res.usage?.totalTokens || 0),
        },
        costUsd: Number(((cand.costUsd || 0) + (costEst?.costUsd || 0)).toFixed(5)),
        lastDebateCritique: parsed.critiqueText,
        lastDebateDefense: parsed.defenseText,
      }
    } catch (err) {
      logger.warn(`[dsh-moa] Candidate ${cand.index} rebuttal debate round ${roundNumber} failed:`, err?.message || err)
      return cand
    }
  })

  const updatedCandidates = await Promise.all(debatePromises)

  emitEvent(ctx, MOA_EVENTS.DEBATE_ROUND, {
    runId,
    roundNumber,
    totalRounds,
    critiquesCount: roundCritiques.length,
    activeCandidates: updatedCandidates.length,
  })

  return {
    round: roundNumber,
    critiques: roundCritiques,
    updatedCandidates,
  }
}

/**
 * Formats accumulated debate protocol into a clean markdown directive for the Judge.
 * @param {Array<object>} debateRounds
 * @returns {string}
 */
export function formatDebateDirective(debateRounds = []) {
  if (!Array.isArray(debateRounds) || debateRounds.length === 0) return ''

  const sections = []
  sections.push('=== ⚔️ MULTI-ROUND REBUTTAL DEBATE PROTOCOL ===')
  sections.push('The candidate models engaged in peer cross-examination prior to arbitration.')
  sections.push('CRITICAL JUDGE DIRECTIVE: Heavily weight valid vulnerabilities or bugs identified by peers.')

  for (const r of debateRounds) {
    sections.push(`\n--- Debate Round ${r.round} ---`)
    for (const c of r.critiques || []) {
      if (c.critique) {
        sections.push(`[${c.candidateLabel}] Critiques of peers:\n${c.critique}`)
      }
      if (c.defense) {
        sections.push(`[${c.candidateLabel}] Defense & Justification:\n${c.defense}`)
      }
    }
  }

  sections.push('\n==============================================')
  return sections.join('\n')
}

/**
 * Orchestrates multi-round rebuttal debate phase (#298).
 * @param {object} params
 * @returns {Promise<{ ok: boolean, updatedCandidates: Array<object>, debateDirective: string, totalCritiques: number, rounds: Array<object> }>}
 */
export async function runRebuttalDebatePhase({
  candidates = [],
  userPrompt = '',
  preset = {},
  prices = {},
  maxTokens = 4096,
  isBlindEvaluation = true,
  callLlm,
  signal = null,
  onProgress = null,
  cwd = process.cwd(),
  runId = '',
  ctx = null,
}) {
  const enabled = Boolean(preset?.rebuttal_debate_enabled || preset?.rebuttalDebateEnabled)
  if (!enabled || candidates.length < 2) {
    return {
      ok: true,
      updatedCandidates: candidates,
      debateDirective: '',
      totalCritiques: 0,
      rounds: [],
    }
  }

  const configuredRounds = preset?.rebuttal_rounds ?? preset?.rebuttalRounds ?? 1
  const totalRounds = Math.min(3, Math.max(1, Number(configuredRounds) || 1))

  let currentCandidates = [...candidates]
  const debateRounds = []

  for (let r = 1; r <= totalRounds; r++) {
    if (signal?.aborted) {
      break
    }

    const roundResult = await executeDebateRound({
      candidates: currentCandidates,
      userPrompt,
      roundNumber: r,
      totalRounds,
      isBlindEvaluation,
      callLlm,
      refTemp: preset?.reference_temperature ?? 0.5,
      maxTokens,
      refTimeoutSec: preset?.reference_timeout_sec ?? 60,
      prices,
      signal,
      onProgress,
      cwd,
      runId,
      ctx,
    })

    debateRounds.push(roundResult)
    currentCandidates = roundResult.updatedCandidates
  }

  const totalCritiques = debateRounds.reduce((acc, r) => acc + (r.critiques?.length || 0), 0)
  const debateDirective = formatDebateDirective(debateRounds)

  return {
    ok: true,
    updatedCandidates: currentCandidates,
    debateDirective,
    totalCritiques,
    rounds: debateRounds,
  }
}
