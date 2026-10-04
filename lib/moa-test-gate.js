import os from 'node:os'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { resolveCandidateFolder } from './file-workspace.js'
import { bestEffort } from './best-effort.js'
import { logger } from './logger.js'

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
 * Validates that an executed script or command does not reference files outside allowed roots (#161).
 */
function scanPathTokensForLeak(text, allowedRoots, executionDir) {
  if (!text || typeof text !== 'string') return null
  const matches = text.match(/(?:(?:[a-zA-Z]:[\\/]|(?:\/[a-zA-Z0-9_\-\.]+)+)|(?:\.\.[\\/]+[a-zA-Z0-9_\-\.]+))/g) || []
  for (const raw of matches) {
    if (/^\/(usr\/(bin|lib|include)|bin|lib|lib64|etc|dev)(\/|$)/.test(raw) && !/\.(txt|json|env|npmrc|key|ssh|md)/i.test(raw)) {
      continue
    }
    const resolved = path.resolve(executionDir, raw)
    const allowed = allowedRoots.some((r) => r && (resolved === r || resolved.startsWith(r + path.sep)))
    if (!allowed) {
      return raw
    }
  }
  return null
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
  let fenceFile = null
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
      const allowedRoots = [executionDir, cwd, ...(candidateDir && candidateDir !== executionDir ? [candidateDir] : [])]
      const cmdTokens = resolvedCmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []

      // 1. Check command tokens for absolute path leaks
      for (const rawToken of cmdTokens) {
        const token = rawToken.replace(/^["']|["']$/g, '')
        const leaked = scanPathTokensForLeak(token, allowedRoots, executionDir)
        if (leaked) {
          const durationMs = Date.now() - startTime
          return {
            candidateIndex,
            passed: false,
            exitCode: 1,
            durationMs,
            command: resolvedCmd,
            output: `Access denied: test command specifies path outside workspace sandbox (${leaked})`,
            summary: `FAIL (code 1, ${durationMs}ms)`,
          }
        }
      }

      // 2. Scan script files referenced by command or present in candidate workspace (#161)
      const scriptTokens = cmdTokens
        .map((t) => t.replace(/^["']|["']$/g, ''))
        .filter((t) => /\.(sh|bash|zsh|py|rb|pl)$/i.test(t) || (!path.isAbsolute(t) && fsSync.existsSync(path.join(executionDir, t))))

      for (const scriptName of scriptTokens) {
        const scriptPath = path.isAbsolute(scriptName) ? scriptName : path.join(executionDir, scriptName)
        if (fsSync.existsSync(scriptPath) && !fsSync.statSync(scriptPath).isDirectory()) {
          try {
            const scriptText = fsSync.readFileSync(scriptPath, 'utf8')
            const leaked = scanPathTokensForLeak(scriptText, allowedRoots, executionDir)
            if (leaked) {
              const durationMs = Date.now() - startTime
              return {
                candidateIndex,
                passed: false,
                exitCode: 1,
                durationMs,
                command: resolvedCmd,
                output: `Access denied: test script specifies path outside workspace sandbox (${leaked})`,
                summary: `FAIL (code 1, ${durationMs}ms)`,
              }
            }
          } catch {}
        }
      }

      // 3. Scan package.json scripts if package.json exists in executionDir (#161, #206)
      const candPkgFile = path.join(executionDir, 'package.json')
      if (fsSync.existsSync(candPkgFile)) {
        try {
          const pkgObj = JSON.parse(fsSync.readFileSync(candPkgFile, 'utf8'))
          const scriptsContent = Object.values(pkgObj.scripts || {}).join('\n')
          const leaked = scanPathTokensForLeak(scriptsContent, allowedRoots, executionDir)
          if (leaked) {
            const durationMs = Date.now() - startTime
            return {
              candidateIndex,
              passed: false,
              exitCode: 1,
              durationMs,
              command: resolvedCmd,
              output: `Access denied: package.json test script specifies path outside workspace sandbox (${leaked})`,
              summary: `FAIL (code 1, ${durationMs}ms)`,
            }
          }
        } catch {}
      }

      // Setup isolated HOME & node roots
      const rawHome = process.env.HOME
      const isCustomHome = rawHome && (rawHome.startsWith(cwd) || rawHome.startsWith(executionDir) || rawHome.includes('fake-home') || rawHome.startsWith(os.tmpdir()))
      let effectiveHome = isCustomHome ? rawHome : path.join(executionDir, '.moa-home')
      if (!fsSync.existsSync(effectiveHome)) {
        await bestEffort('create candidate test home', () => fs.mkdir(effectiveHome, { recursive: true }))
      }

      const nodeRoot = path.resolve(path.dirname(process.execPath), '..')
      const nodeBinDir = path.dirname(process.execPath)
      const allowedReads = [
        executionDir,
        cwd,
        effectiveHome,
        ...(candidateDir && candidateDir !== executionDir ? [candidateDir] : []),
        nodeRoot,
        nodeBinDir,
        ...(process.platform === 'win32'
          ? [process.env.SYSTEMROOT || 'C:\\Windows']
          : ['/usr', '/lib', '/lib64', '/etc']),
      ].filter(Boolean)

      // Create security fence module for child process containment (#161, #206)
      fenceFile = path.join(executionDir, `.moa-fence-${Date.now()}.cjs`)
      const fenceCode = `
const cp = require('node:child_process');
const path = require('node:path');
const allowed = ${JSON.stringify(allowedReads)};
function checkPath(p) {
  if (!p || typeof p !== 'string') return true;
  if (/^\\/(usr\\/(bin|lib|include)|bin|lib|lib64|etc|dev)(\\/|$)/.test(p) && !/\\.(txt|json|env|npmrc|key|ssh|md)/i.test(p)) return true;
  const res = path.resolve(process.cwd(), p);
  return allowed.some(root => root && (res === root || res.startsWith(root + path.sep)));
}
function guardArgs(cmd, args) {
  if (Array.isArray(args)) {
    for (const a of args) {
      if (!checkPath(a)) throw new Error('ERR_ACCESS_DENIED: child process argument outside sandbox: ' + a);
    }
  }
}
const origSpawn = cp.spawn;
cp.spawn = function(cmd, args, opts) {
  guardArgs(cmd, args);
  return origSpawn.apply(this, arguments);
};
const origExecFile = cp.execFile;
cp.execFile = function(file, args, opts, cb) {
  guardArgs(file, args);
  return origExecFile.apply(this, arguments);
};
const origExecFileSync = cp.execFileSync;
cp.execFileSync = function(file, args, opts) {
  guardArgs(file, args);
  return origExecFileSync.apply(this, arguments);
};
`
      fsSync.writeFileSync(fenceFile, fenceCode, 'utf8')

      const permOpts = `--permission ${allowedReads.map((p) => `--allow-fs-read=${p}`).join(' ')} --allow-fs-write=${executionDir} --allow-fs-write=${effectiveHome} --allow-child-process --require ${fenceFile}`
      const nodePath = path.join(cwd, 'node_modules')
      const env = getScrubbedEnv({
        HOME: effectiveHome,
        MOA_CANDIDATE_INDEX: String(candidateIndex),
        MOA_CANDIDATE_DIR: candidateDir,
        MOA_BASE_DIR: cwd,
        ...(runId ? { MOA_RUN_ID: String(runId) } : {}),
        NODE_PATH: process.env.NODE_PATH ? `${nodePath}:${process.env.NODE_PATH}` : nodePath,
        NODE_OPTIONS: process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ${permOpts}` : permOpts,
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
    if (fenceFile) {
      await bestEffort('moa-test-gate cleanup fenceFile', () => fs.rm(fenceFile, { force: true }))
    }
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
