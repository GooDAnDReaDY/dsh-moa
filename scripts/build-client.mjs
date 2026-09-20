#!/usr/bin/env node
/**
 * Build DSH client entry (lib/client.js) from ordered src/client fragments.
 * DSH ModuleLoader loads a single file; this concatenates source modules
 * into that one factory. Run: npm run build:client
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src', 'client')
const outFile = join(root, 'lib', 'client.js')

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

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, body, 'utf8')
console.log(`build-client: wrote lib/client.js from ${files.length} fragments (${body.length} bytes)`)
