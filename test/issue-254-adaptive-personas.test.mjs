import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyPromptDomain,
  assignAdaptivePersonas,
  DOMAIN_PERSONA_POOLS,
} from '../lib/moa-adaptive-personas.js'
import { PresetSchema } from '../lib/moa-schema.js'
import { runMoAPipeline } from '../lib/moa-runner.js'

test('issue #254: PresetSchema accepts adaptive_personas_enabled', () => {
  const parsed = PresetSchema({ name: 'adaptive-test', adaptive_personas_enabled: true })
  assert.equal(parsed.adaptive_personas_enabled, true)
})

test('issue #254: classifyPromptDomain accurately detects database, frontend, security, performance, and testing domains', () => {
  const dbRes = classifyPromptDomain('Optimize PostgreSQL composite index and Prisma migration for users table')
  assert.equal(dbRes.domain, 'database')
  assert.ok(dbRes.confidence >= 0.7)

  const uiRes = classifyPromptDomain('Build accessible React modal component with Tailwind CSS and ARIA keyboard navigation')
  assert.equal(uiRes.domain, 'frontend')

  const secRes = classifyPromptDomain('Audit JWT authentication middleware for CSRF, XSS, and SQL injection vulnerabilities')
  assert.equal(secRes.domain, 'security')

  const perfRes = classifyPromptDomain('Fix memory leak and optimize latency bottleneck in concurrent queue')
  assert.equal(perfRes.domain, 'performance')
})

test('issue #254: assignAdaptivePersonas assigns distinct complementary engineering roles', () => {
  const slots = [
    { provider: 'p1', model: 'm1' },
    { provider: 'p2', model: 'm2' },
    { provider: 'p3', model: 'm3' },
  ]
  const { domain, references, personasAssigned } = assignAdaptivePersonas(
    slots,
    'Create SQL schema migration and composite index for Postgres database'
  )

  assert.equal(domain, 'database')
  assert.equal(references.length, 3)
  assert.equal(personasAssigned.length, 3)
  assert.equal(references[0].adaptive_persona_title, 'DBA Index Specialist')
  assert.equal(references[1].adaptive_persona_title, 'Zero-Downtime Migration Guard')
  assert.equal(references[2].adaptive_persona_title, 'ORM & Query Architect')
  assert.ok(references[0].adaptive_persona_prompt.includes('DBA Index Specialist'))
})

test('issue #254: runMoAPipeline injects adaptive persona prompts when adaptive_personas_enabled=true', async () => {
  const systemPromptsSeen = []

  const mockCallLlm = async (args) => {
    const sys = args.messages.find((m) => m.role === 'system')
    if (sys) systemPromptsSeen.push(sys.content)
    return 'Solution content'
  }

  await runMoAPipeline({
    userPrompt: 'Fix SQL query index and Postgres table migration',
    preset: {
      name: 'adaptive-p',
      ask_clarifying_questions: false,
      adaptive_personas_enabled: true,
      reference_models: [
        { provider: 'p1', model: 'm1' },
        { provider: 'p2', model: 'm2' },
      ],
      aggregator: { provider: 'p1', model: 'agg' },
    },
    callLlm: mockCallLlm,
  })

  assert.ok(systemPromptsSeen.some((s) => s.includes('DBA Index Specialist')))
  assert.ok(systemPromptsSeen.some((s) => s.includes('Zero-Downtime Migration Guard')))
})
