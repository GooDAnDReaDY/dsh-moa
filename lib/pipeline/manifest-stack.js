/**
 * Stack-Aware Dynamic Persona Evolution from Project Manifests (#308)
 *
 * Scans project manifests (package.json, Cargo.toml, pyproject.toml, requirements.txt, go.mod)
 * in the workspace root to infer primary programming languages, frameworks, ORMs,
 * and test suites. Evolves candidate proposers into specialized domain experts
 * (e.g. React Optimization, TypeScript Strict Safety, Accessibility, FastAPI Async)
 * to maximize architectural hypothesis diversity.
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * Scans workspace root manifests to detect project languages and dependencies.
 *
 * @param {string} cwd - Workspace root directory
 * @returns {object} Detected stack information
 */
export function detectProjectStack(cwd = process.cwd()) {
  const stack = {
    primaryLanguage: 'unknown',
    frameworks: [],
    libraries: [],
    manifestFound: false,
    stackSummary: '',
  }

  if (!cwd || typeof cwd !== 'string') return stack

  // 1. Node / JavaScript / TypeScript (package.json)
  const pkgPath = path.join(cwd, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf8')
      const pkg = JSON.parse(raw)
      stack.manifestFound = true
      stack.primaryLanguage = 'javascript'

      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
        ...(pkg.peerDependencies || {}),
      }

      if (allDeps.typescript || fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
        stack.primaryLanguage = 'typescript'
        stack.libraries.push('typescript')
      }

      // Frameworks
      if (allDeps.next) stack.frameworks.push('next.js')
      else if (allDeps.react) stack.frameworks.push('react')

      if (allDeps.nuxt) stack.frameworks.push('nuxt')
      else if (allDeps.vue) stack.frameworks.push('vue')

      if (allDeps['@sveltejs/kit']) stack.frameworks.push('sveltekit')
      else if (allDeps.svelte) stack.frameworks.push('svelte')

      if (allDeps['@angular/core']) stack.frameworks.push('angular')
      if (allDeps['@nestjs/core']) stack.frameworks.push('nestjs')
      if (allDeps.fastify) stack.frameworks.push('fastify')
      if (allDeps.express) stack.frameworks.push('express')

      // Styling & UI
      if (allDeps.tailwindcss) stack.libraries.push('tailwindcss')

      // ORM & Data
      if (allDeps.prisma || allDeps['@prisma/client']) stack.libraries.push('prisma')
      if (allDeps['drizzle-orm']) stack.libraries.push('drizzle')
      if (allDeps.typeorm) stack.libraries.push('typeorm')
      if (allDeps.mongoose) stack.libraries.push('mongoose')

      // Validation
      if (allDeps.zod) stack.libraries.push('zod')
      if (allDeps.valibot) stack.libraries.push('valibot')

      // Testing
      if (allDeps.vitest) stack.libraries.push('vitest')
      if (allDeps.jest) stack.libraries.push('jest')
      if (allDeps.playwright || allDeps['@playwright/test']) stack.libraries.push('playwright')
    } catch {
      // safe fallback on corrupted package.json
    }
  }

  // 2. Rust (Cargo.toml)
  const cargoPath = path.join(cwd, 'Cargo.toml')
  if (fs.existsSync(cargoPath)) {
    try {
      const content = fs.readFileSync(cargoPath, 'utf8')
      stack.manifestFound = true
      stack.primaryLanguage = 'rust'

      if (content.includes('axum')) stack.frameworks.push('axum')
      if (content.includes('actix-web')) stack.frameworks.push('actix-web')
      if (content.includes('tokio')) stack.libraries.push('tokio')
      if (content.includes('serde')) stack.libraries.push('serde')
      if (content.includes('sqlx')) stack.libraries.push('sqlx')
      if (content.includes('diesel')) stack.libraries.push('diesel')
    } catch {
      // safe fallback
    }
  }

  // 3. Python (pyproject.toml, requirements.txt)
  const pyprojectPath = path.join(cwd, 'pyproject.toml')
  const reqPath = path.join(cwd, 'requirements.txt')
  if (fs.existsSync(pyprojectPath) || fs.existsSync(reqPath)) {
    try {
      const pyContent = (fs.existsSync(pyprojectPath) ? fs.readFileSync(pyprojectPath, 'utf8') : '') +
        '\n' + (fs.existsSync(reqPath) ? fs.readFileSync(reqPath, 'utf8') : '')
      stack.manifestFound = true
      if (stack.primaryLanguage === 'unknown') stack.primaryLanguage = 'python'

      if (pyContent.includes('fastapi')) stack.frameworks.push('fastapi')
      if (pyContent.includes('django')) stack.frameworks.push('django')
      if (pyContent.includes('flask')) stack.frameworks.push('flask')
      if (pyContent.includes('pydantic')) stack.libraries.push('pydantic')
      if (pyContent.includes('sqlalchemy')) stack.libraries.push('sqlalchemy')
      if (pyContent.includes('pytest')) stack.libraries.push('pytest')
      if (pyContent.includes('torch')) stack.libraries.push('pytorch')
      if (pyContent.includes('pandas')) stack.libraries.push('pandas')
    } catch {
      // safe fallback
    }
  }

  // 4. Go (go.mod)
  const goModPath = path.join(cwd, 'go.mod')
  if (fs.existsSync(goModPath)) {
    try {
      const goContent = fs.readFileSync(goModPath, 'utf8')
      stack.manifestFound = true
      if (stack.primaryLanguage === 'unknown') stack.primaryLanguage = 'go'

      if (goContent.includes('gin-gonic/gin')) stack.frameworks.push('gin')
      if (goContent.includes('gofiber/fiber')) stack.frameworks.push('fiber')
      if (goContent.includes('labstack/echo')) stack.frameworks.push('echo')
      if (goContent.includes('gorm.io/gorm')) stack.libraries.push('gorm')
      if (goContent.includes('stretchr/testify')) stack.libraries.push('testify')
    } catch {
      // safe fallback
    }
  }

  // Build summary string
  const parts = []
  if (stack.primaryLanguage !== 'unknown') parts.push(stack.primaryLanguage)
  if (stack.frameworks.length > 0) parts.push(`framework: ${stack.frameworks.join(', ')}`)
  if (stack.libraries.length > 0) parts.push(`libs: ${stack.libraries.slice(0, 4).join(', ')}`)
  stack.stackSummary = parts.join(' | ')

  return stack
}

