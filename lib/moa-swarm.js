/**
 * MoA-to-Subagents Swarm with Isolated Git Worktrees (#255)
 * Provisions isolated git worktrees (or workspace sandboxes) per candidate,
 * dispatches autonomous subagent/candidate execution, collects git diffs,
 * and guarantees worktree cleanup in finally blocks.
 */

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { logger } from './logger.js'
import { slotLabel } from './moa-prompts.js'
import { extractFileBlocks } from './workspace/fs.js'

const execFileAsync = promisify(execFile)

/**
 * Checks if a directory is inside a valid git repository.
 */
export async function isGitRepository(cwd) {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, timeout: 5000 })
    return stdout.trim() === 'true'
  } catch {
    return false
  }
}

/**
 * Creates an isolated git worktree (or directory sandbox if not a git repo) for a swarm candidate.
 *
 * @param {string} cwd
 * @param {string} runId
 * @param {number} candidateIndex
 * @returns {Promise<{ worktreePath: string, branchName: string, isGitWorktree: boolean }>}
 */
export async function createSwarmWorktree(cwd, runId, candidateIndex) {
  const safeRunId = String(runId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '')
  const worktreePath = path.join(cwd, '.moa', `swarm-${safeRunId}`, `candidate-${candidateIndex}`)
  const branchName = `moa-swarm/${safeRunId}/cand-${candidateIndex}`

  await fs.mkdir(path.dirname(worktreePath), { recursive: true })

  if (await isGitRepository(cwd)) {
    try {
      await execFileAsync('git', ['worktree', 'add', '--detach', worktreePath, 'HEAD'], { cwd, timeout: 10000 })
      return { worktreePath, branchName, isGitWorktree: true }
    } catch (err) {
      logger.warn(`[dsh-moa] git worktree add failed for candidate-${candidateIndex}, using isolated directory sandbox: ${err?.message || err}`)
    }
  }

  await fs.mkdir(worktreePath, { recursive: true })
  return { worktreePath, branchName, isGitWorktree: false }
}

/**
 * Collects git diff and modified files from a candidate's swarm worktree.
 *
 * @param {string} worktreePath
 * @param {boolean} isGitWorktree
 * @returns {Promise<{ diffText: string, modifiedFiles: string[] }>}
 */
export async function collectSwarmWorktreeDiff(worktreePath, isGitWorktree = false) {
  if (!existsSync(worktreePath)) {
    return { diffText: '', modifiedFiles: [] }
  }

  if (isGitWorktree) {
    try {
      const { stdout: statusOut } = await execFileAsync('git', ['status', '--porcelain'], { cwd: worktreePath, timeout: 5000 })
      const modifiedFiles = statusOut
        .split('\n')
        .map((line) => line.slice(3).trim())
        .filter(Boolean)

      const { stdout: diffOut } = await execFileAsync('git', ['diff', 'HEAD'], { cwd: worktreePath, timeout: 5000 })
      return { diffText: diffOut.trim(), modifiedFiles }
    } catch {
      // Fallback to directory scan
    }
  }

  const modifiedFiles = []
  async function scanDir(dir, prefix = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name === '.git') continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await scanDir(full, rel)
      } else {
        modifiedFiles.push(rel)
      }
    }
  }
  await scanDir(worktreePath)
  return { diffText: '', modifiedFiles }
}

/**
 * Guarantees removal of all swarm worktrees and temporary directories.
 *
 * @param {string} cwd
 * @param {string} runId
 * @param {Array<{ worktreePath: string, isGitWorktree: boolean }>} worktrees
 */
