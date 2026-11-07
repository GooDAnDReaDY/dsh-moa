import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  COMPANION_PLUGINS,
  formatFileScoresDirective,
  parseFileScores,
  findTopModel,
  buildTopModelGluePrompt,
  buildJudgeReCheckPrompt,
  parseJudgeReCheckVerdict,
  assembleWorkbenchSelection,
} from '../lib/moa-workbench.js'
import { PresetSchema } from '../lib/moa-schema.js'
import { writeCandidateWorkspace } from '../lib/file-workspace.js'
import { recordMoaRunAsync, invalidateHistoryCache } from '../lib/history.js'
import { registerMoaRoutes } from '../lib/routes.js'

test('Feature #251: formatFileScoresDirective generates structured table and comment block', () => {
  const directive = formatFileScoresDirective()
  assert.match(directive, /### 📊 Candidate File Scores Directive/)
  assert.match(directive, /<!-- MOA_FILE_SCORES_START -->/)
  assert.match(directive, /<!-- MOA_FILE_SCORES_END -->/)
  assert.match(directive, /\|\s*Candidate\s*\|\s*File Path\s*\|\s*Score \(1-10\)/)
})

test('Feature #251: parseFileScores parses JSON block with scores 1-10 and pros/cons', () => {
  const judgeText = `
### Summary
The candidates provided distinct solutions.

<!-- MOA_FILE_SCORES_START -->
[
  {"candidate": 1, "file": "src/auth.ts", "score": 9, "pros": "Strict JWT validation", "cons": "No token refresh"},
  {"candidate": 2, "file": "src/routes.ts", "score": 8, "pros": "Clean REST routes", "cons": "Missing rate limit"}
]
<!-- MOA_FILE_SCORES_END -->
`
  const result = parseFileScores(judgeText)
  assert.equal(result.scores.length, 2)
  assert.equal(result.scores[0].candidateIndex, 1)
  assert.equal(result.scores[0].relativePath, 'src/auth.ts')
  assert.equal(result.scores[0].score, 9)
  assert.equal(result.scores[0].pros, 'Strict JWT validation')
  assert.equal(result.scores[0].cons, 'No token refresh')

  assert.equal(result.scores[1].candidateIndex, 2)
  assert.equal(result.scores[1].relativePath, 'src/routes.ts')
  assert.equal(result.scores[1].score, 8)

  assert.ok(result.byFile['src/auth.ts'])
  assert.ok(result.byFile['src/routes.ts'])
})

test('Feature #251: parseFileScores parses Markdown table when JSON block is absent', () => {
  const judgeText = `
### 📊 Candidate File Scores
| Candidate | File Path | Score (1-10) | Key Pros | Key Cons |
| Candidate 1 | index.html | 9 | Semantic tags and accessibility | Missing meta tags |
| Candidate 2 | app.js | 7.4 | Solid reactive state | Needs debounce on search |
`
  const result = parseFileScores(judgeText)
  assert.equal(result.scores.length, 2)
  assert.equal(result.scores[0].candidateIndex, 1)
  assert.equal(result.scores[0].relativePath, 'index.html')
  assert.equal(result.scores[0].score, 9)

  assert.equal(result.scores[1].candidateIndex, 2)
  assert.equal(result.scores[1].relativePath, 'app.js')
  assert.equal(result.scores[1].score, 7) // rounded 7.4 -> 7
})

test('Feature #251: parseFileScores supplies default scores for candidate files not explicitly scored', () => {
  const candidates = [
    { index: 1, label: 'Model A', files: ['src/unscored.ts'] },
    { index: 2, label: 'Model B', files: ['src/scored.ts'] },
  ]
  const judgeText = `
<!-- MOA_FILE_SCORES_START -->
[
  {"candidate": 2, "file": "src/scored.ts", "score": 9, "pros": "Good", "cons": "None"}
]
<!-- MOA_FILE_SCORES_END -->
`
  const result = parseFileScores(judgeText, candidates)
  assert.equal(result.scores.length, 2)
  const unscored = result.scores.find((s) => s.relativePath === 'src/unscored.ts')
  assert.ok(unscored)
  assert.equal(unscored.score, 7)
  assert.equal(unscored.candidateIndex, 1)
})

test('Feature #251: findTopModel identifies top candidate by winner index or file score average', () => {
  const candidates = [
    { index: 1, provider: 'prov1', model: 'mod1', label: 'Candidate 1' },
    { index: 2, provider: 'prov2', model: 'mod2', label: 'Candidate 2' },
  ]

  // Priority 1: winnerIndex
  const top1 = findTopModel({ winnerIndex: 2 }, candidates)
  assert.equal(top1.candidateIndex, 2)
  assert.equal(top1.model, 'mod2')

  // Priority 2: average file scores
  const runWithScores = {
    winnerIndex: 0,
    fileScores: {
      scores: [
        { candidateIndex: 1, score: 6 },
        { candidateIndex: 2, score: 9 },
      ],
    },
  }
  const top2 = findTopModel(runWithScores, candidates)
  assert.equal(top2.candidateIndex, 2)
  assert.equal(top2.model, 'mod2')

  // Fallback to aggregator if candidates empty
  const top3 = findTopModel({ aggregator: { provider: 'judge-prov', model: 'judge-mod' } }, [])
  assert.equal(top3.model, 'judge-mod')
})

test('Feature #251: parseJudgeReCheckVerdict parses PASSED / FAILED verdicts and audit scores', () => {
  const passText = `
### Audit Evaluation
Cross-file imports match cleanly. No placeholder code found.
VERDICT: PASSED
AUDIT_SCORE: 9
AUDIT_NOTES: Clean imports, robust types, complete implementation.
`
  const passRes = parseJudgeReCheckVerdict(passText)
  assert.equal(passRes.passed, true)
  assert.equal(passRes.score, 9)
  assert.match(passRes.notes, /Clean imports/)

  const failText = `
### Audit Evaluation
Severe syntax mismatch between auth.ts and routes.ts.
VERDICT: FAILED
AUDIT_SCORE: 3
AUDIT_NOTES: Missing export in auth.ts breaking route handlers.
`
  const failRes = parseJudgeReCheckVerdict(failText)
  assert.equal(failRes.passed, false)
  assert.equal(failRes.score, 3)
  assert.match(failRes.notes, /Missing export/)
})

test('Feature #251: PresetSchema accepts interactive_workbench_enabled option', () => {
  const parsedDefault = PresetSchema({ name: 'test' })
  assert.equal(parsedDefault.interactive_workbench_enabled, false)

  const parsedEnabled = PresetSchema({ name: 'test', interactive_workbench_enabled: true })
  assert.equal(parsedEnabled.interactive_workbench_enabled, true)
})

test('Feature #251: COMPANION_PLUGINS lists dsh-time-machine with GitHub url', () => {
  assert.ok(Array.isArray(COMPANION_PLUGINS))
  const tm = COMPANION_PLUGINS.find((p) => p.id === 'dsh-time-machine')
  assert.ok(tm)
  assert.equal(tm.url, 'https://github.com/goodandready/dsh-time-machine')
})

test('Feature #251: assembleWorkbenchSelection executes top-model glue and judge re-check', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-workbench-test-'))
  const histFile = path.join(tmpDir, 'history.jsonl')
  const runId = 'test-wb-run-1'

  try {
    // 1. Write candidate files into candidate sandboxes
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'src/auth.ts', content: 'export const auth = () => "jwt-token"' },
    ], { runId })

    await writeCandidateWorkspace(tmpDir, 2, [
      { relativePath: 'src/routes.ts', content: 'export const routes = () => "api-routes"' },
    ], { runId })

    // 2. Record run in history
    await recordMoaRunAsync({
      id: runId,
      cwd: tmpDir,
      prompt: 'Build auth and routes',
      preset: 'default',
      candidates: [
        { index: 1, provider: 'p1', model: 'm1', label: 'Candidate 1', files: ['src/auth.ts'] },
        { index: 2, provider: 'p2', model: 'm2', label: 'Candidate 2', files: ['src/routes.ts'] },
      ],
      winnerIndex: 1,
      winnerModel: 'm1',
      aggregator: { provider: 'p-judge', model: 'm-judge' },
    }, histFile)
    invalidateHistoryCache()

    // 3. Mock callLlm for top-model glue and judge re-check
    let callCount = 0
    const mockCallLlm = async (opts) => {
      callCount++
      if (callCount === 1) {
        // Top model glue output
        return `Here is the harmonized project:
\`\`\`typescript file="src/auth.ts"
export const auth = () => "harmonized-jwt-token"
\`\`\`
\`\`\`typescript file="src/routes.ts"
import { auth } from "./auth"
export const routes = () => auth() + "/routes"
\`\`\`
`
      }
      // Judge re-check output
      return `### Judge Re-Check Verdict
VERDICT: PASSED
AUDIT_SCORE: 9
AUDIT_NOTES: Harmonized imports, aligned contracts.
`
    }

    const assembleRes = await assembleWorkbenchSelection({
      runId,
      cwd: tmpDir,
      selections: [
        { candidateIndex: 1, file: 'src/auth.ts' },
        { candidateIndex: 2, file: 'src/routes.ts' },
      ],
      instructions: 'Harmonize types and imports',
      callLlm: mockCallLlm,
      judgeSlot: { provider: 'p-judge', model: 'm-judge' },
      options: { autoPromote: false },
    })

    assert.equal(assembleRes.ok, true)
    assert.equal(assembleRes.runId, runId)
    assert.equal(assembleRes.selectedCount, 2)
    assert.equal(assembleRes.gluedFiles.length, 2)
    assert.equal(assembleRes.judgeAudit.passed, true)
    assert.equal(assembleRes.judgeAudit.score, 9)

    // Verify glued files written to .moa/<runId>/workbench-glue
    const gluedAuth = await fs.readFile(path.join(tmpDir, '.moa', runId, 'workbench-glue', 'src', 'auth.ts'), 'utf8')
    assert.match(gluedAuth, /harmonized-jwt-token/)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('Feature #251: HTTP routes GET /dsh-moa/runs/:id/workbench and POST .../assemble', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-workbench-routes-'))
  const runId = 'test-wb-route-run'

  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'index.html', content: '<h1>Hello</h1>' },
    ], { runId })

    await recordMoaRunAsync({
      id: runId,
      cwd: tmpDir,
      prompt: 'Build website',
      preset: 'default',
      candidates: [
        { index: 1, provider: 'p1', model: 'm1', label: 'Candidate 1', files: ['index.html'] },
      ],
      winnerIndex: 1,
      aggregator: { provider: 'pj', model: 'mj' },
    })
    invalidateHistoryCache()

    // Mock WebServer registering handlers
    const registered = []
    const mockWebServer = {
      register: (entry) => {
        registered.push(entry)
        return () => {}
      },
    }

    const mockCtx = {
      webServer: mockWebServer,
      effect: (fn) => fn(),
      connection: {
        requestRejection: () => undefined,
      },
      reflect: {
        get: (key) => (key === 'connection' ? { requestRejection: () => undefined } : undefined),
      },
      baseDir: tmpDir,
    }

    registerMoaRoutes(mockCtx, {
      live: () => ({ enabled: true, presets: [{ name: 'default' }] }),
      callLlm: async () => 'VERDICT: PASSED\nAUDIT_SCORE: 8\nAUDIT_NOTES: OK',
      workspaceRoot: tmpDir,
    })

    const runsRoute = registered.find((r) => r.path === '/dsh-moa/runs')
    assert.ok(runsRoute, 'prefix /dsh-moa/runs must be registered')

    // 1. GET workbench data
    let resCode = 0, resBody = null
    const mockRes = {
      writeHead: (code) => { resCode = code },
      end: (data) => { resBody = JSON.parse(data) },
    }
    const mockReqGet = {
      method: 'GET',
      url: `/dsh-moa/runs/${runId}/workbench`,
      headers: { host: '127.0.0.1:3000' },
      socket: { remoteAddress: '127.0.0.1' },
    }

    await runsRoute.handler(mockReqGet, mockRes)
    assert.equal(resCode, 200)
    assert.equal(resBody.ok, true)
    assert.equal(resBody.runId, runId)
    assert.equal(resBody.candidates.length, 1)
    assert.equal(resBody.candidates[0].files[0].relativePath, 'index.html')

    // 2. POST assemble rejected if cross-site
    let postCode = 0, postBody = null
    const mockResPost = {
      writeHead: (code) => { postCode = code },
      end: (data) => { postBody = JSON.parse(data) },
    }
    const mockReqPostBad = {
      method: 'POST',
      url: `/dsh-moa/runs/${runId}/workbench/assemble`,
      headers: { host: '127.0.0.1:3000', origin: 'http://malicious.com' },
      socket: { remoteAddress: '127.0.0.1' },
    }

    await runsRoute.handler(mockReqPostBad, mockResPost)
    assert.equal(postCode, 403, 'Cross-site assemble request must be rejected with 403')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})


