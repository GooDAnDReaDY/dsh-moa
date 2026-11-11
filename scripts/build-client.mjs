#!/usr/bin/env node
/**
 * Build DSH client entry (lib/client.js) and lazy chunks (lib/client.panels.js, lib/client.zh.js)
 * from ordered src/client*, src/client-panels*, and src/client-zh* fragments.
 *
 * Options:
 *   --check      Verify built files match concatenated fragments (exit 1 on drift)
 *   --out <path> Custom output destination for main bundle (used by tests)
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync, statSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { transformSync } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const OUT = 'lib/client.js'
export const PANELS_OUT = 'lib/client.panels.js'
export const ZH_OUT = 'lib/client.zh.js'
export const MAX_STORE_BYTES = 262144

function sortFragments(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .sort((a, b) => {
      const na = Number.parseInt(a, 10)
      const nb = Number.parseInt(b, 10)
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
      return a.localeCompare(b)
    })
}

function transformCode(rawCode) {
  const transformed = transformSync(rawCode, {
    loader: 'js',
    target: 'es2020',
    minifyWhitespace: false,
    minifySyntax: false,
    minifyIdentifiers: false,
    legalComments: 'none',
  })
  return transformed.code
}

export function renderClientBundle(repoRoot = root) {
  const currentSrcDir = join(repoRoot, 'src', 'client')
  const files = sortFragments(currentSrcDir)

  if (files.length === 0) {
    throw new Error('build-client: no fragments in src/client')
  }

  let rawConcat = ''
  for (const name of files) {
    const filePath = join(currentSrcDir, name)
    const content = readFileSync(filePath, 'utf8')
    rawConcat += `// --- src/client/${name} ---\n` + content + '\n'
  }

  return {
    code: transformCode(rawConcat),
    fragmentCount: files.length,
  }
}

export function renderPanelsChunk(repoRoot = root) {
  const panelsDir = join(repoRoot, 'src', 'client-panels')
  if (!existsSync(panelsDir)) {
    throw new Error('build-client: missing src/client-panels directory')
  }
  const files = sortFragments(panelsDir)
  if (files.length === 0) {
    throw new Error('build-client: no fragments in src/client-panels')
  }

  let body = ''
  for (const name of files) {
    const content = readFileSync(join(panelsDir, name), 'utf8')
    body += `// --- src/client-panels/${name} ---\n` + content + '\n'
  }

  const raw = `/* global window */
window.__ModuleLoader__.load({
  id: '@goodandready/dsh-moa',
  chunk: 'client.panels.js',
  factory: (require) => {
    const React = require('react')
${body}
    return { CandidateDiffSection, InteractiveWorkbenchSection }
  },
})
`
  return {
    code: transformCode(raw),
    fragmentCount: files.length,
  }
}

export function renderZhChunk(repoRoot = root) {
  const zhDir = join(repoRoot, 'src', 'client-zh')
  if (!existsSync(zhDir)) {
    throw new Error('build-client: missing src/client-zh directory')
  }
  const files = sortFragments(zhDir)
  if (files.length === 0) {
    throw new Error('build-client: no fragments in src/client-zh')
  }

  let body = ''
  for (const name of files) {
    const content = readFileSync(join(zhDir, name), 'utf8')
    body += `// --- src/client-zh/${name} ---\n` + content + '\n'
  }

  const raw = `/* global window */
window.__ModuleLoader__.load({
  id: '@goodandready/dsh-moa',
  chunk: 'client.zh.js',
  factory: () => {
${body}
    return { zh }
  },
})
`
  return {
    code: transformCode(raw),
    fragmentCount: files.length,
  }
}

function writeAtomic(targetPath, content) {
  mkdirSync(dirname(targetPath), { recursive: true })
  const tempOut = `${targetPath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tempOut, content, 'utf8')
  try {
    renameSync(tempOut, targetPath)
  } catch {
    writeFileSync(targetPath, content, 'utf8')
    try { unlinkSync(tempOut) } catch {}
  }
}

function verifyArtifact(targetPath, label) {
  const stats = statSync(targetPath)
  if (stats.size > MAX_STORE_BYTES) {
    console.error(`[build-client] ERROR: ${label} exceeds official DSH Store limit (${stats.size} > ${MAX_STORE_BYTES} bytes)!`)
    process.exit(1)
  }

  try {
    execFileSync(process.execPath, ['--check', targetPath], { stdio: 'inherit' })
  } catch {
    console.error(`[build-client] ERROR: Syntax check failed on ${targetPath}!`)
    process.exit(1)
  }

  const localEslintJs = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
  const hasLocalEslint = existsSync(localEslintJs)
  const eslintCmd = hasLocalEslint ? process.execPath : 'eslint'
  const eslintArgs = [
    '--no-config-lookup',
    '--rule', 'no-undef: 2',
    '--global', 'window,document,navigator,console,fetch,setTimeout,clearTimeout,AbortController,URL,URLSearchParams,structuredClone,CustomEvent',
    targetPath,
  ]
  if (hasLocalEslint) eslintArgs.unshift(localEslintJs)

  try {
    execFileSync(eslintCmd, eslintArgs, { stdio: 'inherit' })
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('[build-client] ERROR: eslint binary not found! Install devDependencies before building.')
      process.exit(1)
    }
    console.error(`[build-client] ERROR: no-undef violations found in ${targetPath}!`)
    process.exit(1)
  }
}

function main() {
  const args = process.argv.slice(2)
  const isCheck = args.includes('--check')
  const outIdx = args.indexOf('--out')
  const customOut = outIdx !== -1 && args[outIdx + 1] ? resolve(args[outIdx + 1]) : null
  const outFile = customOut || join(root, OUT)

  const mainRes = renderClientBundle(root)
  const panelsRes = renderPanelsChunk(root)
  const zhRes = renderZhChunk(root)

  const targets = customOut
    ? [{ path: outFile, label: outFile, code: mainRes.code, fragments: mainRes.fragmentCount }]
    : [
        { path: join(root, OUT), label: OUT, code: mainRes.code, fragments: mainRes.fragmentCount },
        { path: join(root, PANELS_OUT), label: PANELS_OUT, code: panelsRes.code, fragments: panelsRes.fragmentCount },
        { path: join(root, ZH_OUT), label: ZH_OUT, code: zhRes.code, fragments: zhRes.fragmentCount },
      ]

  if (isCheck) {
    for (const item of targets) {
      if (!existsSync(item.path)) {
        console.error(`[build-client] ERROR: target ${item.label} does not exist!`)
        process.exit(1)
      }
      const current = readFileSync(item.path, 'utf8')
      if (current !== item.code) {
        console.error(`[build-client] ERROR: Drift detected between sources and ${item.label}! Run "npm run build:client" to sync.`)
        process.exit(1)
      }
      console.log(`[build-client] Check mode: ${item.label} is up to date (${item.fragments} fragments, ${Buffer.byteLength(item.code)} bytes).`)
    }
    process.exit(0)
  }

  for (const item of targets) {
    writeAtomic(item.path, item.code)
    const size = statSync(item.path).size
    const headroom = MAX_STORE_BYTES - size
    console.log(`[build-client] Rebuilt ${relative(root, item.path) || item.path}: ${size} bytes (headroom: ${headroom} B under 256 KiB limit) from ${item.fragments} fragments`)
    verifyArtifact(item.path, item.label)
  }
  console.log('[build-client] Syntax & ESLint no-undef checks: OK')
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  main()
}
