import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {
  isTestEnvironment,
  getDefaultHistoryDir,
  getDefaultHistoryFile,
  recordMoaRun,
  recordMoaRunAsync,
} from '../lib/history.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

function getFileFingerprint(filePath) {
  if (!fs.existsSync(filePath)) return null
  const stat = fs.statSync(filePath)
  const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
  return { mtimeMs: stat.mtimeMs, size: stat.size, hash }
}

test('history-isolation: test environment is automatically detected', () => {
  assert.equal(isTestEnvironment(), true, 'isTestEnvironment should return true during test runs')
  const defaultDir = getDefaultHistoryDir()
  const defaultFile = getDefaultHistoryFile()

  // Must NOT point to real homedir .dsh
  const realHomedirDsh = path.join(os.homedir(), '.dsh')
  assert.notEqual(defaultDir, realHomedirDsh, 'default history dir must never be user homedir in tests')
  assert.equal(defaultFile.includes(defaultDir), true)
})

test('history-isolation: running MoA pipeline does NOT touch real ~/.dsh history', async () => {
  const realHistoryFile = path.join(os.homedir(), '.dsh', 'moa-history.jsonl')
  const beforeFingerprint = getFileFingerprint(realHistoryFile)

  // Run a pipeline without passing historyFilePath (should use isolated test default)
  const result = await runMoAPipeline({
    userPrompt: 'Protective isolation verification prompt',
    preset: {
      name: 'isolation-test',
      reference_models: [{ provider: 'mock-p', model: 'mock-m' }],
      curator_synthesis: false,
    },
    callLlm: async () => ({
      content: 'Candidate output for isolation test',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    }),
  })

  assert.ok(result, 'MoA pipeline should return a result')

  // Verify real history file is completely untouched
  const afterFingerprint = getFileFingerprint(realHistoryFile)
  if (beforeFingerprint === null) {
    assert.equal(fs.existsSync(realHistoryFile), false, 'Real history file must not be created')
  } else {
    assert.equal(afterFingerprint.mtimeMs, beforeFingerprint.mtimeMs, 'Real history mtime must not change')
    assert.equal(afterFingerprint.size, beforeFingerprint.size, 'Real history size must not change')
    assert.equal(afterFingerprint.hash, beforeFingerprint.hash, 'Real history sha256 hash must not change')
  }

  // Verify that the record was indeed written to the isolated test history file
  const testHistFile = getDefaultHistoryFile()
  assert.equal(fs.existsSync(testHistFile), true, 'Test history file must exist in isolated dir')
  const testContent = fs.readFileSync(testHistFile, 'utf8')
  assert.equal(testContent.includes('Protective isolation verification prompt'), true)
})

test('history-isolation: trap directory override routes writes cleanly', async () => {
  const trapDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-trap-'))
  const trapDsh = path.join(trapDir, '.dsh')
  fs.mkdirSync(trapDsh, { recursive: true })

  const origHome = process.env.DSH_HOME
  const origDir = process.env.DSH_HISTORY_DIR
  const origFile = process.env.DSH_HISTORY_FILE

  try {
    delete process.env.DSH_HISTORY_FILE
    process.env.DSH_HISTORY_DIR = trapDsh

    assert.equal(getDefaultHistoryDir(), trapDsh)
    const expectedFile = path.join(trapDsh, 'moa-history.jsonl')
    assert.equal(getDefaultHistoryFile(), expectedFile)

    await recordMoaRunAsync({
      prompt: 'Trap verification run',
      preset: 'trap-test',
      candidates: [],
    })

    assert.equal(fs.existsSync(expectedFile), true)
    const trapContent = fs.readFileSync(expectedFile, 'utf8')
    assert.equal(trapContent.includes('Trap verification run'), true)
  } finally {
    process.env.DSH_HOME = origHome
    process.env.DSH_HISTORY_DIR = origDir
    process.env.DSH_HISTORY_FILE = origFile
    fs.rmSync(trapDir, { recursive: true, force: true })
  }
})
