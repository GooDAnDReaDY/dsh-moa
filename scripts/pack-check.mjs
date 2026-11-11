#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const WARN_LIMIT = 256000
export const BLOCK_LIMIT = 262144

export function checkRootTarballs(cwd = process.cwd()) {
  const rootFiles = fs.readdirSync(cwd)
  return rootFiles.filter((f) => f.endsWith('.tgz'))
}

export function evaluatePackedFiles(files, { warnLimit = WARN_LIMIT, blockLimit = BLOCK_LIMIT } = {}) {
  const warnings = []
  const errors = []

  for (const f of files || []) {
    if (f.size > blockLimit) {
      errors.push(`File "${f.path}" (${f.size} bytes) exceeds block limit ${blockLimit} bytes`)
    } else if (f.size >= warnLimit) {
      warnings.push(`File "${f.path}" (${f.size} bytes) reached warn threshold ${warnLimit} bytes`)
    }
  }

  return { warnings, errors }
}

export function runPackCheck({ cwd = process.cwd(), warnLimit = WARN_LIMIT, blockLimit = BLOCK_LIMIT, execFn = execFileSync } = {}) {
  const strayTarballs = checkRootTarballs(cwd)
  if (strayTarballs.length > 0) {
    throw new Error(`[pack:check] Untracked release tarballs found in source root: ${strayTarballs.join(', ')}. Pack outside checkout via "npm pack --pack-destination /tmp".`)
  }

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const jsonStr = execFn(npmBin, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const parsed = JSON.parse(jsonStr)
  let pkg = parsed
  if (Array.isArray(parsed)) {
    pkg = parsed[0]
  } else if (parsed && typeof parsed === 'object') {
    const values = Object.values(parsed)
    if (values.length > 0 && values[0]?.files) {
      pkg = values[0]
    }
  }

  const files = pkg?.files || []
  const { warnings, errors } = evaluatePackedFiles(files, { warnLimit, blockLimit })

  for (const w of warnings) {
    console.warn(`[pack:check] WARN: ${w}`)
  }
  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`[pack:check] ERROR: ${e}`)
    }
    throw new Error(errors.join('; '))
  }

  return {
    fileCount: files.length,
    size: pkg?.size || 0,
    unpackedSize: pkg?.unpackedSize || 0,
    warnings,
  }
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  try {
    const res = runPackCheck()
    console.log(`[pack:check] OK: ${res.fileCount} files packed (${res.size} bytes compressed / ${res.unpackedSize} bytes unpacked). All files <= ${BLOCK_LIMIT} bytes.`)
  } catch (err) {
    console.error(err.message || err)
    process.exit(1)
  }
}
