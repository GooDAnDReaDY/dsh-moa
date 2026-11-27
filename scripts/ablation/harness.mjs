/**
 * Shared objective-validator harness for the MoA ablation (#367).
 *
 * A task's verdict is the exit code of `node --test harness.test.mjs` executed
 * in a temp directory against the candidate impl.js. The spawn must NOT inherit
 * the test-runner context: when the caller itself runs under `node --test`
 * (npm test guards), the child would detect the recursive run() and skip all
 * files with exit 0, silently neutering the validator.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'

export function extractAllFileBlocks(text) {
  if (!text || typeof text !== 'string') return []
  const stripped = text.replace(/think[\s\S]*?<\/think>/gi, '').trim()
  const source = stripped || text
  const re = /```(?:javascript|js)?\s+file="([^"\n]+)"\s*\n([\s\S]*?)\n```/gi
  const out = []
  let m
  while ((m = re.exec(source)) !== null) {
    const rel = m[1].trim()
    // No traversal outside the sandbox
    if (!rel || rel.includes('..') || path.isAbsolute(rel)) continue
    out.push({ relativePath: rel.replace(/^\.\/+/, ''), content: m[2] })
  }
  return out
}

export function runHarness(taskDef, implCode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `moa-ablation-${taskDef.id}-`))
  try {
    // Multi-file tasks (#388): pre-provision the repro context, then write
    // every extracted candidate file block at its declared relative path.
    for (const [rel, content] of Object.entries(taskDef.contextFiles || {})) {
      const target = path.join(dir, rel)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, content, 'utf8')
    }
    if (Array.isArray(implCode)) {
      for (const f of implCode) {
        const target = path.join(dir, f.relativePath)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, f.content, 'utf8')
      }
    } else {
      fs.writeFileSync(path.join(dir, 'impl.js'), implCode ?? '', 'utf8')
    }
    fs.writeFileSync(path.join(dir, 'harness.test.mjs'), taskDef.harness, 'utf8')
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    delete env.TEST_CHILD_PORT
    const res = spawnSync(process.execPath, ['--test', 'harness.test.mjs'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 30000,
      env,
    })
    const output = `${res.stdout || ''}${res.stderr || ''}`
    const passed = res.status === 0
    const m = output.match(/ℹ tests (\d+)[\s\S]*?ℹ pass (\d+)/)
    return {
      passed,
      exitCode: res.status,
      testsTotal: m ? Number(m[1]) : null,
      testsPassed: m ? Number(m[2]) : null,
      output: output.slice(-4000),
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
