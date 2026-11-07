import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  detectProjectStack,
  getStackPersonaSpecialties,
  assignStackAwarePersonas,
  formatStackAwareDirective,
} from '../lib/pipeline/manifest-stack.js'

test('detectProjectStack: detects TypeScript, React, Tailwind, and Zod from package.json', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-stack-ts-'))
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: {
          react: '^18.3.1',
          next: '^14.2.0',
          zod: '^3.23.0',
        },
        devDependencies: {
          typescript: '^5.5.0',
          tailwindcss: '^3.4.0',
          vitest: '^1.6.0',
        },
      }),
      'utf8'
    )

    const res = detectProjectStack(tmpDir)
    assert.equal(res.manifestFound, true)
    assert.equal(res.primaryLanguage, 'typescript')
    assert.ok(res.frameworks.includes('next.js'))
    assert.ok(res.libraries.includes('tailwindcss'))
    assert.ok(res.libraries.includes('zod'))
    assert.ok(res.libraries.includes('vitest'))
    assert.ok(res.stackSummary.includes('typescript'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('detectProjectStack: detects Python FastAPI stack from pyproject.toml and requirements.txt', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-stack-py-'))
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'requirements.txt'),
      'fastapi>=0.111.0\npydantic>=2.7.0\npytest>=8.2.0\nsqlalchemy>=2.0.0\n',
      'utf8'
    )

    const res = detectProjectStack(tmpDir)
    assert.equal(res.manifestFound, true)
    assert.equal(res.primaryLanguage, 'python')
    assert.ok(res.frameworks.includes('fastapi'))
    assert.ok(res.libraries.includes('pydantic'))
    assert.ok(res.libraries.includes('pytest'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('detectProjectStack: detects Rust Axum stack from Cargo.toml', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-stack-rs-'))
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'Cargo.toml'),
      '[package]\nname = "my_app"\n[dependencies]\naxum = "0.7"\ntokio = { version = "1", features = ["full"] }\nserde = "1.0"\n',
      'utf8'
    )

    const res = detectProjectStack(tmpDir)
    assert.equal(res.manifestFound, true)
    assert.equal(res.primaryLanguage, 'rust')
    assert.ok(res.frameworks.includes('axum'))
    assert.ok(res.libraries.includes('tokio'))
    assert.ok(res.libraries.includes('serde'))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('detectProjectStack: safely handles directory without manifest', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-stack-none-'))
  try {
    const res = detectProjectStack(tmpDir)
    assert.equal(res.manifestFound, false)
    assert.equal(res.primaryLanguage, 'unknown')
    assert.equal(res.stackSummary, '')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('assignStackAwarePersonas: evolves proposer slots with specialized personas based on stack', () => {
  const stackInfo = {
    manifestFound: true,
    primaryLanguage: 'typescript',
    frameworks: ['react'],
    libraries: ['typescript', 'tailwindcss'],
    stackSummary: 'typescript | framework: react | libs: typescript, tailwindcss',
  }

  const rawRefs = [
    { provider: 'p1', model: 'm1' },
    { provider: 'p2', model: 'm2' },
    { provider: 'p3', model: 'm3' },
  ]

  const evolved = assignStackAwarePersonas(rawRefs, stackInfo, { enabled: true })
  assert.equal(evolved.isSpecialized, true)
  assert.equal(evolved.references.length, 3)
  assert.ok(evolved.references[0].role_persona.includes('Component Architecture'))
  assert.ok(evolved.references[1].role_persona.includes('TypeScript Strict Typing'))
  assert.ok(evolved.references[2].role_persona.includes('Accessibility'))
})

test('assignStackAwarePersonas: preserves user-specified custom persona', () => {
  const stackInfo = {
    manifestFound: true,
    primaryLanguage: 'python',
    frameworks: ['fastapi'],
    libraries: ['pydantic'],
    stackSummary: 'python | framework: fastapi',
  }

  const rawRefs = [
    { provider: 'p1', model: 'm1', role_persona: 'Custom Security Auditor' },
    { provider: 'p2', model: 'm2' },
  ]

  const evolved = assignStackAwarePersonas(rawRefs, stackInfo, { enabled: true })
  assert.equal(evolved.references[0].role_persona, 'Custom Security Auditor')
  assert.ok(evolved.references[1].role_persona.includes('Schema Validation') || evolved.references[1].role_persona.includes('Architect'))
})

test('formatStackAwareDirective: returns null when no manifest found', () => {
  assert.equal(formatStackAwareDirective({ manifestFound: false }), null)
})
