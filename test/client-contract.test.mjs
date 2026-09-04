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
  const fakeWindow = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        assert.equal(id, '@goodandready/dsh-moa')
        const fakeRequire = (name) => {
          if (name === 'react') {
            return {
              createElement: () => ({}),
              useState: (val) => [val, () => {}],
              useEffect: (fn) => { fn() },
              Fragment: 'Fragment',
            }
          }
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
    document: { head: { appendChild: () => {} }, createElement: () => ({ set textContent(_) {} }) },
    console,
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
      register: (ns, dicts) => {
        localesRegistered[ns] = dicts
      },
      bind: () => (k) => k,
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
  assert.equal(slotsRegistered.length, 2, 'Both settings.section and settings.plugin.item slots registered')
  const names = slotsRegistered.map((s) => s.meta.name)
  assert.ok(names.includes('settings.section'))
  assert.ok(names.includes('settings.plugin.item'))
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
