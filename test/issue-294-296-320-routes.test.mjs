import test from 'node:test'
import assert from 'node:assert/strict'
import { registerBattleRoutes } from '../lib/routes/battle.js'
import { registerMixerRoutes } from '../lib/routes/mixer.js'
import { registerTimelineRoutes } from '../lib/routes/timeline.js'
import { registerMoaRoutes } from '../lib/routes.js'

test('Issue #294, #296, #320: Route registration dispatches battle, mixer, and timeline routes', () => {
  const registeredRoutes = []
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      register: (spec) => {
        registeredRoutes.push(spec)
        return () => {}
      }
    }
  }

  registerBattleRoutes(mockCtx)
  registerMixerRoutes(mockCtx)
  registerTimelineRoutes(mockCtx)

  const paths = registeredRoutes.map((r) => r.path)

  // Issue #294: Battle Arena
  assert.ok(paths.includes('/dsh-moa/arena'), 'Must register /dsh-moa/arena')

  // Issue #296: Block Mixer
  assert.ok(paths.includes('/dsh-moa/mixer'), 'Must register /dsh-moa/mixer')

  // Issue #320: Decision Timeline
  assert.ok(paths.includes('/dsh-moa/timeline'), 'Must register /dsh-moa/timeline')
})

test('Issue #294, #296, #320: registerMoaRoutes includes all three new subsystems', () => {
  const registeredPaths = []
  const mockCtx = {
    effect: (fn) => fn(),
    webServer: {
      register: (spec) => {
        registeredPaths.push(spec.path)
        return () => {}
      }
    }
  }

  registerMoaRoutes(mockCtx, {
    live: () => ({ enabled: true, presets: [] }),
    callLlm: async () => {},
  })

  assert.ok(registeredPaths.includes('/dsh-moa/arena'))
  assert.ok(registeredPaths.includes('/dsh-moa/mixer'))
  assert.ok(registeredPaths.includes('/dsh-moa/timeline'))
})
