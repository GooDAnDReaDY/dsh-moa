import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

test('package identity matches across package.json, cordis.patch.yml, and client.js', () => {
  const pkgPath = path.join(root, 'package.json')
  const patchPath = path.join(root, 'cordis.patch.yml')
  const clientPath = path.join(root, 'lib/client.js')

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const patch = fs.readFileSync(patchPath, 'utf8')
  const client = fs.readFileSync(clientPath, 'utf8')

  const expectedName = '@goodandready/dsh-moa'
  assert.equal(pkg.name, expectedName, 'package.json name matches')
  assert.ok(patch.includes(`name: '${expectedName}'`) || patch.includes(`name: "${expectedName}"`), 'cordis.patch.yml contains exact name')
  assert.ok(client.includes(`id: '${expectedName}'`) || client.includes(`id: "${expectedName}"`), 'lib/client.js load id contains exact name')
})

test('client module loads and registers slot and trigger without syntax errors', () => {
  const clientPath = path.join(root, 'lib/client.js')
  const clientSrc = fs.readFileSync(clientPath, 'utf8')

  let loadedModule = null
  const fakeReact = {
    createElement: (type, props, ...children) => {
      if (typeof type === 'function') {
        if (type.prototype && type.prototype.render) {
          const inst = new type(Object.assign({}, props, { children }))
          return inst.render()
        }
        return type(Object.assign({}, props, { children }))
      }
      return { type, props, children }
    },
    useState: (val) => [typeof val === 'function' ? val() : val, () => {}],
    useEffect: (fn) => { try { fn() } catch (_) {} },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (val) => ({ current: val }),
    useId: () => 'id-1',
    Fragment: 'Fragment',
    Component: class {
      constructor(props) { this.props = props; this.state = {}; }
      setState(next) { Object.assign(this.state, typeof next === 'function' ? next(this.state) : next); }
      render() { return this.props.children; }
    },
  }

  const fakeWindow = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        assert.equal(id, '@goodandready/dsh-moa')
        const fakeRequire = (name) => {
          if (name === 'react') return fakeReact
          if (name === '@deepseek-ai/dsh-client-ui-primitives') {
            return { IconChevronDownOutline14: () => ({}) }
          }
          throw new Error(`Unexpected require: ${name}`)
        }
        loadedModule = factory(fakeRequire)
      },
    },
  }

  const context = vm.createContext({
    window: fakeWindow,
    document: { head: { appendChild: () => {} }, createElement: () => ({ set textContent(_) {} }), addEventListener: () => {}, removeEventListener: () => {} },
    console,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
  })

  const script = new vm.Script(clientSrc)
  script.runInContext(context)

  assert.ok(loadedModule, 'Module was successfully loaded by factory')
  assert.ok(Array.isArray(loadedModule.inject), 'exports.inject is defined')
  assert.equal(typeof loadedModule.apply, 'function', 'exports.apply is a function')

  // Test apply execution
  const slotsRegistered = []
  const triggersRegistered = []
  const localesRegistered = {}
  const mockCtx = {
    slots: {
      inject: (_name, fn) => fn(),
      register: (meta, comp) => {
        slotsRegistered.push({ meta, comp })
      },
    },
    locale: {
      register: (ns, localeOrDicts, dicts) => {
        localesRegistered[ns] = dicts || localeOrDicts
      },
      bind: () => (k) => k,
      getSnapshot: () => ({ active: 'ru' }),
    },
    effect: (fn) => fn(),
    get: (svc) => {
      if (svc === 'inputTriggers') {
        return {
          registerSource: () => () => {},
        }
      }
      return null
    },
  }

  loadedModule.apply(mockCtx)
  assert.ok(localesRegistered['dsh-moa'], 'Locale registered for dsh-moa')
  // Two seats by design: the Plugins page row seat the current core renders, and the
  // legacy settings.plugin.item card kept as a fallback for older cores.
  assert.equal(slotsRegistered.length, 2, 'row seat and legacy settings slot registered')
  const names = slotsRegistered.map((s) => s.meta.name)
  assert.deepEqual(names, ['plugins.row.config', 'settings.plugin.item'], 'row seat goes first')
  assert.equal(slotsRegistered[0].meta.key, '@goodandready/dsh-moa#dsh-moa')

  // Test full render of MoACard in expanded/ready state
  const CardComp = slotsRegistered[0].comp
  const stateMap = {
    0: 'ready', // status
    1: [{ name: 'default', reference_models: [{ provider: 'opencode-go', model: 'deepseek-v4-flash' }], aggregator: { provider: 'codex', model: 'gpt-5.6-sol' }, aggregator_temperature: 0.4, reference_temperature: 0.6, judge_criteria: 'strict tests' }],
    2: 'default', // defaultPreset
    3: [{ provider: 'opencode-go', model: 'deepseek-v4-flash', label: 'deepseek-v4-flash' }],
    4: '', // saveStatus
    5: true, // enabled
    6: 'online', // hostStatus
    7: { totalRuns: 0, avgCostUsd: null }, // stats
    8: true, // open=true
  }
  let callIdx = 0
  fakeReact.useState = (initVal) => {
    const idx = callIdx++
    const val = stateMap[idx] !== undefined ? stateMap[idx] : (typeof initVal === 'function' ? initVal() : initVal)
    return [val, () => {}]
  }

  const rendered = CardComp({ ctx: mockCtx, t: (k) => k })
  assert.ok(rendered, 'MoACard renders without uncaught ReferenceError/TypeError')
})

test('no hardcoded machine paths or credentials in tracked source files', () => {
  const checkFiles = [
    'package.json',
    'cordis.patch.yml',
    'lib/moa-runner.js',
    'lib/index.js',
    'lib/client.js',
  ]

  const forbiddenPatterns = [
    /\/home\/vadim/,
    /192\.168\./,
    /localhost:2222/,
    /codex_migrate/,
  ]

  for (const rel of checkFiles) {
    const filePath = path.join(root, rel)
    if (!fs.existsSync(filePath)) continue
    const content = fs.readFileSync(filePath, 'utf8')
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(content),
        false,
        `File ${rel} contains forbidden machine pattern: ${pattern}`
      )
    }
  }
})
