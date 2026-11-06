import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isGitRepository,
  executeTestInSandbox,
  executeCandidateInWorktree,
  formatTournamentDirective,
  runGitTournamentGate,
} from '../lib/pipeline/git-tournament.js'
import { MOA_EVENTS } from '../lib/events.js'

describe('Issue #304: Multi-Branch Git Sandbox Tournament', () => {
  it('isGitRepository: accurately checks if cwd is a git repository', async () => {
    const mockExecGit = async () => ({ stdout: 'true\n', stderr: '' })
    const isGit = await isGitRepository('/test/repo', mockExecGit)
    assert.equal(isGit, true)

    const mockExecFail = async () => { throw new Error('not a git repository') }
    const isNotGit = await isGitRepository('/test/non-git', mockExecFail)
    assert.equal(isNotGit, false)
  })

  it('executeTestInSandbox: runs test command and captures exitCode, duration, and output', async () => {
    const mockExec = async (cmd, args, opts) => {
      return { stdout: 'All 15 tests passed!\n', stderr: '' }
    }
    const res = await executeTestInSandbox('npm test', '/test', 5000, mockExec)
    assert.equal(res.passed, true)
    assert.equal(res.exitCode, 0)
    assert.ok(res.output.includes('All 15 tests passed!'))
    assert.ok(res.durationMs >= 0)
  })

  it('executeTestInSandbox: captures failure exitCode and error output cleanly', async () => {
    const mockExec = async () => {
      const err = new Error('Command failed: npm test')
      err.code = 1
      err.stderr = 'AssertionError: expected true === false'
      throw err
    }
    const res = await executeTestInSandbox('npm test', '/test', 5000, mockExec)
    assert.equal(res.passed, false)
    assert.equal(res.exitCode, 1)
    assert.ok(res.output.includes('AssertionError'))
  })

  it('executeCandidateInWorktree: sets up worktree, writes candidate files, and cleans up', async () => {
    const executedCommands = []
    const mockExec = async (file, args, opts) => {
      executedCommands.push({ file, args })
      if (args && args.includes('npm test')) {
        return { stdout: 'Tests passed\n', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    }

    const candidate = {
      index: 1,
      label: 'Model A',
      files: [{ relativePath: 'src/sum.js', content: 'export function sum(a, b) { return a + b; }' }],
    }

    const res = await executeCandidateInWorktree({
      candidate,
      cwd: '/tmp',
      testCommand: 'npm test',
      timeoutMs: 10000,
      runId: 'tourn-test-1',
      execFn: mockExec,
    })

    assert.equal(res.candidateIndex, 1)
    assert.equal(res.testResult.passed, true)

    // Verify git worktree add and git worktree remove were called
    const added = executedCommands.find((c) => c.args?.[0] === 'worktree' && c.args?.[1] === 'add')
    const removed = executedCommands.find((c) => c.args?.[0] === 'worktree' && c.args?.[1] === 'remove')
    const branchDeleted = executedCommands.find((c) => c.args?.[0] === 'branch' && c.args?.[1] === '-D')

    assert.ok(added, 'Must create worktree with git worktree add')
    assert.ok(removed, 'Must clean up worktree with git worktree remove')
    assert.ok(branchDeleted, 'Must clean up temporary branch with git branch -D')
  })

  it('formatTournamentDirective: formats results into a clear arbitration directive', () => {
    const results = [
      { label: 'Candidate 1', testResult: { passed: true, exitCode: 0, durationMs: 1420 } },
      { label: 'Candidate 2', testResult: { passed: false, exitCode: 1, durationMs: 820, output: 'SyntaxError: unexpected token' } },
    ]

    const directive = formatTournamentDirective(results, 'npm test')
    assert.ok(directive.includes('=== 🏆 MULTI-BRANCH GIT SANDBOX TOURNAMENT REPORT ==='))
    assert.ok(directive.includes('Candidate 1: ✅ PASSED (Exit code: 0, Duration: 1420ms)'))
    assert.ok(directive.includes('Candidate 2: ❌ FAILED (Exit code: 1, Duration: 820ms)'))
    assert.ok(directive.includes('SyntaxError'))
    assert.ok(directive.includes('CRITICAL JUDGE ARBITRATION DIRECTIVE:'))
  })

  it('runGitTournamentGate: orchestrates tournament and emits TOURNAMENT_COMPLETE event', async () => {
    const events = []
    const mockCtx = {
      emit: (evt, payload) => events.push({ evt, payload }),
    }

    const mockExec = async (file, args) => {
      if (args && args.includes('--is-inside-work-tree')) {
        return { stdout: 'true\n' }
      }
      return { stdout: 'Tests ok\n' }
    }

    const candidates = [
      { index: 1, label: 'Model A', text: 'code 1' },
      { index: 2, label: 'Model B', text: 'code 2' },
    ]

    const res = await runGitTournamentGate({
      candidates,
      preset: {
        git_tournament_enabled: true,
        git_tournament_command: 'npm test',
      },
      cwd: '/tmp',
      ctx: mockCtx,
      execFn: mockExec,
    })

    assert.equal(res.ok, true)
    assert.equal(res.tournamentResults.length, 2)
    assert.ok(res.tournamentDirective.includes('MULTI-BRANCH GIT SANDBOX TOURNAMENT REPORT'))

    const evt = events.find((e) => e.evt === MOA_EVENTS.TOURNAMENT_COMPLETE)
    assert.ok(evt, 'Expected TOURNAMENT_COMPLETE event')
    assert.equal(evt.payload.totalCandidates, 2)
  })
})
