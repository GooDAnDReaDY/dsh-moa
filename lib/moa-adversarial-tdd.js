/**
 * Adversarial TDD Loop with Auto-Generated Unit Test Gate (#246)
 * Generates an autonomous unit test suite (covering edge cases, nullability, and security bounds)
 * from the user prompt via a Red-Team / Test Engineer model, injects the generated test files
 * into each candidate's isolated workspace, executes them via moa-test-gate.js, and formats
 * an objective pass/fail verification report for the Judge panel.
 */

import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { logger } from './logger.js'
import { slotLabel } from './moa-prompts.js'
import { extractFileBlocks } from './workspace/fs.js'
import { isSafeRelativePath, assertPathContained } from './workspace/security.js'
import { resolveCandidateDir, runCandidateTestGate } from './moa-test-gate.js'

export const RED_TEAM_TDD_SYSTEM_PROMPT = `You are an Adversarial Red-Team Test Engineer for a Mixture-of-Agents coding pipeline.
Given the user's coding prompt and any existing file signatures, generate a self-contained Node.js unit test file using \`node:test\` and \`node:assert/strict\`.
Rules:
1. Output the test file inside a markdown fence with \`path=__moa_adversarial.test.mjs\`.
2. Include edge-case assertions (empty inputs, null/undefined handling, boundary values, and security/injection guards).
3. Ensure the test file is syntactically valid ES module code that exits with 0 when all assertions pass and non-zero on failure.`

/**
 * Generates an adversarial unit test suite from the user prompt.
 *
 * @param {object} params
 * @returns {Promise<{ testFiles: Array<{ relativePath: string, content: string }>, testCommand: string, generatorModel: string }>}
 */
