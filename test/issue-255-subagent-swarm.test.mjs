import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createSwarmWorktree,
  collectSwarmWorktreeDiff,
  cleanupSwarmWorktrees,
  runSubagentSwarm,
} from '../lib/moa-swarm.js'
import { parseMoACommand } from '../lib/moa-parser.js'
import { PresetSchema } from '../lib/moa-schema.js'

test('issue #255: PresetSchema accepts subagent_swarm_enabled and parser supports --swarm', () => {
  const parsedPreset = PresetSchema({ name: 'swarm-p', subagent_swarm_enabled: true })
  assert.equal(parsedPreset.subagent_swarm_enabled, true)

  const cmd = parseMoACommand('/moa --swarm Refactor authentication layer', [], 'default')
  assert.equal(cmd.isSwarm, true)
  assert.equal(cmd.prompt, 'Refactor authentication layer')
})

test('issue #255: runSubagentSwarm provisions isolated workspaces, collects diffs, and cleans up on completion', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moa-swarm-test-'))
  try {
    const references = [
      { provider: 'p1', model: 'm1' },
      { provider: 'p2', model: 'm2' },
    ]

    const mockCallLlm = async (args) => {
      return `Here is my solution:\n\`\`\`js path=src/${args.model}.js\nexport const model = "${args.model}";\n\`\`\``
    }

    const results = await runSubagentSwarm(
      references,
      [{ role: 'user', content: 'Create module' }],
      { cwd: tmpDir, runId: 'test-swarm-1' },
      mockCallLlm
    )

    assert.equal(results.length, 2)
    assert.equal(results[0].ok, true)
    assert.ok(results[0].modifiedFiles.includes('src/m1.js'))
    assert.ok(results[1].modifiedFiles.includes('src/m2.js'))

    // Verify guaranteed cleanup removed temporary swarm worktrees
    const swarmDir = path.join(tmpDir, '.moa', 'swarm-test-swarm-1')
    assert.equal(existsSync(swarmDir), false, 'Swarm worktree directory must be cleaned up after run')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