test('Issue #263: /dsh-moa/runs route handles Cordis-like proxy throwing on un-injected baseDir', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-cordis-proxy-'))
  const runId = 'test-wb-cordis-proxy-run'

  try {
    await writeCandidateWorkspace(tmpDir, 1, [
      { relativePath: 'src/main.ts', content: 'console.log("hello")' },
    ], { runId })

    await recordMoaRunAsync({
      id: runId,
      cwd: tmpDir,
      prompt: 'Test cordis context proxy',
      preset: 'default',
      candidates: [
        { index: 1, provider: 'p1', model: 'm1', label: 'Candidate 1', files: ['src/main.ts'] },
      ],
      winnerIndex: 1,
      aggregator: { provider: 'pj', model: 'mj' },
    })
    invalidateHistoryCache()

    const registered = []
    const cordisProxyCtx = new Proxy({
      webServer: { register: (entry) => { registered.push(entry); return () => {} } },
      effect: (fn) => fn(),
      connection: { requestRejection: () => undefined },
      reflect: { get: (k, mustInject) => undefined },
    }, {
      get(target, prop) {
        if (prop in target) return target[prop]
        throw new Error(`cannot get property "${String(prop)}" without inject`)
      }
    })

    registerMoaRoutes(cordisProxyCtx, {
      live: () => ({ enabled: true, presets: [{ name: 'default' }] }),
      callLlm: async () => 'VERDICT: PASSED\nAUDIT_SCORE: 8\nAUDIT_NOTES: OK',
      // note workspaceRoot is NOT passed, simulating DSH production startup
    })

    const runsRoute = registered.find((r) => r.path === '/dsh-moa/runs')
    assert.ok(runsRoute, 'prefix /dsh-moa/runs must be registered')

    let resCode = 0, resBody = null
    const mockRes = {
      writeHead: (code) => { resCode = code },
      end: (data) => { resBody = JSON.parse(data) },
    }
    const mockReq = {
      method: 'GET',
      url: `/dsh-moa/runs/${runId}/workbench`,
      headers: { host: '127.0.0.1:3000' },
      socket: { remoteAddress: '127.0.0.1' },
    }

    // Must NOT throw "cannot get property 'baseDir' without inject"
    await runsRoute.handler(mockReq, mockRes)
    assert.equal(resCode, 200)
    assert.equal(resBody.ok, true)
    assert.equal(resBody.runId, runId)
    assert.equal(resBody.candidates.length, 1)
    assert.equal(resBody.candidates[0].files[0].relativePath, 'src/main.ts')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
