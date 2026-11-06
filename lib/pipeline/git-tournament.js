/**
 * Multi-Branch Git Sandbox Tournament (#304)
 *
 * For complex refactoring or bug-fixing tasks, executes candidate code proposals
 * in isolated, temporary Git worktrees and runs real project tests (e.g. npm test, pytest, cargo test).
 * Candidates passing 100% of tests (exitCode === 0) receive an empirical tournament advantage.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'
import { logger } from '../logger.js'
import { emitEvent, MOA_EVENTS } from '../events.js'
import { extractFileBlocks } from '../workspace/fs.js'

const execFileAsync = promisify(execFile)

/**
 * Checks if a directory is inside a valid git repository.
 * @param {string} cwd
 * @param {Function} [execFn=execFileAsync]
 * @returns {Promise<boolean>}
 */
export async function isGitRepository(cwd = process.cwd(), execFn = execFileAsync) {
  try {
    const res = await execFn('git', ['rev-parse', '--is-inside-work-tree'], { cwd, timeout: 5000 })
    return String(res.stdout || '').trim() === 'true'
  } catch {
    return false
  }
}

/**
 * Safely runs a command in a child process with timeout and sandboxing.
 * @param {string} command
 * @param {string} cwd
 * @param {number} timeoutMs
 * @param {Function} [execFn=execFileAsync]
 * @returns {Promise<{ exitCode: number, passed: boolean, output: string, durationMs: number }>}
 */
export async function executeTestInSandbox(command = 'npm test', cwd = process.cwd(), timeoutMs = 30000, execFn = execFileAsync) {
  const startTime = Date.now()
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
  const shellFlag = process.platform === 'win32' ? '/c' : '-c'

  try {
    const res = await execFn(shell, [shellFlag, command], {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, CI: 'true', NODE_ENV: 'test' },
    })
    const durationMs = Date.now() - startTime
    const output = `${res.stdout || ''}\n${res.stderr || ''}`.trim()
    return { exitCode: 0, passed: true, output, durationMs }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const exitCode = typeof err.code === 'number' ? err.code : 1
    const output = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.trim()
    return { exitCode, passed: false, output, durationMs }
  }
}

/**
 * Executes a single candidate proposal in an isolated Git worktree.
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function executeCandidateInWorktree({
  candidate,
  cwd = process.cwd(),
  testCommand = 'npm test',
  timeoutMs = 30000,
  runId = 'moa-tourn',
  execFn = execFileAsync,
}) {
  const candIndex = candidate.index ?? 1
  const branchName = `moa-tourn-${runId}-${candIndex}`
  const worktreeDir = path.join(cwd, '.moa', 'tourn', `cand-${candIndex}`)

  let worktreeCreated = false
  let testResult = null

  try {
    await fs.mkdir(path.dirname(worktreeDir), { recursive: true })

    // 1. Create temporary worktree
    await execFn('git', ['worktree', 'add', '-b', branchName, worktreeDir, 'HEAD'], { cwd, timeout: 10000 })
    worktreeCreated = true

    // 2. Write candidate file modifications into the worktree
    const files = candidate.files?.length > 0 ? candidate.files : extractFileBlocks(candidate.text || '')
    for (const f of files) {
      if (!f.relativePath || !f.content) continue
      const targetPath = path.join(worktreeDir, f.relativePath)
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.writeFile(targetPath, f.content, 'utf8')
    }

    // 3. Execute tests
    testResult = await executeTestInSandbox(testCommand, worktreeDir, timeoutMs, execFn)
  } catch (err) {
    logger.warn(`[dsh-moa] Git tournament failed for candidate ${candIndex}:`, err?.message || err)
    testResult = {
      exitCode: 1,
      passed: false,
      output: `Worktree setup failure: ${err?.message || err}`,
      durationMs: 0,
    }
  } finally {
    // 4. Safely remove worktree and temporary branch
    if (worktreeCreated) {
      try {
        await execFn('git', ['worktree', 'remove', worktreeDir, '--force'], { cwd, timeout: 10000 })
      } catch (rmErr) {
        logger.warn(`[dsh-moa] Failed to remove worktree ${worktreeDir}:`, rmErr?.message || rmErr)
      }
      try {
        await execFn('git', ['branch', '-D', branchName], { cwd, timeout: 5000 })
      } catch (_bErr) {
        // branch cleanup is best-effort
      }
    }
  }

  return {
    candidateIndex: candIndex,
    label: candidate.label || `Candidate ${candIndex}`,
    testResult,
  }
}

/**
 * Formats tournament results into a Judge arbitration directive.
 * @param {Array<object>} results
 * @param {string} testCommand
 * @returns {string}
 */
