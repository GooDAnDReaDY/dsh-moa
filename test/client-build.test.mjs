import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
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

test('scripts/build-client.mjs correctly compiles client bundle to target without racing', () => {
  const scriptPath = path.join(root, 'scripts', 'build-client.mjs')
  assert.ok(fs.existsSync(scriptPath), 'scripts/build-client.mjs exists')

  const tmpOut = path.join(os.tmpdir(), `dsh-moa-client-test-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  try {
    execFileSync(process.execPath, [scriptPath, '--out', tmpOut], { cwd: root })

    assert.ok(fs.existsSync(tmpOut), 'compiled client bundle exists at custom destination')
    const content = fs.readFileSync(tmpOut, 'utf8')
    assert.ok(content.includes('@goodandready/dsh-moa'), 'bundle contains module id')
    assert.ok(content.includes('SearchableModelPicker'), 'bundle contains SearchableModelPicker')
    assert.ok(content.includes('MoAEditor'), 'bundle contains MoAEditor')
  } finally {
    try { fs.unlinkSync(tmpOut) } catch { /* ignore */ }
  }
})
