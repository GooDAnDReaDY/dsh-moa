import os from 'node:os'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { assertPathContained } from './file-workspace.js'
import { bestEffort } from './best-effort.js'

/**
 * Resolves the directory for candidate sandbox.
 */
export function resolveCandidateDir(baseDir, candidateIndex) {
  if (!baseDir || candidateIndex === null || candidateIndex === undefined) return null
  const targetStr = String(candidateIndex).trim()
  const sanitizedTarget = targetStr.replace(/[^a-zA-Z0-9_-]/g, '')
  const sub = /^\d+$/.test(sanitizedTarget) ? `candidate-${sanitizedTarget}` : (sanitizedTarget || 'candidate-1')
  const moaRoot = path.join(baseDir, '.moa')
  return assertPathContained(moaRoot, sub)
}

/**
 * Executes a test command in a candidate sandbox or ephemeral test staging directory.
 *
 * @param {object} params
 * @param {string} params.cwd - Project root workspace directory
 * @param {number|string} params.candidateIndex - Index of candidate (1, 2, ...)
 * @param {string} params.testCommand - Shell command to execute (e.g. "npm test", "node --test")
 * @param {number} [params.timeoutMs=15000] - Execution timeout in ms
 * @param {number} [params.maxOutputChars=2000] - Maximum captured output chars
 * @param {function} [params.execFn] - Optional mock/test runner function
 * @returns {Promise<object|null>} Test result object or null if skipped
 */
export async function runCandidateTestGate({
  cwd,
  candidateIndex,
  testCommand,
  timeoutMs = 15000,
  maxOutputChars = 2000,
  execFn = null,
}) {
  if (!cwd || !testCommand || typeof testCommand !== 'string') {
    return null
  }

  const trimmedCmd = testCommand.trim()
  if (!trimmedCmd) return null

  const candidateDir = resolveCandidateDir(cwd, candidateIndex)
  if (!candidateDir || !fsSync.existsSync(candidateDir)) {
    return null
  }

  const startTime = Date.now()
  let stageDir = null
  let executionDir = candidateDir

  try {
    const basePkg = path.join(cwd, 'package.json')
    const candPkg = path.join(candidateDir, 'package.json')
    if (fsSync.existsSync(basePkg) && !fsSync.existsSync(candPkg)) {
      stageDir = await fs.mkdtemp(path.join(os.tmpdir(), `moa-test-stage-${candidateIndex}-`))

      await fs.cp(cwd, stageDir, {
        recursive: true,
        filter: (src) => {
          const rel = path.relative(cwd, src)
          if (!rel) return true
          const parts = rel.split(path.sep)
          if (parts[0] === 'node_modules' || parts[0] === '.git' || parts[0] === '.moa') {
            return false
          }
          return true
        },
      })

      await fs.cp(candidateDir, stageDir, { recursive: true })
      executionDir = stageDir
    }

    const resolvedCmd = trimmedCmd
      .replaceAll('{candidateDir}', candidateDir)
      .replaceAll('{baseDir}', cwd)
      .replaceAll('{stageDir}', executionDir)

    let exitCode = 0
    let stdout = ''
    let stderr = ''

    if (typeof execFn === 'function') {
      const customRes = await execFn({
        cwd: executionDir,
        candidateDir,
        command: resolvedCmd,
        timeoutMs,
      })
      exitCode = customRes?.exitCode ?? (customRes?.passed ? 0 : 1)
      stdout = customRes?.stdout || ''
      stderr = customRes?.stderr || ''
    } else {
      const nodePath = path.join(cwd, 'node_modules')
      const env = {
        ...process.env,
        MOA_CANDIDATE_INDEX: String(candidateIndex),
        MOA_CANDIDATE_DIR: candidateDir,
        MOA_BASE_DIR: cwd,
        NODE_PATH: process.env.NODE_PATH ? `${nodePath}:${process.env.NODE_PATH}` : nodePath,
      }

      const runPromise = new Promise((resolve) => {
        let child
        try {
          child = spawn(resolvedCmd, {
            cwd: executionDir,
            shell: true,
            env,
            timeout: timeoutMs,
          })
        } catch (spawnErr) {
          resolve({ exitCode: 1, stdout: '', stderr: spawnErr.message || String(spawnErr) })
          return
        }

        const outChunks = []
        const errChunks = []

        child.stdout?.on('data', (d) => outChunks.push(d))
        child.stderr?.on('data', (d) => errChunks.push(d))

        child.on('error', (err) => {
          resolve({ exitCode: 1, stdout: Buffer.concat(outChunks).toString('utf8'), stderr: err.message || String(err) })
        })

        child.on('close', (code, sig) => {
          const combinedErr = Buffer.concat(errChunks).toString('utf8')
          const finalErr = sig ? `${combinedErr}\nProcess terminated by signal ${sig}`.trim() : combinedErr
          resolve({
            exitCode: code ?? (sig ? 128 : 1),
            stdout: Buffer.concat(outChunks).toString('utf8'),
            stderr: finalErr,
          })
        })
      })

      const execResult = await runPromise
      exitCode = execResult.exitCode
      stdout = execResult.stdout
      stderr = execResult.stderr
    }

    const durationMs = Date.now() - startTime
    const combinedOutput = [stdout, stderr].filter(Boolean).join('\n').trim()
    const truncatedOutput = combinedOutput.length > maxOutputChars
      ? `${combinedOutput.slice(0, maxOutputChars)}\n...[output truncated by Test Gate]`
      : combinedOutput

    const passed = exitCode === 0
    const summary = passed
      ? `PASS (${durationMs}ms)`
      : `FAIL (code ${exitCode}, ${durationMs}ms)`

    return {
      candidateIndex,
      passed,
      exitCode,
      durationMs,
      command: resolvedCmd,
      output: truncatedOutput,
      summary,
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    return {
      candidateIndex,
      passed: false,
      exitCode: 1,
      durationMs,
      command: trimmedCmd,
      output: `Test Gate Error: ${err.message || String(err)}`,
      summary: `ERROR (${err.message || 'unknown'})`,
    }
  } finally {
    if (stageDir) {
      await bestEffort('moa-test-gate cleanup stageDir', () =>
        fs.rm(stageDir, { recursive: true, force: true })
      )
    }
  }
}

/**
 * Runs Test Execution Gate across all successful candidates with generated files.
 */
export async function executeTestGateForCandidates({
  cwd,
  referenceOutputs = [],
  preset = {},
  options = {},
  onProgress = null,
}) {
  const isEnabled = Boolean(options.testGateEnabled ?? preset.test_gate_enabled)
  const testCmd = options.testCommand || preset.test_command
  if (!isEnabled || !testCmd || !cwd) {
    return []
  }

  const timeoutMs = (preset.test_gate_timeout_sec || 15) * 1000
  const maxOutputChars = preset.test_gate_max_output_chars || 2000

  if (typeof onProgress === 'function') {
    onProgress('🧪 *Test Execution Gate: Running test suite against candidate sandboxes...*\n')
  }

  const results = []
  for (const ref of referenceOutputs) {
    if (!ref.ok || !ref.files || ref.files.length === 0) continue

    const res = await runCandidateTestGate({
      cwd,
      candidateIndex: ref.index,
      testCommand: testCmd,
      timeoutMs,
      maxOutputChars,
      execFn: options.execFn,
    })

    if (res) {
      ref.testResult = res
      results.push(res)
      if (typeof onProgress === 'function') {
        const icon = res.passed ? '✅' : '❌'
        onProgress(`🧪 *Candidate ${ref.index}: ${icon} ${res.summary}*\n`)
      }
    }
  }

  return results
}