export function formatTournamentDirective(results = [], testCommand = 'npm test') {
  if (!Array.isArray(results) || results.length === 0) return ''

  const lines = []
  lines.push('=== 🏆 MULTI-BRANCH GIT SANDBOX TOURNAMENT REPORT ===')
  lines.push(`All candidate code implementations were executed in isolated Git worktrees against \`${testCommand}\`:`)

  for (const r of results) {
    const res = r.testResult || {}
    const statusIcon = res.passed ? '✅ PASSED' : '❌ FAILED'
    lines.push(`- ${r.label}: ${statusIcon} (Exit code: ${res.exitCode}, Duration: ${res.durationMs || 0}ms)`)
    if (!res.passed && res.output) {
      const trimmedOutput = res.output.split('\n').slice(-5).join(' ').slice(0, 150)
      lines.push(`  Failure summary: ${trimmedOutput}`)
    }
  }

  lines.push('\nCRITICAL JUDGE ARBITRATION DIRECTIVE:')
  lines.push('1. An implementation passing 100% of real project tests (PASSED) is empirical ground truth and MUST be strongly favored.')
  lines.push('2. If you choose a candidate whose tests FAILED due to superior architectural style, you MUST explicitly identify and repair the failing test/logic in your final synthesized code.')
  lines.push('=====================================================')

  return lines.join('\n')
}

/**
 * Orchestrates Git sandbox tournament for candidate proposals (#304).
 * @param {object} params
 * @returns {Promise<{ ok: boolean, tournamentResults: Array<object>, tournamentDirective: string, hasPassed: boolean }>}
 */
export async function runGitTournamentGate({
  candidates = [],
  preset = {},
  cwd = process.cwd(),
  runId = 'moa-tourn',
  signal = null,
  onProgress = null,
  ctx = null,
  execFn = execFileAsync,
}) {
  const enabled = Boolean(preset?.git_tournament_enabled || preset?.gitTournamentEnabled)
  if (!enabled || candidates.length === 0) {
    return { ok: true, tournamentResults: [], tournamentDirective: '', hasPassed: false }
  }

  const inGit = await isGitRepository(cwd, execFn)
  if (!inGit) {
    logger.warn('[dsh-moa] Git tournament skipped: current working directory is not a Git repository')
    return { ok: true, tournamentResults: [], tournamentDirective: '', hasPassed: false }
  }

  const testCommand = preset?.git_tournament_command || preset?.gitTournamentCommand || 'npm test'
  const timeoutSec = preset?.git_tournament_timeout_sec || preset?.gitTournamentTimeoutSec || 30
  const timeoutMs = timeoutSec * 1000

  if (typeof onProgress === 'function') {
    onProgress(`🏆 *Git Tournament: Testing candidates in isolated Git worktrees against "${testCommand}"...*\n`)
  }

  const results = []
  for (const cand of candidates) {
    if (signal?.aborted) break
    const res = await executeCandidateInWorktree({
      candidate: cand,
      cwd,
      testCommand,
      timeoutMs,
      runId,
      execFn,
    })
    results.push(res)
    cand.tournamentResult = res.testResult
  }

  const hasPassed = results.some((r) => r.testResult?.passed)
  const tournamentDirective = formatTournamentDirective(results, testCommand)

  emitEvent(ctx, MOA_EVENTS.TOURNAMENT_COMPLETE, {
    runId,
    totalCandidates: candidates.length,
    passedCount: results.filter((r) => r.testResult?.passed).length,
    testCommand,
    results,
  })

  return {
    ok: true,
    tournamentResults: results,
    tournamentDirective,
    hasPassed,
  }
}
