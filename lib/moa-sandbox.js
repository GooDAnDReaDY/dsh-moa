/**
 * DeepSeek Harness Mixture of Agents (MoA) — Test Gate OS & Node Sandbox (#260)
 *
 * Implements OS-level isolation probing, permission model flags,
 * fence module generation, environment sanitization, and evasion inspection.
 */

import cp from 'node:child_process'
import path from 'node:path'
import fsSync from 'node:fs'
import { logger } from './logger.js'

export const COMPUTED_SHELL_EVASION = /(?:base64\s+(?:-d|--decode|-D)[^|\n;]*\|\s*(?:ba|z|da)?sh|\beval\s+["']?\$|\bxxd\s+-r[^|\n;]*\|\s*(?:ba|z|da)?sh|\bprintf\s+[^|\n]+\|\s*(?:ba|z|da)?sh|\bopenssl\s+enc\s+-d[^|\n;]*\|\s*(?:ba|z|da)?sh|\bprintf\s+(?:%s|["']%s["'])\s+.*["'](?:\/|mnt|home|tmp|etc|var|usr|root|opt)["']|\$\(\s*(?:printf|echo)\s+.*["'](?:\/|mnt|home|tmp|etc|var|usr|root|opt)["']|\x60\s*(?:printf|echo)\s+.*["'](?:\/|mnt|home|tmp|etc|var|usr|root|opt)["']|\b(?:cat|head|tail|source|\.|touch|rm|cp|mv)\s+["']?\$[A-Za-z_]|>\s*["']?\$[A-Za-z_]|>>\s*["']?\$[A-Za-z_])/i

export const NODE_OPTIONS_EVASION = /(?:\benv\b[^|;\n]*(?:-[^\s]*u\s*NODE_OPTIONS|--unset=NODE_OPTIONS)|\bunset\s+NODE_OPTIONS|\bexport\s+NODE_OPTIONS\s*=|\bNODE_OPTIONS\s*=)/i

export const DANGEROUS_BINARIES = /\b(?:sudo|su|bwrap|chroot|systemd-run)\b/i

export const UNIX_ROOT_PREFIX = /^\/(?:home|root|etc|var|tmp|opt|mnt|srv|media|proc|sys|dev|usr|bin|lib|lib64|run\/(?:user\/\d+|systemd|lock|credentials|secrets|udev|initramfs|mount|shm|dbus|sshd|motd)|sbin|boot|Users\/(?:[a-zA-Z0-9_\-.]+)|Applications|Library|System|Volumes|private)(?:\/|$)/

export const SAFE_SYS_DIRS = /^\/(?:usr\/(?:bin|lib|include)|bin|lib|lib64|etc|dev)(?:\/|$)/

export const SENSITIVE_EXTS = /\.(?:txt|json|env|npmrc|key|ssh|md)/i

