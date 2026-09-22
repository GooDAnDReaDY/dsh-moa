import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

test('src/client fragments exist and comply with <= 600 line limit', () => {
  const srcDir = path.join(root, 'src', 'client')
  assert.ok(fs.existsSync(srcDir), 'src/client directory exists')
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js'))
  assert.ok(files.length >= 10, `Expected at least 10 fragments, found ${files.length}`)

  for (const f of files) {
    const content = fs.readFileSync(path.join(srcDir, f), 'utf8')
    const lineCount = content.split(/\r?\n/).length
    assert.ok(
      lineCount <= 600,
      `Fragment src/client/${f} has ${lineCount} lines, exceeding the 600 line threshold`
    )
  }
})

test('scripts/build-client.mjs correctly compiles lib/client.js', () => {
  const scriptPath = path.join(root, 'scripts', 'build-client.mjs')
  assert.ok(fs.existsSync(scriptPath), 'scripts/build-client.mjs exists')

  execFileSync(process.execPath, [scriptPath], { cwd: root })

  const clientPath = path.join(root, 'lib', 'client.js')
  assert.ok(fs.existsSync(clientPath), 'lib/client.js exists after build')
  const content = fs.readFileSync(clientPath, 'utf8')
  assert.ok(content.includes('@goodandready/dsh-moa'), 'lib/client.js contains module id')
  assert.ok(content.includes('SearchableModelPicker'), 'lib/client.js contains SearchableModelPicker')
  assert.ok(content.includes('MoAEditor'), 'lib/client.js contains MoAEditor')
})
