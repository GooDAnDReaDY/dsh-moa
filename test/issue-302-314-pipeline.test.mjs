import test from 'node:test'
import assert from 'node:assert/strict'
import { runMoAPipeline } from '../lib/pipeline/runner.js'
import { MOA_EVENTS } from '../lib/events.js'

test('runMoAPipeline: triggers Security Gate and emits SECURITY_AUDIT event', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  let judgeReceivedPrompt = ''
  const mockCallLlm = async (opts) => {
    if (opts.model === 'vuln-model') {
      return 'export function queryUser(id, db) { return db.query(`SELECT * FROM users WHERE id = ${id}`); }'
    }
    if (opts.model === 'safe-model') {
      return 'export function queryUser(id, db) { return db.query("SELECT * FROM users WHERE id = ?", [id]); }'
    }
    // Judge / Aggregator
    const promptStr = (opts.messages || []).map((m) => m.content).join('\n')
    judgeReceivedPrompt = promptStr
    return 'Winner is safe-model due to injection risk in Reference 1.'
  }

  const result = await runMoAPipeline({
    userPrompt: 'Write a database query helper',
    preset: {
      name: 'security-test',
      security_gate_enabled: true,
      ask_clarifying_questions: false,
      curator_synthesis: true,
      reference_models: [
        { provider: 'p1', model: 'vuln-model', role_persona: 'proposer' },
        { provider: 'p2', model: 'safe-model', role_persona: 'challenger' },
      ],
      aggregator: { provider: 'p-judge', model: 'judge-model' },
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    cwd: process.cwd(),
  })

  assert.ok(result)
  const secAudits = emitted.filter((e) => e.ev === MOA_EVENTS.SECURITY_AUDIT)
  assert.equal(secAudits.length, 2)
  assert.equal(secAudits[0].p.veto, true) // vuln model
  assert.equal(secAudits[1].p.veto, false) // safe model

  // Judge must receive the Red Team directive
  assert.ok(judgeReceivedPrompt.includes('ADVERSARIAL RED TEAM SECURITY AUDIT DIRECTIVE'))
  assert.ok(judgeReceivedPrompt.includes('SECURITY_VETO'))
})

test('runMoAPipeline: triggers CoVe Fact-Checking Gate and emits COVE_VERIFIED event', async () => {
  const emitted = []
  const mockCtx = { emit: (ev, p) => emitted.push({ ev, p }) }

  let judgeReceivedPrompt = ''
  const mockCallLlm = async (opts) => {
    if (opts.model === 'hallucinating-model') {
      return 'import fs from "fs"; export function load() { return fs.readAllText("file.txt"); }'
    }
    if (opts.model === 'accurate-model') {
      return 'import fs from "node:fs/promises"; export async function load() { return fs.readFile("file.txt", "utf8"); }'
    }
    // Judge
    const promptStr = (opts.messages || []).map((m) => m.content).join('\n')
    judgeReceivedPrompt = promptStr
    return 'Winner is accurate-model. hallucinating-model used nonexistent fs.readAllText.'
  }

  const result = await runMoAPipeline({
    userPrompt: 'Write a file reader function',
    preset: {
      name: 'cove-test',
      cove_verification_enabled: true,
      ask_clarifying_questions: false,
      curator_synthesis: true,
      reference_models: [
        { provider: 'p1', model: 'hallucinating-model', role_persona: 'proposer' },
        { provider: 'p2', model: 'accurate-model', role_persona: 'challenger' },
      ],
      aggregator: { provider: 'p-judge', model: 'judge-model' },
    },
    callLlm: mockCallLlm,
    ctx: mockCtx,
    cwd: process.cwd(),
  })

  assert.ok(result)
  const coveEvents = emitted.filter((e) => e.ev === MOA_EVENTS.COVE_VERIFIED)
  assert.equal(coveEvents.length, 2)
  assert.equal(coveEvents[0].p.passed, false) // Reference 1 hallucinated
  assert.equal(coveEvents[1].p.passed, true) // Reference 2 verified

  // Judge must receive the CoVe directive
  assert.ok(judgeReceivedPrompt.includes('CHAIN-OF-VERIFICATION (CoVe) FACT-CHECK DIRECTIVE'))
  assert.ok(judgeReceivedPrompt.includes('FACT-CHECK FAILURE'))
})
