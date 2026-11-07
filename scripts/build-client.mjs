#!/usr/bin/env node
/**
 * Build DSH client entry (lib/client.js) from ordered src/client fragments.
 * Modernized with esbuild validation & compression, atomic write,
 * DSH Store 256KB size limit enforcement, and ESLint no-undef checks.
 *
 * Options:
 *   --check      Verify lib/client.js matches concatenated fragments (exit 1 on drift)
 *   --out <path> Custom output destination (used by tests to avoid in-place race conditions)
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync, statSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { transformSync } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src', 'client')
export const OUT = 'lib/client.js'
const defaultOut = join(root, OUT)

const args = process.argv.slice(2)
const isCheck = args.includes('--check')
const outIdx = args.indexOf('--out')
const customOut = outIdx !== -1 && args[outIdx + 1] ? resolve(args[outIdx + 1]) : null
const outFile = customOut || defaultOut

export function renderClientBundle(repoRoot = root) {
  const currentSrcDir = join(repoRoot, 'src', 'client')
  const files = readdirSync(currentSrcDir)
    .filter((name) => name.endsWith('.js'))
    .sort((a, b) => {
      const na = Number.parseInt(a, 10)
      const nb = Number.parseInt(b, 10)
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
      return a.localeCompare(b)
    })

  if (files.length === 0) {
    throw new Error('build-client: no fragments in src/client')
  }

  let rawConcat = ''
  for (const name of files) {
    const filePath = join(currentSrcDir, name)
    const content = readFileSync(filePath, 'utf8')
    rawConcat += `// --- src/client/${name} ---\n` + content + '\n'
  }

  // Validate syntax & strip unnecessary legal comments while keeping formatting
  const transformed = transformSync(rawConcat, {
    loader: 'js',
    target: 'es2020',
    minifyWhitespace: false,
    minifySyntax: false,
    minifyIdentifiers: false,
    legalComments: 'none',
  })

  return {
    code: transformed.code,
    fragmentCount: files.length,
  }
}

const { code: bundle, fragmentCount } = renderClientBundle(root)

if (isCheck) {
  if (!existsSync(outFile)) {
    console.error(`[build-client] ERROR: target ${outFile} does not exist!`)
    process.exit(1)
  }
  const current = readFileSync(outFile, 'utf8')
  if (current !== bundle) {
    console.error(`[build-client] ERROR: Drift detected between src/client/ and ${outFile}! Run "npm run build:client" to sync.`)
    process.exit(1)
  }
  console.log(`[build-client] Check mode: ${outFile} is up to date (${fragmentCount} fragments, ${bundle.length} bytes).`)
  process.exit(0)
}

mkdirSync(dirname(outFile), { recursive: true })

// Atomic write to prevent race conditions during tests or parallel execution
const tempOut = `${outFile}.${process.pid}.${Date.now()}.tmp`
writeFileSync(tempOut, bundle, 'utf8')
try {
  renameSync(tempOut, outFile)
} catch {
  writeFileSync(outFile, bundle, 'utf8')
  try { unlinkSync(tempOut) } catch {}
}

const stats = statSync(outFile)
console.log(`[build-client] Rebuilt ${relative(root, outFile) || outFile}: ${stats.size} bytes (< 256 KiB limit) from ${fragmentCount} fragments`)

// Enforce official DSH Store limit (256 KiB = 262,144 bytes)
const MAX_STORE_BYTES = 262144
if (stats.size > MAX_STORE_BYTES) {
  console.error(`[build-client] ERROR: Bundle exceeds official DSH Store limit (${stats.size} > ${MAX_STORE_BYTES} bytes)!`)
  process.exit(1)
}

// 1. Node syntax validation
try {
  execFileSync(process.execPath, ['--check', outFile], { stdio: 'inherit' })
  console.log('[build-client] Syntax check: OK')
} catch (_err) {
  console.error(`[build-client] ERROR: Syntax check failed on ${outFile}!`)
  process.exit(1)
}

// 2. ESLint no-undef check
const localEslintJs = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
const hasLocalEslint = existsSync(localEslintJs)
const eslintCmd = hasLocalEslint ? process.execPath : 'eslint'
const eslintArgs = [
  '--no-config-lookup',
  '--rule', 'no-undef: 2',
  '--global', 'window,document,console,fetch,setTimeout,clearTimeout,AbortController,URL,URLSearchParams,structuredClone,CustomEvent',
  outFile,
]
if (hasLocalEslint) eslintArgs.unshift(localEslintJs)

try {
  execFileSync(eslintCmd, eslintArgs, { stdio: 'inherit' })
  console.log('[build-client] ESLint no-undef check: OK')
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error('[build-client] ERROR: eslint binary not found! Install devDependencies before building.')
    process.exit(1)
  }
  console.error(`[build-client] ERROR: no-undef violations found in ${outFile}!`)
  process.exit(1)
}