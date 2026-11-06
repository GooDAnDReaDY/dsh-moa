import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runMoAPipeline } from '../lib/pipeline/runner.js'
import { MOA_EVENTS } from '../lib/events.js'

const execFileAsync = promisify(execFile)

describe('Issue #304 and #313 Pipeline Integration', () => {
  it('Git Tournament & Role Council: executes tournament in real git worktree & council gates and informs Judge', async () => {
    const tempGitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-tourn-git-'))
    try {
      await execFileAsync('git', ['init'], { cwd: tempGitDir })
      await execFileAsync('git', ['config', 'user.name', 'test'], { cwd: tempGitDir })
      await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempGitDir })
      await fs.writeFile(
        path.join(tempGitDir, 'package.json'),
        JSON.stringify({ name: 'tourn-test', scripts: { test: 'node -e "process.exit(0)"' } })
      )
      await execFileAsync('git', ['add', '.'], { cwd: tempGitDir })
      await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: tempGitDir })

      const events = []
      const mockCtx = {
        emit: (evt, payload) => events.push({ evt, payload }),
      }

      let judgeSawTournamentDirective = false
      let judgeSawCouncilDirective = false

      const mockCallLlm = async (params) => {
        // Judge model call
        if (params.model === 'judge-model') {
          const content = params.messages[0].content
          if (content.includes('MULTI-BRANCH GIT SANDBOX TOURNAMENT REPORT')) {
            judgeSawTournamentDirective = true
          }
          if (content.includes('MULTI-PERSONA ROLE-PLAYING COUNCIL ARBITRATION')) {
            judgeSawCouncilDirective = true
          }
          return {
            text: 'Winner: Candidate 1\nWINNER_CANDIDATE_INDEX: 1\nSynthesis complete.',
            usage: { inputTokens: 250, outputTokens: 80 },
          }
        }

        // Candidate models
        return {
          text: '```javascript file="app.js"\nexport function start() { return "ok"; }\n```',
          usage: { inputTokens: 50, outputTokens: 50 },
        }
      }

      const preset = {
        name: 'test-tourn-council',
        enabled: true,
        ask_clarifying_questions: false,
        reference_models: [
          { provider: 'test', model: 'mock-a' },
          { provider: 'test', model: 'mock-b' },
        ],
        aggregator: { provider: 'test', model: 'judge-model' },
        git_tournament_enabled: true,
        git_tournament_command: 'npm test',
        council_arbitration_enabled: true,
        council_weight_architect: 40,
        council_weight_security: 40,
        council_weight_minimalist: 20,
      }

      const payload = await runMoAPipeline({
        userPrompt: 'Build app start feature',
        preset,
        callLlm: mockCallLlm,
        cwd: tempGitDir,
        ctx: mockCtx,
      })

      assert.equal(payload.kind, 'synthesis')
      assert.equal(judgeSawTournamentDirective, true, 'Judge must receive git tournament directive')
      assert.equal(judgeSawCouncilDirective, true, 'Judge must receive council arbitration directive')

      const tournEvt = events.find((e) => e.evt === MOA_EVENTS.TOURNAMENT_COMPLETE)
      assert.ok(tournEvt, 'Expected TOURNAMENT_COMPLETE event')
      assert.equal(tournEvt.payload.totalCandidates, 2)

      const councilEvt = events.find((e) => e.evt === MOA_EVENTS.COUNCIL_VERDICT)
      assert.ok(councilEvt, 'Expected COUNCIL_VERDICT event')
      assert.equal(councilEvt.payload.weights.architect, 40)
      assert.equal(councilEvt.payload.weights.security, 40)
      assert.equal(councilEvt.payload.weights.minimalist, 20)
    } finally {
      await fs.rm(tempGitDir, { recursive: true, force: true }).catch(() => {})
    }
  })
})