export async function generateAdversarialTestSuite({
  userPrompt = '',
  referenceOutputs = [],
  redTeamSlot = null,
  callLlm,
  signal = null,
}) {
  if (typeof callLlm !== 'function') {
    return { testFiles: [], testCommand: '', generatorModel: 'none' }
  }

  // Pick a dedicated Red-Team / Test Engineer slot
  const chosenSlot = (redTeamSlot?.provider && redTeamSlot?.model)
    ? redTeamSlot
    : (referenceOutputs.find((r) => r?.slot?.role_persona === 'tester')?.slot || referenceOutputs[0]?.slot || { provider: 'default', model: 'default' })

  const sampleFiles = []
  for (const ref of referenceOutputs) {
    if (!ref?.ok || !Array.isArray(ref.files)) continue
    for (const f of ref.files) {
      const rel = f.relativePath || f.path
      if (rel && !sampleFiles.includes(rel)) sampleFiles.push(rel)
    }
  }

  const userMsg = [
    `### User Task Specification:\n${userPrompt}`,
    sampleFiles.length > 0 ? `\n### Target Candidate Files to Test:\n${sampleFiles.map((f) => `- \`${f}\``).join('\n')}` : '',
    `\nGenerate the adversarial unit test file with \`\`\`js path=__moa_adversarial.test.mjs.`,
  ].filter(Boolean).join('\n')

  try {
    const res = await callLlm({
      provider: chosenSlot.provider,
      model: chosenSlot.model,
      messages: [
        { role: 'system', content: RED_TEAM_TDD_SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.2,
      maxTokens: 2048,
      signal,
    })

    const rawText = typeof res === 'string' ? res : (res?.content || res?.text || '')
    let files = extractFileBlocks(rawText).filter((f) =>
      /\.(test|spec)\.(mjs|js|cjs|ts)$/i.test(f.relativePath || '') || (f.relativePath || '').includes('adversarial')
    )

    if (files.length === 0) {
      const codeMatch = /```(?:js|javascript|mjs)\r?\n([\s\S]*?)```/i.exec(rawText)
      if (codeMatch && codeMatch[1].trim()) {
        files = [{ relativePath: '__moa_adversarial.test.mjs', content: codeMatch[1].trim() + '\n' }]
      }
    }

    if (files.length === 0) {
      return { testFiles: [], testCommand: '', generatorModel: slotLabel(chosenSlot) }
    }

    const primaryTestFile = files[0].relativePath
    return {
      testFiles: files,
      testCommand: `node --test ${primaryTestFile}`,
      generatorModel: slotLabel(chosenSlot),
    }
  } catch (err) {
    logger.warn('[dsh-moa:adversarial-tdd] Failed to generate adversarial unit tests:', err?.message || err)
    return { testFiles: [], testCommand: '', generatorModel: slotLabel(chosenSlot) }
  }
}

/**
 * Runs the Adversarial TDD Loop across all candidate workspaces and attaches results.
 *
 * @param {object} params
 * @returns {Promise<{
 *   executed: boolean,
 *   generatorModel: string,
 *   testCommand: string,
 *   testFiles: string[],
 *   results: Array<{ candidateIndex: number, label: string, passed: boolean, exitCode: number, summary: string }>,
 *   directive: string
 * }>}
 */
export async function runAdversarialTddLoop({
  cwd,
  runId,
  userPrompt = '',
  referenceOutputs = [],
  preset = {},
  callLlm,
  execFn = null,
  onProgress = null,
  signal = null,
}) {
  const candidatesWithFiles = (referenceOutputs || []).filter((r) => r.ok && Array.isArray(r.files) && r.files.length > 0)
  if (candidatesWithFiles.length === 0) {
    return { executed: false, generatorModel: 'none', testCommand: '', testFiles: [], results: [], directive: '' }
  }

  if (typeof onProgress === 'function') {
    onProgress('🛡️ *Adversarial TDD Loop: Generating Red-Team unit test suite from prompt...*\n')
  }

  const suite = await generateAdversarialTestSuite({
    userPrompt,
    referenceOutputs: candidatesWithFiles,
    redTeamSlot: preset?.aggregator,
    callLlm,
    signal,
  })

  if (suite.testFiles.length === 0 || !suite.testCommand) {
    return { executed: false, generatorModel: suite.generatorModel, testCommand: '', testFiles: [], results: [], directive: '' }
  }

  if (typeof onProgress === 'function') {
    onProgress(`🧪 *Adversarial TDD Loop: Executing \`${suite.testCommand}\` against ${candidatesWithFiles.length} candidate workspace(s)...*\n`)
  }

  const timeoutMs = (typeof preset?.test_gate_timeout_sec === 'number' && preset.test_gate_timeout_sec > 0
    ? preset.test_gate_timeout_sec
    : 15) * 1000

  const results = []
  for (let i = 0; i < referenceOutputs.length; i++) {
    const ref = referenceOutputs[i]
    if (!ref.ok || !Array.isArray(ref.files) || ref.files.length === 0) continue
    const candIdx = ref.index ?? (i + 1)
    const candDir = resolveCandidateDir(cwd, candIdx, { runId })
    if (!candDir || !fsSync.existsSync(candDir)) continue

    // Materialize generated adversarial test files inside the candidate sandbox
    for (const tf of suite.testFiles) {
      if (!isSafeRelativePath(tf.relativePath)) continue
      const dest = assertPathContained(candDir, tf.relativePath)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.writeFile(dest, tf.content, 'utf8')
    }

    const gateRes = await runCandidateTestGate({
      cwd,
      candidateIndex: candIdx,
      testCommand: suite.testCommand,
      timeoutMs,
      execFn,
      runId,
    })

    // Remove temporary adversarial test files from candidate workspace so they don't get promoted unintentionally
    for (const tf of suite.testFiles) {
      if (!isSafeRelativePath(tf.relativePath)) continue
      try {
        const dest = assertPathContained(candDir, tf.relativePath)
        await fs.rm(dest, { force: true })
      } catch (err) {
        logger.debug('[dsh-moa:tdd] cleanup test file error:', err?.message || err)
      }
    }

    if (gateRes) {
      ref.testResult = gateRes
      results.push({
        candidateIndex: candIdx,
        label: ref.label || `Candidate ${candIdx}`,
        passed: Boolean(gateRes.passed),
        exitCode: gateRes.exitCode ?? (gateRes.passed ? 0 : 1),
        summary: gateRes.summary || (gateRes.passed ? 'PASSED' : 'FAILED'),
      })
    }
  }

  const reportLines = [
    `### 🛡️ Adversarial TDD Verification Report (Generated by Red-Team \`${suite.generatorModel}\`):`,
    `Command executed in isolated sandbox: \`${suite.testCommand}\``,
    ...results.map(
      (r) => `- **Candidate #${r.candidateIndex} (${r.label})**: **${r.passed ? 'PASSED ✅' : `FAILED ❌ (exit ${r.exitCode})`}** — ${r.summary}`
    ),
    'Strongly favor candidates that pass the adversarial Red-Team unit test suite.',
  ]

  return {
    executed: results.length > 0,
    generatorModel: suite.generatorModel,
    testCommand: suite.testCommand,
    testFiles: suite.testFiles.map((f) => f.relativePath),
    results,
    directive: results.length > 0 ? reportLines.join('\n') : '',
  }
}