/**
 * Returns specialized domain personas based on detected stack.
 *
 * @param {object} stackInfo
 * @returns {Array<string>} Array of specialized persona role descriptions
 */
export function getStackPersonaSpecialties(stackInfo = {}) {
  const lang = stackInfo.primaryLanguage || 'unknown'
  const frameworks = Array.isArray(stackInfo.frameworks) ? stackInfo.frameworks : []
  const libs = Array.isArray(stackInfo.libraries) ? stackInfo.libraries : []

  // React / Next.js / Frontend
  if (frameworks.includes('react') || frameworks.includes('next.js') || frameworks.includes('vue') || frameworks.includes('svelte')) {
    return [
      'Component Architecture, Hooks & Re-render Optimization Specialist',
      libs.includes('typescript') || lang === 'typescript'
        ? 'TypeScript Strict Typing, Generic Invariants & Defensive Schema Expert'
        : 'State Management, Data Flow & Edge-Case Specialist',
      'Accessibility (a11y), Semantic UI & Modern CSS Performance Reviewer',
    ]
  }

  // Python / FastAPI / Django
  if (lang === 'python') {
    return [
      frameworks.includes('fastapi')
        ? 'FastAPI Async Concurrency & High-Throughput REST Architect'
        : 'Pythonic Clean Architecture & Idiomatic Object Design Specialist',
      libs.includes('pydantic')
        ? 'Pydantic V2 Schema Validation & Type-Safe Domain Modeler'
        : 'Defensive Data Integrity & Error Boundary Engineer',
      libs.includes('pytest')
        ? 'Pytest Fixtures, Mocking & Comprehensive Edge-Case Test Engineer'
        : 'Performance Profiling & Memory Leak Auditor',
    ]
  }

  // Rust
  if (lang === 'rust') {
    return [
      'Rust Zero-Cost Abstractions & Concurrency Architect',
      'Rust Memory Safety, Error Handling & Lifetime Specialist',
      'Rust Idiomatic API & Performance Specialist',
    ]
  }

  // Go
  if (lang === 'go') {
    return [
      'Go Idiomatic Concurrency & Channel Synchronization Architect',
      'Go Interface Design, Error Wrapping & Zero-Allocation Specialist',
      'Go Production Reliability & Table-Driven Unit Testing Specialist',
    ]
  }

  // General TypeScript / Node
  if (lang === 'typescript') {
    return [
      'TypeScript Strict Type Safety & Clean Architecture Specialist',
      'Async Flow, Micro-Optimization & Error Boundary Engineer',
      'Maintainability, Modularity & Test Coverage Auditor',
    ]
  }

  // Universal Default
  return [
    'System Architecture & Core Correctness Engineer',
    'Edge-Case Analysis & Defensive Error Handling Specialist',
    'Clean Code, Maintainability & Documentation Specialist',
  ]
}

/**
 * Assigns stack-aware specialized personas to candidate proposer slots.
 *
 * @param {Array<object>} references - Proposer slots
 * @param {object} stackInfo - Output of detectProjectStack
 * @param {object} [options]
 * @param {boolean} [options.enabled=true] - Whether stack-aware personas are enabled
 * @returns {{ references: Array<object>, isSpecialized: boolean, stackSummary: string }}
 */
export function assignStackAwarePersonas(references = [], stackInfo = {}, options = {}) {
  const { enabled = true } = options

  if (!enabled || !Array.isArray(references) || references.length === 0) {
    return {
      references: Array.isArray(references) ? references : [],
      isSpecialized: false,
      stackSummary: stackInfo.stackSummary || '',
    }
  }

  const specialties = getStackPersonaSpecialties(stackInfo)
  const evolved = references.map((slot, idx) => {
    // If user already specified a custom non-default persona, preserve it
    const hasCustom = slot.role_persona && slot.role_persona !== 'general' && slot.role_persona !== 'proposer'
    if (hasCustom) {
      return { ...slot }
    }

    const specialty = specialties[idx % specialties.length]
    return {
      ...slot,
      role_persona: specialty,
      stackSpecialization: specialty,
    }
  })

  return {
    references: evolved,
    isSpecialized: Boolean(stackInfo.manifestFound),
    stackSummary: stackInfo.stackSummary || '',
  }
}

/**
 * Formats a directive summarizing the project stack for injection into judge or synthesis prompts.
 *
 * @param {object} stackInfo
 * @returns {string|null}
 */
export function formatStackAwareDirective(stackInfo = {}) {
  if (!stackInfo || !stackInfo.manifestFound || !stackInfo.stackSummary) {
    return null
  }

  return `### Project Stack & Architecture Context
- Detected Environment: ${stackInfo.stackSummary}
- Verification Requirement: All proposals must adhere to the conventions and idiomatic idioms of this technology stack.`
}
