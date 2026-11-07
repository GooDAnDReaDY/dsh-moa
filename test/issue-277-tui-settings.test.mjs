import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTuiSection, applyTuiSettings } from '../lib/tui-settings.js'
import { apply } from '../lib/index.js'

test('issue #277: buildTuiSection returns valid TUI descriptor with presets and toggles', () => {
  const section = buildTuiSection({
    live: () => ({
      enabled: true,
      default_preset: 'deep-reasoning',
      presets: [
        { name: 'default', reference_models: [{ provider: 'p1', model: 'm1' }] },
        { name: 'deep-reasoning', reference_models: [{ provider: 'p1', model: 'm1' }, { provider: 'p2', model: 'm2' }] },
      ],
    }),
  })

  assert.equal(section.ns, 'dsh-moa')
  assert.equal(section.title, 'Mixture of Agents (MoA)')
  assert.ok(Array.isArray(section.groups))
  assert.ok(Array.isArray(section.fields))

  const paths = section.fields.map((f) => f.path.join('.'))
  assert.ok(paths.includes('enabled'))
  assert.ok(paths.includes('default_preset'))
  assert.ok(paths.includes('interactive_workbench_enabled'))
  assert.ok(paths.includes('ask_clarifying_questions'))
  assert.ok(paths.includes('test_gate_enabled'))
  assert.ok(paths.includes('uncertainty_scoring_enabled'))

  const presetField = section.fields.find((f) => f.path[0] === 'default_preset')
  assert.equal(presetField.options.length, 2)
  assert.equal(presetField.options[1].value, 'deep-reasoning')
  assert.deepEqual(presetField.parse('fast'), { kind: 'set', value: 'fast' })

  const wbField = section.fields.find((f) => f.path[0] === 'interactive_workbench_enabled')
  assert.equal(wbField.format(true), 'true')
  assert.equal(wbField.format(false), 'false')
  assert.deepEqual(wbField.parse('true'), { kind: 'set', value: true })
})

test('issue #277: applyTuiSettings registers via ctx.inject(["tuiSettingsSections"])', () => {
  let registeredSection = null
  let disposed = false

  const fakeCtx = {
    inject: (deps, cb) => {
      if (deps.includes('tuiSettingsSections')) {
        cb({
          tuiSettingsSections: {
            register: (sec) => {
              registeredSection = sec
              return () => { disposed = true }
            },
          },
          effect: (fn) => fn(),
        })
      }
    },
  }

  applyTuiSettings(fakeCtx, { live: () => ({ enabled: true }) })
  assert.ok(registeredSection, 'TUI section registered via dynamic inject')
  assert.equal(registeredSection.ns, 'dsh-moa')
})

test('issue #277: apply() registers TUI settings when tuiSettingsSections is present', () => {
  let registeredSection = null
  const fakeCtx = {
    tuiSettingsSections: {
      register: (sec) => {
        registeredSection = sec
        return () => {}
      },
    },
    inject: () => {},
    effect: (fn) => fn(),
    on: () => () => {},
    provide: () => {},
  }

  apply(fakeCtx, { enabled: true })
  assert.ok(registeredSection)
  assert.equal(registeredSection.ns, 'dsh-moa')
})
