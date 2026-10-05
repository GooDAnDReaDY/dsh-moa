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

export function decodeEscapedStrings(str) {
  if (!str || typeof str !== 'string') return ''
  let res = str.replace(/\\+/g, '\\').replace(/\\(?:([0-7]{1,3})|x([0-9a-fA-F]{2}))/g, (m, oct, hex) =>
    oct ? String.fromCharCode(parseInt(oct, 8)) : hex ? String.fromCharCode(parseInt(hex, 16)) : m
  )
  return res.replace(/(?<![A-Za-z0-9+/=])(?:(?:[A-Za-z0-9+/]{4}){2,}|(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=))(?![A-Za-z0-9+/=])/g, (m) => {
    try {
      const dec = Buffer.from(m, 'base64').toString('utf8')
      return /^[\x20-\x7E\r\n\t]+$/.test(dec) ? dec : m
    } catch (err) {
      logger.debug('[dsh-moa:testGate] base64 decode skip:', err?.message || err)
      return m
    }
  })
}

const COMPUTED_SHELL_EVASION = /(?:base64\s+(?:-d|--decode|-D)[^|\n;]*\|\s*(?:ba|z|da)?sh|\beval\s+["\']?\$|\bxxd\s+-r[^|\n;]*\|\s*(?:ba|z|da)?sh|\bprintf\s+[^|\n]+\|\s*(?:ba|z|da)?sh|\bopenssl\s+enc\s+-d[^|\n;]*\|\s*(?:ba|z|da)?sh)/i

const UNIX_ROOT_PREFIX = /^\/(?:home|root|etc|var|tmp|opt|mnt|srv|media|proc|sys|dev|usr|bin|lib|lib64|run\/(?:user\/\d+|systemd|lock|credentials|secrets|udev|initramfs|mount|shm|dbus|sshd|motd)|sbin|boot|Users\/(?:[a-zA-Z0-9_\-.]+)|Applications|Library|System|Volumes|private)(?:\/|$)/

/**
 * Validates that an executed script or command does not reference files outside allowed roots (#161, #225).
 */
function scanPathTokensForLeak(text, allowedRoots, executionDir) {
  if (!text || typeof text !== 'string') return null
  const checkText = (t) => {
    const sanitized = t.replace(/https?:\/\/[^\s"'<>]+/gi, '').replace(/\b(?:node|file|npm|data):[^\s"'<>]+/gi, '')
    const matches = sanitized.match(/(?:[a-zA-Z]:[\\/][^\s"'<>]+|(?<![\w.@\/\\])\/(?:[a-zA-Z0-9_\-.]+\/)*[a-zA-Z0-9_\-.]+|(?<![\w.@\/\\])\.\.[\\/][^\s"'<>]*)/g) || []
    for (const raw of matches) {
      if (/^\/(usr\/(bin|lib|include)|bin|lib|lib64|etc|dev)(\/|$)/.test(raw) && !/\.(txt|json|env|npmrc|key|ssh|md)/i.test(raw)) continue
      const isAbs = path.isAbsolute(raw)
      if ((!isAbs && !raw.startsWith('..')) || (isAbs && process.platform !== 'win32' && !UNIX_ROOT_PREFIX.test(raw))) continue
      const resolved = path.resolve(executionDir, raw)
      if (!allowedRoots.some((r) => r && (resolved === r || resolved.startsWith(r + path.sep)))) return raw
    }
    return null
  }
  const rawLeak = checkText(text)
  if (rawLeak) return rawLeak
  const decoded = decodeEscapedStrings(text)
  return decoded !== text ? checkText(decoded) : null
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

    const replacePlaceholderSafely = (cmd, placeholder, dirPath) => {
      if (!cmd.includes(placeholder)) return cmd
      let res = cmd.replace(new RegExp(`(["'])(.*?)${placeholder}(.*?)\\1`, 'g'), (m, q, pre, post) => `${q}${pre}${dirPath}${post}${q}`)
      res = res.replace(new RegExp(`(?<=^|\\s)([^\\s"']*?)${placeholder}([^\\s"']*?)(?=\\s|$)`, 'g'), (m, pre, post) => {
        const full = pre + dirPath + post
        return full.includes(' ') ? `"${full}"` : full
      })
      return res
    }

    let resolvedCmd = trimmedCmd
    resolvedCmd = replacePlaceholderSafely(resolvedCmd, '{candidateDir}', candidateDir)
    resolvedCmd = replacePlaceholderSafely(resolvedCmd, '{baseDir}', cwd)
    resolvedCmd = replacePlaceholderSafely(resolvedCmd, '{stageDir}', executionDir)

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
        if (path.isAbsolute(token) || token.startsWith('..')) {
          if (/^\/(usr\/(bin|lib|include)|bin|lib|lib64|etc|dev)(\/|$)/.test(token) && !/\.(txt|json|env|npmrc|key|ssh|md)/i.test(token)) {
            continue
          }
          const resolved = path.resolve(executionDir, token)
          const allowed = allowedRoots.some((r) => r && (resolved === r || resolved.startsWith(r + path.sep)))
          if (!allowed) {
            const durationMs = Date.now() - startTime
            return {
              candidateIndex,
              passed: false,
              exitCode: 1,
              durationMs,
              command: resolvedCmd,
              output: `Access denied: test command specifies path outside workspace sandbox (${token})`,
              summary: `FAIL (code 1, ${durationMs}ms)`,
            }
          }
        }
      }

      // 2. Scan script files referenced by command or present in candidate workspace (#161)
      const candFiles = fsSync.existsSync(executionDir) ? fsSync.readdirSync(executionDir, { recursive: true }) : []
      const scriptTokens = new Set([
        ...cmdTokens.map((t) => t.replace(/^["']|["']$/g, '')),
        ...candFiles.map((f) => String(f)),
      ])

      for (const scriptName of scriptTokens) {
        const scriptPath = path.isAbsolute(scriptName) ? scriptName : path.join(executionDir, scriptName)
        if (fsSync.existsSync(scriptPath) && !fsSync.statSync(scriptPath).isDirectory()) {
          try {
            const scriptText = fsSync.readFileSync(scriptPath, 'utf8')
            if (COMPUTED_SHELL_EVASION.test(scriptText)) {
              const durationMs = Date.now() - startTime
              return {
                candidateIndex,
                passed: false,
                exitCode: 1,
                durationMs,
                command: resolvedCmd,
                output: 'Access denied: test script contains obfuscated or computed command execution',
                summary: `FAIL (code 1, ${durationMs}ms)`,
              }
            }
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
          } catch (scanErr) {
            logger.debug('[dsh-moa:testGate] candidate script read error:', scanErr?.message || scanErr)
          }
        }
      }

      // 3. Scan package.json scripts if package.json exists in executionDir (#161, #206)
      const candPkgFile = path.join(executionDir, 'package.json')
      if (fsSync.existsSync(candPkgFile)) {
        try {
          const pkgObj = JSON.parse(fsSync.readFileSync(candPkgFile, 'utf8'))
          const scriptsContent = Object.values(pkgObj.scripts || {}).join('\n')
          if (COMPUTED_SHELL_EVASION.test(scriptsContent)) {
            const durationMs = Date.now() - startTime
            return {
              candidateIndex,
              passed: false,
              exitCode: 1,
              durationMs,
              command: resolvedCmd,
              output: 'Access denied: package.json test script contains obfuscated or computed command execution',
              summary: `FAIL (code 1, ${durationMs}ms)`,
            }
          }
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
        } catch (pkgErr) {
          logger.debug('[dsh-moa:testGate] candidate package.json read error:', pkgErr?.message || pkgErr)
        }
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
        ...(process.env.NVM_DIR ? [process.env.NVM_DIR] : []),
        ...(nodeRoot.includes("/.nvm/") ? [path.resolve(nodeRoot, "../..")] : []),
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
function decodeEscaped(str) {
  if (!str || typeof str !== 'string') return '';
  const norm = str.split(/\\+/).join(String.fromCharCode(92));
  return norm.replace(new RegExp(String.fromCharCode(92, 92) + '(?:([0-7]{1,3})|x([0-9a-fA-F]{2}))', 'g'), (m, oct, hex) => {
    if (oct) return String.fromCharCode(parseInt(oct, 8));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
    return m;
  });
}
const COMPUTED_SHELL_EVASION = /(?:base64\\s+(?:-d|--decode|-D)[^|\\n;]*\\|\\s*(?:ba|z|da)?sh|\\beval\\s+["\']?\\$|\\bxxd\\s+-r[^|\\n;]*\\|\\s*(?:ba|z|da)?sh|\\bprintf\\s+[^|\\n]+\\|\\s*(?:ba|z|da)?sh|\\bopenssl\\s+enc\\s+-d[^|\\n;]*\\|\\s*(?:ba|z|da)?sh)/i;
const UNIX_ROOT_PREFIX = /^\\/(?:home|root|etc|var|tmp|opt|mnt|srv|media|proc|sys|dev|usr|bin|lib|lib64|run\\/(?:user\\/\\d+|systemd|lock|credentials|secrets|udev|initramfs|mount|shm|dbus|sshd|motd)|sbin|boot|Users\\/(?:[a-zA-Z0-9_\\-.]+)|Applications|Library|System|Volumes|private)(?:\\/|$)/;
function checkSinglePath(p) {
  if (!p || typeof p !== 'string') return true;
  if (/^\\/(usr\\/(bin|lib|include)|bin|lib|lib64|etc|dev)(\\/|$)/.test(p) && !/\\.(txt|json|env|npmrc|key|ssh|md)/i.test(p)) return true;
  const isAbs = path.isAbsolute(p);
  const isUp = p.startsWith('..');
  if (!isAbs && !isUp) return true;
  if (isAbs && process.platform !== 'win32' && !UNIX_ROOT_PREFIX.test(p)) return true;
  const res = path.resolve(process.cwd(), p);
  return allowed.some(root => root && (res === root || res.startsWith(root + path.sep)));
}
function scanStringForPaths(str) {
  if (!str || typeof str !== 'string') return true;
  if (!checkSinglePath(str)) return false;
  const dec = decodeEscaped(str);
  if (dec !== str && !checkSinglePath(dec)) return false;
  const matches = str.match(/(?:[a-zA-Z]:[\\\\/][^\\s"'<>]+|(?<![\\w.@/\\\\])\\/(?:[a-zA-Z0-9_\\-.]+\\/)*[a-zA-Z0-9_\\-.]+|(?<![\\w.@/\\\\])\\.\\.[\\\\/][^\\s"'<>]*)/g) || [];
  for (const m of matches) {
    if (!checkSinglePath(m)) return false;
  }
  if (dec !== str) {
    const decMatches = dec.match(/(?:[a-zA-Z]:[\\\\/][^\\s"'<>]+|(?<![\\w.@/\\\\])\\/(?:[a-zA-Z0-9_\\-.]+\\/)*[a-zA-Z0-9_\\-.]+|(?<![\\w.@/\\\\])\\.\\.[\\\\/][^\\s"'<>]*)/g) || [];
    for (const m of decMatches) {
      if (!checkSinglePath(m)) return false;
    }
  }
  return true;
}
function guardArgs(cmd, args) {
  const full = [cmd, ...(Array.isArray(args) ? args : [])].join(' ');
  if (COMPUTED_SHELL_EVASION.test(full)) {
    throw new Error('ERR_ACCESS_DENIED: child process computed execution pattern blocked: ' + full);
  }
  if (cmd && !scanStringForPaths(String(cmd))) {
    throw new Error('ERR_ACCESS_DENIED: child process command outside sandbox: ' + cmd);
  }
  if (Array.isArray(args)) {
    for (const a of args) {
      if (a && !scanStringForPaths(String(a))) {
        throw new Error('ERR_ACCESS_DENIED: child process argument outside sandbox: ' + a);
      }
    }
  }
}
const origSpawn = cp.spawn;
cp.spawn = function(cmd, args, opts) {
  guardArgs(cmd, args);
  return origSpawn.apply(this, arguments);
};
const origSpawnSync = cp.spawnSync;
cp.spawnSync = function(cmd, args, opts) {
  guardArgs(cmd, args);
  return origSpawnSync.apply(this, arguments);
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
const origExec = cp.exec;
cp.exec = function(cmd, opts, cb) {
  guardArgs(cmd, [cmd]);
  return origExec.apply(this, arguments);
};
const origExecSync = cp.execSync;
cp.execSync = function(cmd, opts) {
  guardArgs(cmd, [cmd]);
  return origExecSync.apply(this, arguments);
};
const fsMod = require('node:fs');
function guardFs(p, isWrite) {
  if (!p || typeof p !== 'string') return;
  const isAbs = path.isAbsolute(p);
  const isUp = p.startsWith('..');
  if (!isAbs && !isUp) return;
  const resolved = path.resolve(process.cwd(), p);
  const checkRoots = isWrite ? [process.cwd(), process.env.HOME].filter(Boolean) : allowed;
  const ok = checkRoots.some(r => r && (resolved === r || resolved.startsWith(r + path.sep)));
  if (!ok) throw new Error('ERR_ACCESS_DENIED: fs access outside sandbox: ' + p);
}
const origRF = fsMod.readFileSync; fsMod.readFileSync = function(p) { guardFs(p, false); return origRF.apply(this, arguments); };
const origWF = fsMod.writeFileSync; fsMod.writeFileSync = function(p) { guardFs(p, true); return origWF.apply(this, arguments); };
const origAF = fsMod.appendFileSync; fsMod.appendFileSync = function(p) { guardFs(p, true); return origAF.apply(this, arguments); };
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
