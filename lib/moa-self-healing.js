/**
 * Self-Healing Post-Promotion Build Loop with dsh-time-machine Auto-Rollback (#252)
 * Executes verification command after file promotion, dispatches compiler/test error logs
 * to the MoA aggregator for hotfix generation up to maxRetries times, and automatically
 * rolls back to the pre-promotion dsh-time-machine snapshot if verification still fails.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import { logger } from './logger.js'
import { bestEffort } from './best-effort.js'
import { extractFileBlocks } from './workspace/fs.js'
import { isSafeRelativePath, assertPathContained, isLoopbackUrl } from './workspace/security.js'

const execFileAsync = promisify(execFile)

/**
 * Runs a verification command in the target workspace.
 *
 * @param {string} cwd
 * @param {string} commandStr
 * @param {object} [options]
 * @returns {Promise<{ passed: boolean, exitCode: number, output: string }>}
 */
export async function runVerificationCommand(cwd, commandStr = 'npm test', options = {}) {
  if (typeof options.execFn === 'function') {
    return await options.execFn(cwd, commandStr)
  }

  const trimmed = String(commandStr || 'npm test').trim()
  const isWin = process.platform === 'win32'
  const shell = isWin ? 'cmd.exe' : '/bin/sh'
  const shellArgs = isWin ? ['/d', '/s', '/c', trimmed] : ['-c', trimmed]

  try {
    const { stdout, stderr } = await execFileAsync(shell, shellArgs, {
      cwd,
      timeout: (options.timeoutSec ?? 60) * 1000,
      maxBuffer: 4 * 1024 * 1024,
      signal: options.signal,
    })
    return {
      passed: true,
      exitCode: 0,
      output: `${stdout || ''}\n${stderr || ''}`.trim(),
    }
  } catch (err) {
    const out = `${err?.stdout || ''}\n${err?.stderr || ''}\n${err?.message || ''}`.trim()
    return {
      passed: false,
      exitCode: typeof err?.code === 'number' ? err.code : 1,
      output: out.slice(0, 12000),
    }
  }
}

/**
 * Triggers an automatic rollback to a pre-promotion dsh-time-machine snapshot.
 *
 * @param {string} baseDir
 * @param {object} snapshot
 * @param {object} [options]
 * @returns {Promise<{ rolledBack: boolean, snapshotId: string | null }>}
 */
export async function rollbackToTimeMachineSnapshot(baseDir, snapshot, options = {}) {
  const snapshotId = typeof snapshot === 'string'
    ? snapshot
    : (snapshot?.id || snapshot?.snapshotId || snapshot?.commit || snapshot?.hash || null)

  if (typeof options.rollbackFn === 'function') {
    const res = await bestEffort('custom rollbackFn', () => options.rollbackFn(baseDir, snapshotId, snapshot))
    return { rolledBack: Boolean(res), snapshotId }
  }

  if (options.timeMachineEngine) {
    const fn = options.timeMachineEngine.restoreSnapshot || options.timeMachineEngine.rollback
    if (typeof fn === 'function') {
      const res = await bestEffort('dsh-time-machine direct restoreSnapshot', () =>
        fn.call(options.timeMachineEngine, snapshotId, { cwd: baseDir })
      )
      if (res) return { rolledBack: true, snapshotId }
    }
  }

  const port = options.port || options.webServerPort || process.env.DSH_PORT || process.env.PORT
  if (!port && !options.timeMachineRollbackUrl) {
    logger.warn('[dsh-moa:self-healing] Cannot rollback: webServerPort is unknown and no timeMachineEngine/rollbackFn provided')
    return { rolledBack: false, snapshotId }
  }

  const endpoint = options.timeMachineRollbackUrl || `http://127.0.0.1:${port}/dsh-time-machine/restore`
  if (!isLoopbackUrl(endpoint)) {
    logger.warn(`[dsh-moa:self-healing] Blocked non-loopback rollback URL: ${endpoint}`)
    return { rolledBack: false, snapshotId }
  }

  const restored = await bestEffort('dsh-time-machine HTTP rollback', async () => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: snapshotId, snapshotId, cwd: baseDir }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      redirect: 'error',
    })
    return res.ok
  })

  return { rolledBack: Boolean(restored), snapshotId }
}

/**
 * Applies extracted hotfix files directly to the workspace directory.
 */
async function applyHotfixFiles(cwd, files = []) {
  const written = []
  for (const f of files) {
    const rel = f.relativePath || f.path
    if (!rel || !isSafeRelativePath(rel)) continue
    const targetPath = assertPathContained(cwd, rel)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, f.content, 'utf8')
    written.push(rel)
  }
  return written
}