export const PATH_TOKEN_REGEX = /(?:[a-zA-Z]:[\\/][^\s"'<>]+|(?<![\w.@/\\])\/(?:[a-zA-Z0-9_\-.]+\/)*[a-zA-Z0-9_\-.]+|(?<![\w.@/\\])\.\.[\\/][^\s"'<>]*)/g

export const OCTAL_HEX_ESCAPE = /\\(?:([0-7]{1,3})|x([0-9a-fA-F]{2}))/g

let cachedOsSandbox = null

/**
 * Checks whether OS-level unprivileged sandbox (bubblewrap) is fully operational (#260).
 */
export function isOsSandboxAvailable() {
  if (cachedOsSandbox !== null) return cachedOsSandbox
  if (process.platform !== 'linux') {
    cachedOsSandbox = false
    return false
  }
  try {
    const probe = cp.spawnSync(
      'bwrap',
      ['--ro-bind', '/usr', '/usr', '--proc', '/proc', '--dev', '/dev', '--', 'true'],
      { timeout: 2000, stdio: 'ignore' }
    )
    cachedOsSandbox = probe.status === 0
  } catch (probeErr) {
    logger.debug('[dsh-moa:sandbox] OS sandbox probe error:', probeErr?.message || probeErr)
    cachedOsSandbox = false
  }
  return cachedOsSandbox
}

/**
 * Resolves package manager runner commands (e.g. `npm test`) to direct script invocations
 * to allow execution under Node permission model without requiring --allow-child-process (#260).
 */
export function resolveTestCommand({ testCommand, executionDir }) {
  if (!testCommand || typeof testCommand !== 'string') return ''
  const trimmed = testCommand.trim()
  const npmMatch = trimmed.match(/^(?:npm\s+(?:run\s+)?test|npm\s+t|pnpm\s+(?:run\s+)?test|pnpm\s+t|yarn\s+test)(?:\s+--?\s*(.*))?$/i)
  if (npmMatch && executionDir) {
    const candPkgFile = path.join(executionDir, 'package.json')
    if (fsSync.existsSync(candPkgFile)) {
      try {
        const pkgObj = JSON.parse(fsSync.readFileSync(candPkgFile, 'utf8'))
        const scriptCmd = pkgObj.scripts?.test
        if (scriptCmd && typeof scriptCmd === 'string') {
          const extraArgs = npmMatch[1] ? ` ${npmMatch[1]}` : ''
          return scriptCmd.trim() + extraArgs
        }
      } catch (pkgErr) {
        logger.debug('[dsh-moa:sandbox] package.json parse error in resolveTestCommand:', pkgErr?.message || pkgErr)
      }
    }
  }
  return trimmed
}

/**
 * Inspects a command or script string for obfuscation or security environment evasion (#161, #260).
 */
export function isSandboxEvasion(text) {
  if (!text || typeof text !== 'string') return null
  if (COMPUTED_SHELL_EVASION.test(text)) {
    return 'obfuscated or computed command execution'
  }
  if (NODE_OPTIONS_EVASION.test(text)) {
    return 'attempts to bypass sandbox or strip security environment (NODE_OPTIONS)'
  }
  if (DANGEROUS_BINARIES.test(text)) {
    return 'unauthorized privileged or sandbox-escape binary execution'
  }
  return null
}

/**
 * Decodes octal and hex escape sequences in strings.
 */
export function decodeEscapedStrings(str) {
  if (!str || typeof str !== 'string') return ''
  const normalized = str.split(/\\+/).join('\\')
  return normalized.replace(OCTAL_HEX_ESCAPE, (m, oct, hex) => {
    if (oct) return String.fromCharCode(parseInt(oct, 8))
    if (hex) return String.fromCharCode(parseInt(hex, 16))
    return m
  })
}

/**
 * Validates that an executed script or command does not reference files outside allowed roots (#161, #225, #260).
 */
export function scanPathTokensForLeak(text, allowedRoots, executionDir) {
  if (!text || typeof text !== 'string') return null
  const checkText = (t) => {
    const sanitized = t.replace(/https?:\/\/[^\s"'<>]+/gi, '').replace(/\b(?:node|file|npm|data):[^\s"'<>]+/gi, '')
    const matches = sanitized.match(PATH_TOKEN_REGEX) || []
    for (const raw of matches) {
      if (SAFE_SYS_DIRS.test(raw) && !SENSITIVE_EXTS.test(raw)) continue
      const isAbs = path.isAbsolute(raw)
      if ((!isAbs && !raw.startsWith('..')) || (isAbs && process.platform !== 'win32' && !UNIX_ROOT_PREFIX.test(raw))) continue
      const resolved = path.resolve(executionDir, raw)
      if (!allowedRoots.some((r) => r && (resolved === r || resolved.startsWith(r + path.sep)))) return raw
    }
    return null
  }
  const rawLeak = checkText(text)
  if (rawLeak) return rawLeak
  const segmented = text.match(/\bprintf\s+(?:%s|['"]%s['"])\s+((?:['"][^'"]*['"]\s*)+)/i)
  if (segmented) {
    const assembled = (segmented[1].match(/['"]([^'"]*)['"]/g) || []).map((s) => s.slice(1, -1)).join('')
    const assembledLeak = checkText(assembled)
    if (assembledLeak) return assembledLeak
  }
  const decoded = decodeEscapedStrings(text)
  return decoded !== text ? checkText(decoded) : null
}

/**
 * Sanitizes process environment for untrusted candidate tests (#244, #260).
 */
export function getScrubbedEnv(overrides = {}) {
  const safeVars = new Set([
    'PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TEMP', 'TMP',
    'USER', 'LOGNAME', 'HOME', 'SHELL', 'TERM', 'NODE_ENV', 'SYSTEMROOT',
    'WINDIR', 'COMSPEC', 'PATHEXT',
  ])
  const scrubbed = {}
  for (const [key, val] of Object.entries(process.env)) {
    if (!val || key.startsWith('MOA_') || key.startsWith('DSH_') || key.startsWith('SSH_')) continue
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
 * Builds Node.js permission model CLI options (#260).
 *
 * CRITICAL SECURITY CONTRACT:
 * When OS-level container isolation is NOT active, --allow-child-process MUST NOT be used,
 * because child processes can strip NODE_OPTIONS and bypass the permission model.
 */
export function buildPermOpts({ allowedReads, executionDir, effectiveHome, fenceFile, hasOsSandbox = false }) {
  const readFlags = allowedReads.map((p) => `--allow-fs-read=${p}`).join(' ')
  const writeFlags = `--allow-fs-write=${executionDir} --allow-fs-write=${effectiveHome}`
  const childFlag = hasOsSandbox ? ' --allow-child-process' : ''
  return `--permission ${readFlags} ${writeFlags}${childFlag} --require ${fenceFile}`
}

/**
 * Generates the source code for the ephemeral runtime fence module (#161, #260).
 */
export function generateFenceCode({ allowedReads, hasOsSandbox = false }) {
  const allowedJson = JSON.stringify(allowedReads)
  const evasionPattern = JSON.stringify(COMPUTED_SHELL_EVASION.source)
  const nodeOptsPattern = JSON.stringify(NODE_OPTIONS_EVASION.source)
  const unixRootPattern = JSON.stringify(UNIX_ROOT_PREFIX.source)
  const sysDirsPattern = JSON.stringify(SAFE_SYS_DIRS.source)
  const sensExtsPattern = JSON.stringify(SENSITIVE_EXTS.source)
  const pathTokenPattern = JSON.stringify(PATH_TOKEN_REGEX.source)
  const octalHexPattern = JSON.stringify(OCTAL_HEX_ESCAPE.source)

  return [
    "const cp = require('node:child_process');",
    "const path = require('node:path');",
    `const allowed = ${allowedJson};`,
    `const hasOsSandbox = ${hasOsSandbox ? 'true' : 'false'};`,
    "",
    `const COMPUTED_SHELL_EVASION = new RegExp(${evasionPattern}, 'i');`,
    `const NODE_OPTIONS_EVASION = new RegExp(${nodeOptsPattern}, 'i');`,
    `const UNIX_ROOT_PREFIX = new RegExp(${unixRootPattern});`,
    `const SAFE_SYS_DIRS = new RegExp(${sysDirsPattern});`,
    `const SENSITIVE_EXTS = new RegExp(${sensExtsPattern}, 'i');`,
    `const PATH_TOKEN_REGEX = new RegExp(${pathTokenPattern}, 'g');`,
    `const OCTAL_HEX_ESCAPE = new RegExp(${octalHexPattern}, 'g');`,
    "",
    "function decodeEscaped(str) {",
    "  if (!str || typeof str !== 'string') return '';",
    "  const norm = str.replace(/\\+/g, '\\\\');",
    "  return norm.replace(OCTAL_HEX_ESCAPE, (m, oct, hex) => {",
    "    if (oct) return String.fromCharCode(parseInt(oct, 8));",
    "    if (hex) return String.fromCharCode(parseInt(hex, 16));",
    "    return m;",
    "  });",
    "}",
    "",
    "function checkSinglePath(p) {",
    "  if (!p || typeof p !== 'string') return true;",
    "  if (SAFE_SYS_DIRS.test(p) && !SENSITIVE_EXTS.test(p)) return true;",
    "  const isAbs = path.isAbsolute(p);",
    "  const isUp = p.startsWith('..');",
    "  if (!isAbs && !isUp) return true;",
    "  if (isAbs && process.platform !== 'win32' && !UNIX_ROOT_PREFIX.test(p)) return true;",
    "  const res = path.resolve(process.cwd(), p);",
    "  return allowed.some(root => root && (res === root || res.startsWith(root + path.sep)));",
    "}",
    "",
    "function scanStringForPaths(str) {",
    "  if (!str || typeof str !== 'string') return true;",
    "  if (!checkSinglePath(str)) return false;",
    "  const dec = decodeEscaped(str);",
    "  if (dec !== str && !checkSinglePath(dec)) return false;",
    "  const matches = str.match(PATH_TOKEN_REGEX) || [];",
    "  for (const m of matches) {",
    "    if (!checkSinglePath(m)) return false;",
    "  }",
    "  if (dec !== str) {",
    "    const decMatches = dec.match(PATH_TOKEN_REGEX) || [];",
    "    for (const m of decMatches) {",
    "      if (!checkSinglePath(m)) return false;",
    "    }",
    "  }",
    "  return true;",
    "}",
    "",
    "function guardChildCall(methodName, cmd, args) {",
    "  if (!hasOsSandbox) {",
    "    throw new Error('ERR_ACCESS_DENIED: child process execution restricted without OS-level sandbox: ' + methodName);",
    "  }",
    "  const full = [cmd, ...(Array.isArray(args) ? args : [])].join(' ');",
    "  if (COMPUTED_SHELL_EVASION.test(full)) {",
    "    throw new Error('ERR_ACCESS_DENIED: child process computed execution pattern blocked: ' + full);",
    "  }",
    "  if (NODE_OPTIONS_EVASION.test(full)) {",
    "    throw new Error('ERR_ACCESS_DENIED: child process attempts to strip security environment: ' + full);",
    "  }",
    "  if (cmd && !scanStringForPaths(String(cmd))) {",
    "    throw new Error('ERR_ACCESS_DENIED: child process command outside sandbox: ' + cmd);",
    "  }",
    "  if (Array.isArray(args)) {",
    "    for (const a of args) {",
    "      if (a && !scanStringForPaths(String(a))) {",
    "        throw new Error('ERR_ACCESS_DENIED: child process argument outside sandbox: ' + a);",
    "      }",
    "    }",
    "  }",
    "}",
    "",
    "const origSpawn = cp.spawn; cp.spawn = function(cmd, args, opts) { guardChildCall('spawn', cmd, args); return origSpawn.apply(this, arguments); };",
    "const origSpawnSync = cp.spawnSync; cp.spawnSync = function(cmd, args, opts) { guardChildCall('spawnSync', cmd, args); return origSpawnSync.apply(this, arguments); };",
    "const origExecFile = cp.execFile; cp.execFile = function(file, args, opts, cb) { guardChildCall('execFile', file, args); return origExecFile.apply(this, arguments); };",
    "const origExecFileSync = cp.execFileSync; cp.execFileSync = function(file, args, opts) { guardChildCall('execFileSync', file, args); return origExecFileSync.apply(this, arguments); };",
    "const origExec = cp.exec; cp.exec = function(cmd, opts, cb) { guardChildCall('exec', cmd, [cmd]); return origExec.apply(this, arguments); };",
    "const origExecSync = cp.execSync; cp.execSync = function(cmd, opts) { guardChildCall('execSync', cmd, [cmd]); return origExecSync.apply(this, arguments); };",
    "const origFork = cp.fork; cp.fork = function(modulePath, args, opts) { guardChildCall('fork', modulePath, args); return origFork.apply(this, arguments); };",
    "",
    "const fsMod = require('node:fs');",
    "function guardFs(p, isWrite) {",
    "  if (!p || typeof p !== 'string') return;",
    "  const isAbs = path.isAbsolute(p);",
    "  const isUp = p.startsWith('..');",
    "  if (!isAbs && !isUp) return;",
    "  const resolved = path.resolve(process.cwd(), p);",
    "  const checkRoots = isWrite ? [process.cwd(), process.env.HOME].filter(Boolean) : allowed;",
    "  const ok = checkRoots.some(r => r && (resolved === r || resolved.startsWith(r + path.sep)));",
    "  if (!ok) throw new Error('ERR_ACCESS_DENIED: fs access outside sandbox: ' + p);",
    "}",
    "const origRF = fsMod.readFileSync; fsMod.readFileSync = function(p) { guardFs(p, false); return origRF.apply(this, arguments); };",
    "const origWF = fsMod.writeFileSync; fsMod.writeFileSync = function(p) { guardFs(p, true); return origWF.apply(this, arguments); };",
    "const origAF = fsMod.appendFileSync; fsMod.appendFileSync = function(p) { guardFs(p, true); return origAF.apply(this, arguments); };",
  ].join('\n')
}
