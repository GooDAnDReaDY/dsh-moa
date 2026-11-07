import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  recordTimelineStage,
  getTimelineSession,
  listTimelineSessions,
  forkTimelineSession
} from '../lib/pipeline/decision-timeline.js'

test('Issue #320: Records phase snapshots and tracks progression stages', () => {
  const tmpFile = path.join(os.tmpdir(), `test_timeline_${Date.now()}.json`)
  try {
    const sessionId = `session_${Date.now()}`
    
    // Stage 1: candidates
    const s1 = recordTimelineStage(sessionId, 'candidates', { count: 3 }, {
      customPath: tmpFile,
      metadata: { prompt: 'Design database schema' }
    })
    assert.equal(s1.stage, 'candidates')
    assert.equal(s1.index, 0)

    // Stage 2: critique
    const s2 = recordTimelineStage(sessionId, 'critique', { debateRounds: 2 }, {
      customPath: tmpFile
    })
    assert.equal(s2.stage, 'critique')
    assert.equal(s2.index, 1)

    // Stage 3: synthesis
    const s3 = recordTimelineStage(sessionId, 'synthesis', { winner: 'modelA' }, {
      persist: true,
      customPath: tmpFile
    })
    assert.equal(s3.stage, 'synthesis')

    const session = getTimelineSession(sessionId, tmpFile)
    assert.ok(session)
    assert.equal(session.stages.length, 3)
    assert.equal(session.prompt, 'Design database schema')

    const list = listTimelineSessions(tmpFile)
    assert.ok(list.some((s) => s.sessionId === sessionId))
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  }
})

test('Issue #320: Forking timeline session creates isolated branch at chosen stage', () => {
  const tmpFile = path.join(os.tmpdir(), `test_timeline_fork_${Date.now()}.json`)
  try {
    const rootId = `root_${Date.now()}`
    recordTimelineStage(rootId, 'candidates', { c: 1 }, { customPath: tmpFile })
    recordTimelineStage(rootId, 'critique', { c: 2 }, { customPath: tmpFile })
    recordTimelineStage(rootId, 'synthesis', { c: 3 }, { persist: true, customPath: tmpFile })

    // Fork from critique stage (index 1)
    const forkRes = forkTimelineSession(rootId, 1, { prompt: 'Alternative prompt' }, tmpFile)
    assert.equal(forkRes.ok, true)
    assert.ok(forkRes.forkedSessionId.startsWith('fork_'))
    assert.equal(forkRes.session.stages.length, 2)
    assert.equal(forkRes.session.forkedFromStage, 'critique')
    assert.equal(forkRes.session.parentSessionId, rootId)
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  }
})