/**
 * Runs the post-promotion self-healing build loop.
 *
 * @param {object} params
 * @returns {Promise<{
 *   enabled: boolean,
 *   passed: boolean,
 *   attempts: number,
 *   rolledBack: boolean,
 *   snapshotId: string | null,
 *   hotfixFiles: string[],
 *   lastOutput: string
 * }>}
 */
export async function runSelfHealingLoop({
  cwd,
  command = 'npm test',
  maxRetries = 2,
  aggregatorSlot,
  callLlm,
  userPrompt = '',
  promotedFiles = [],
  checkpoint = null,
  promoteOpts = {},
  onProgress = null,
  signal = null,
  execFn = null,
  rollbackFn = null,
}) {
  const retries = Math.max(0, Math.min(5, Number(maxRetries ?? 2)))
  const hotfixFiles = new Set()

  if (typeof onProgress === 'function') {
    onProgress(`🩺 *Self-Healing Verification: Running \`${command}\`...*\n`)
  }

  let check = await runVerificationCommand(cwd, command, { execFn, signal })
  if (check.passed) {
    return {
      enabled: true,
      passed: true,
      attempts: 0,
      rolledBack: false,
      snapshotId: null,
      hotfixFiles: [],
      lastOutput: check.output,
    }
  }

  let attempts = 0
  while (!check.passed && attempts < retries) {
    if (signal?.aborted) break
    attempts++

    if (typeof onProgress === 'function') {
      onProgress(`🔧 *Self-Healing Attempt ${attempts}/${retries}: Requesting hotfix patch from aggregator...*\n`)
    }

    const fileList = Array.isArray(promotedFiles)
      ? promotedFiles.map((f) => (typeof f === 'string' ? f : f.relativePath || f.path)).filter(Boolean)
      : []

    const hotfixPrompt = [
      `The promoted MoA changes failed the verification command \`${command}\` (exit code ${check.exitCode}).`,
      `Original User Task: ${userPrompt}`,
      `Promoted Files: ${fileList.join(', ') || 'workspace files'}`,
      `\n### Compiler / Test Failure Output:\n\`\`\`\n${check.output}\n\`\`\``,
      `\nProvide a minimal hotfix patch using markdown code blocks with \`path=<relative/path>\` header so the build and tests pass.`,
    ].join('\n')

    const llmRes = await callLlm({
      provider: aggregatorSlot?.provider || 'default',
      model: aggregatorSlot?.model || 'default',
      messages: [
        {
          role: 'system',
          content: 'You are an expert automated build healer. Fix compilation or unit test errors by outputting complete corrected files with ```lang path=relative/path.ext fences.',
        },
        { role: 'user', content: hotfixPrompt },
      ],
      temperature: 0.2,
      maxTokens: 4096,
      signal,
    })

    const patchText = typeof llmRes === 'string' ? llmRes : (llmRes?.content || llmRes?.text || '')
    const extracted = extractFileBlocks(patchText)
    if (extracted.length > 0) {
      const applied = await applyHotfixFiles(cwd, extracted)
      for (const f of applied) hotfixFiles.add(f)
    }

    check = await runVerificationCommand(cwd, command, { execFn, signal })
    if (check.passed) {
      if (typeof onProgress === 'function') {
        onProgress(`✅ *Self-Healing Succeeded on attempt ${attempts}/${retries}!*\n`)
      }
      return {
        enabled: true,
        passed: true,
        attempts,
        rolledBack: false,
        snapshotId: null,
        hotfixFiles: [...hotfixFiles],
        lastOutput: check.output,
      }
    }
  }

  // Verification still failed after maxRetries -> unconditional Time Machine rollback
  const snapshotObj = checkpoint || promoteOpts?.checkpointSnapshot || (Array.isArray(promotedFiles) && promotedFiles._checkpoint) || null
  if (typeof onProgress === 'function') {
    onProgress(`⏪ *Self-Healing exhausted (${attempts}/${retries}). Rolling back workspace via dsh-time-machine...*\n`)
  }

  const rb = await rollbackToTimeMachineSnapshot(cwd, snapshotObj, {
    ...promoteOpts,
    rollbackFn,
  })

  return {
    enabled: true,
    passed: false,
    attempts,
    rolledBack: rb.rolledBack,
    snapshotId: rb.snapshotId,
    hotfixFiles: [...hotfixFiles],
    lastOutput: check.output,
  }
}
