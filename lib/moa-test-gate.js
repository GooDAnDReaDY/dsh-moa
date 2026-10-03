import os from 'node:os'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { resolveCandidateFolder } from './file-workspace.js'
import { bestEffort } from './best-effort.js'

const MAX_CAPTURE_BYTES = 256 * 1024

/**
 * Returns a sanitized environment stripping sensitive tokens and secrets (#161).
 */
export function getScrubbedEnv(overrides = {}) {
  const safeVars = new Set([
    'PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TEMP', 'TMP',
    'USER', 'LOGNAME', 'HOME', 'SHELL', 'TERM', 'NODE_ENV', 'SYSTEMROOT',
    'WINDIR', 'COMSPEC', 'PATHEXT',
  ])
  const scrubbed = {}
  for (const [key, val] of Object.entries(process.env)) {
    if (!val || key.startsWith('MOA_')) continue
    if (/(API_KEY|TOKEN|SECRET|PASSWORD|PASSWD|AUTH|CREDENTIAL|PRIVATE|KEY|ACCESS)/i.test(key)) {
      continue
    }
    if (safeVars.has(key) || key.startsWith('LC_')) {
      scrubbed[key] = val
    }
  }
  return { ...scrubbed, ...overrides }
}

/**
 * Resolves the directory for candidate sandbox.
 */
export function resolveCandidateDir(baseDir, candidateIndex, options = {}) {
  if (!baseDir || candidateIndex === null || candidateIndex === undefined) return null
  try {
    return resolveCandidateFolder(baseDir, candidateIndex, options).candidateDir
  } catch {
    return null
  }
}

/**
 * Executes a test command in a candidate sandbox or ephemeral test staging directory.
 */
export async function runCandidateTestGate({
  cwd,
  candidateIndex,
  testCommand,
  timeoutMs = 15000,
  maxOutputChars = 2000,
  execFn = null,
  runId = null,
}) {
  if (!cwd || !testCommand || typeof testCommand !== 'string') return null
  const trimmedCmd = testCommand.trim()
  if (!trimmedCmd) return null

  const candidateDir = resolveCandidateDir(cwd, candidateIndex, { runId })
  if (!candidateDir || !fsSync.existsSync(candidateDir)) return null

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
          return parts[0] !== 'node_modules' && parts[0] !== '.git' && parts[0] !== '.moa'
        },
      })

      // #162: Preserve ESM & CJS resolution by symlinking project node_modules
      const baseNodeModules = path.join(cwd, 'node_modules')
      const stageNodeModules = path.join(stageDir, 'node_modules')
      if (fsSync.existsSync(baseNodeModules)) {
        await bestEffort('symlink node_modules in test stage', () =>
          fs.symlink(baseNodeModules, stageNodeModules, process.platform === 'win32' ? 'junction' : 'dir')
        )
      }

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
      const env = getScrubbedEnv({
        MOA_CANDIDATE_INDEX: String(candidateIndex),
        MOA_CANDIDATE_DIR: candidateDir,
        MOA_BASE_DIR: cwd,
        ...(runId ? { MOA_RUN_ID: String(runId) } : {}),
        NODE_PATH: process.env.NODE_PATH ? `${nodePath}:${process.env.NODE_PATH}` : nodePath,
      })

      const runPromise = new Promise((resolve) => {
        let child
        let timeoutHandle = null
        let killEscalateHandle = null

        try {
          child = spawn(resolvedCmd, {
            cwd: executionDir,
            shell: true,
            detached: process.platform !== 'win32',
            env,
          })
        } catch (spawnErr) {
          resolve({ exitCode: 1, stdout: '', stderr: spawnErr.message || String(spawnErr) })
          return
        }

        const outChunks = []
        const errChunks = []
        let capturedBytes = 0

        child.stdout?.on('data', (d) => {
          if (capturedBytes < MAX_CAPTURE_BYTES) {
            outChunks.push(d)
            capturedBytes += d.length
          }
        })
        child.stderr?.on('data', (d) => {
          if (capturedBytes < MAX_CAPTURE_BYTES) {
            errChunks.push(d)
            capturedBytes += d.length
          }
        })

        const killChild = (sig = 'SIGTERM') => {
          if (!child || !child.pid) return
          bestEffort('test-gate kill child process group', () => {
            if (process.platform !== 'win32') {
              process.kill(-child.pid, sig)
            } else {
              child.kill(sig)
            }
          })
        }

        if (timeoutMs > 0) {
          timeoutHandle = setTimeout(() => {
            killChild('SIGTERM')
            killEscalateHandle = setTimeout(() => {
              killChild('SIGKILL')
            }, 1000)
          }, timeoutMs)
        }

        child.on('error', (err) => {
          if (timeoutHandle) clearTimeout(timeoutHandle)
          if (killEscalateHandle) clearTimeout(killEscalateHandle)
          resolve({ exitCode: 1, stdout: Buffer.concat(outChunks).toString('utf8'), stderr: err.message || String(err) })
        })

        child.on('close', (code, sig) => {
          if (timeoutHandle) clearTimeout(timeoutHandle)
          if (killEscalateHandle) clearTimeout(killEscalateHandle)
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
    const summary = passed ? `PASS (${durationMs}ms)` : `FAIL (code ${exitCode}, ${durationMs}ms)`

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
  if (!isEnabled || !testCmd || !cwd) return []

  const timeoutMs = (preset.test_gate_timeout_sec || 15) * 1000
  const maxOutputChars = preset.test_gate_max_output_chars || 2000
  const runId = options.runId || preset.runId

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
      runId,
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
