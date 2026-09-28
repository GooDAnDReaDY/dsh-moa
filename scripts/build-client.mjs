#!/usr/bin/env node
/**
 * Build DSH client entry (lib/client.js) from ordered src/client fragments.
 * DSH ModuleLoader loads a single file; this concatenates source modules
 * into that one factory. Run: npm run build:client
 *
 * Options:
 *   --check      Verify lib/client.js matches concatenated fragments (exit 1 on drift)
 *   --out <path> Custom output destination (used by tests to avoid in-place race conditions)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src', 'client')

const args = process.argv.slice(2)
const isCheck = args.includes('--check')
const outIdx = args.indexOf('--out')
const customOut = outIdx !== -1 && args[outIdx + 1] ? resolve(args[outIdx + 1]) : null
const outFile = customOut || join(root, 'lib', 'client.js')

const files = readdirSync(srcDir)
  .filter((name) => name.endsWith('.js'))
  .sort((a, b) => {
    const na = Number.parseInt(a, 10)
    const nb = Number.parseInt(b, 10)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return a.localeCompare(b)
  })

if (files.length === 0) {
  console.error('build-client: no fragments in src/client')
  process.exit(1)
}

let body = ''
for (const name of files) {
  body += readFileSync(join(srcDir, name), 'utf8')
}

if (isCheck) {
  if (!existsSync(outFile)) {
    console.error(`build-client --check: target ${outFile} does not exist`)
    process.exit(1)
  }
  const current = readFileSync(outFile, 'utf8')
  if (current !== body) {
    console.error(`build-client --check: ${outFile} has drifted from src/client fragments. Run npm run build:client to synchronize.`)
    process.exit(1)
  }
  console.log(`build-client --check: ${outFile} is up to date (${files.length} fragments, ${body.length} bytes)`)
  process.exit(0)
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, body, 'utf8')
console.log(`build-client: wrote ${outFile} from ${files.length} fragments (${body.length} bytes)`)