export async function cleanupSwarmWorktrees(cwd, runId, worktrees = []) {
  for (const wt of worktrees) {
    if (!wt?.worktreePath) continue
    if (wt.isGitWorktree) {
      try {
        await execFileAsync('git', ['worktree', 'remove', '--force', wt.worktreePath], { cwd, timeout: 8000 })
      } catch (err) {
        logger.debug('[dsh-moa:swarm] cleanup worktree remove error:', err?.message || err)
      }
    }
    try {
      await fs.rm(wt.worktreePath, { recursive: true, force: true })
    } catch (err) {
      logger.debug('[dsh-moa:swarm] cleanup rm error:', err?.message || err)
    }
  }

  if (await isGitRepository(cwd)) {
    try {
      await execFileAsync('git', ['worktree', 'prune'], { cwd, timeout: 5000 })
    } catch (err) {
      logger.debug('[dsh-moa:swarm] cleanup prune error:', err?.message || err)
    }
  }

  const safeRunId = String(runId || '').replace(/[^a-zA-Z0-9_-]/g, '')
  if (safeRunId) {
    const swarmRoot = path.join(cwd, '.moa', `swarm-${safeRunId}`)
    try {
      await fs.rm(swarmRoot, { recursive: true, force: true })
    } catch (err) {
      logger.debug('[dsh-moa:swarm] cleanup swarmRoot error:', err?.message || err)
    }
  }
}

/**
 * Runs candidates as a swarm with isolated worktrees.
 * Uses ctx.subagent.run if available on Cordis context, falling back to callLlm + worktree materialization.
 */
export async function runSubagentSwarm(references, messages, options = {}, callLlm, onProgress) {
  const cwd = options.cwd || process.cwd()
  const runId = options.runId || `run-${Date.now()}`
  const worktrees = []

  try {
    if (typeof onProgress === 'function') {
      onProgress(`🐝 *Launching MoA Subagent Swarm across ${references.length} isolated worktrees...*\n`)
    }

    const tasks = references.map(async (slot, idx) => {
      const candidateIndex = idx + 1
      const label = slotLabel(slot)
      const wt = await createSwarmWorktree(cwd, runId, candidateIndex)
      worktrees.push(wt)

      const start = Date.now()
      let responseText = ''
      let usage = { inputTokens: 100, outputTokens: 100, totalTokens: 200, costUsd: 0 }

      if (options.ctx?.subagent && typeof options.ctx.subagent.run === 'function') {
        const subRes = await options.ctx.subagent.run({
          provider: slot.provider,
          model: slot.model,
          cwd: wt.worktreePath,
          messages,
          signal: options.signal,
        })
        responseText = typeof subRes === 'string' ? subRes : (subRes?.content || subRes?.text || '')
        if (subRes?.usage) usage = subRes.usage
      } else {
        const llmRes = await callLlm({
          provider: slot.provider,
          model: slot.model,
          messages,
          temperature: options.temperature ?? 0.6,
          maxTokens: options.maxTokens ?? 4096,
          signal: options.signal,
        })
        responseText = typeof llmRes === 'string' ? llmRes : (llmRes?.content || llmRes?.text || '')
        if (llmRes?.usage) usage = llmRes.usage
      }

      // Materialize any extracted file blocks inside the isolated worktree
      const files = extractFileBlocks(responseText)
      for (const f of files) {
        const targetFile = path.join(wt.worktreePath, f.relativePath || f.path || "")
        await fs.mkdir(path.dirname(targetFile), { recursive: true })
        await fs.writeFile(targetFile, f.content, 'utf8')
      }

      const diffInfo = await collectSwarmWorktreeDiff(wt.worktreePath, wt.isGitWorktree)
      const enrichedText = diffInfo.diffText
        ? `${responseText}\n\n#### Git Worktree Diff (${wt.branchName}):\n\`\`\`diff\n${diffInfo.diffText}\n\`\`\``
        : responseText

      return {
        index: candidateIndex,
        slot,
        label,
        text: enrichedText,
        files,
        swarmWorktree: wt.worktreePath,
        swarmBranch: wt.branchName,
        modifiedFiles: diffInfo.modifiedFiles,
        usage,
        costUsd: usage.costUsd || 0,
        durationMs: Date.now() - start,
        ok: true,
      }
    })

    return await Promise.all(tasks)
  } finally {
    await cleanupSwarmWorktrees(cwd, runId, worktrees)
  }
}

