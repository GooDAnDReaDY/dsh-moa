/**
 * Prompt-Adaptive Dynamic Persona Synthesis for Reference Models (#254)
 * Classifies prompt technical domain and synthesizes complementary engineering personas
 * dynamically so each candidate approaches the task from a distinct expert angle.
 */

export const DOMAIN_PERSONA_POOLS = {
  database: [
    {
      id: 'dba_index_specialist',
      title: 'DBA Index Specialist',
      prompt: 'You are a Principal DBA Index Specialist. Focus on query execution plans, composite indexing, lock contention prevention, and optimal read/write throughput.',
    },
    {
      id: 'zero_downtime_migration_guard',
      title: 'Zero-Downtime Migration Guard',
      prompt: 'You are a Zero-Downtime Migration Guard. Ensure backward-compatible schema evolutions, safe expand-and-contract patterns, and rollback safety.',
    },
    {
      id: 'orm_query_architect',
      title: 'ORM & Query Architect',
      prompt: 'You are an ORM & Query Architect. Focus on eliminating N+1 queries, clean repository abstractions, transaction isolation levels, and strict data integrity.',
    },
  ],
  frontend: [
    {
      id: 'a11y_ux_specialist',
      title: 'Accessibility & UX Specialist',
      prompt: 'You are an Accessibility & UX Specialist. Ensure WCAG 2.1 AA compliance, keyboard navigation, ARIA semantics, and responsive user feedback.',
    },
    {
      id: 'css_design_systems_architect',
      title: 'CSS & Design Systems Architect',
      prompt: 'You are a CSS & Design Systems Architect. Focus on design tokens, layout resilience, fluid typography, zero layout shift, and clean component composition.',
    },
    {
      id: 'state_rendering_optimizer',
      title: 'State & Rendering Optimizer',
      prompt: 'You are a Frontend State & Rendering Optimizer. Focus on minimizing unnecessary re-renders, memoization, deterministic state transitions, and bundle efficiency.',
    },
  ],
  security: [
    {
      id: 'offensive_security_auditor',
      title: 'Offensive Security Auditor',
      prompt: 'You are an Offensive Security Auditor. Proactively hunt for injection vectors, SSRF, path traversal, auth bypass, and privilege escalation.',
    },
    {
      id: 'defensive_hardening_specialist',
      title: 'Defensive Hardening Specialist',
      prompt: 'You are a Defensive Hardening Specialist. Enforce least-privilege access, strict input validation, fail-closed guards, and cryptographic best practices.',
    },
    {
      id: 'runtime_sandbox_guardian',
      title: 'Runtime & Sandbox Guardian',
      prompt: 'You are a Runtime & Sandbox Guardian. Focus on resource limits, rate limiting, secret sanitization, and zero-trust boundary enforcement.',
    },
  ],
  performance: [
    {
      id: 'algorithmic_optimizer',
      title: 'Algorithmic Complexity Optimizer',
      prompt: 'You are an Algorithmic Complexity Optimizer. Replace O(N^2) bottlenecks with optimal data structures, streaming pipelines, and bounded memory usage.',
    },
    {
      id: 'concurrency_profiler',
      title: 'Memory & Concurrency Profiler',
      prompt: 'You are a Memory & Concurrency Profiler. Prevent event-loop blocking, race conditions, memory leaks, and unbounded promise queues.',
    },
  ],
  testing: [
    {
      id: 'edge_case_fuzzer',
      title: 'Edge-Case & Fuzzing Specialist',
      prompt: 'You are an Edge-Case & Fuzzing Specialist. Target boundary conditions, malformed inputs, concurrency races, and failure recovery paths.',
    },
    {
      id: 'contract_test_architect',
      title: 'Integration & Contract Test Architect',
      prompt: 'You are an Integration & Contract Test Architect. Build deterministic, isolated, fast-running test suites with zero flakiness.',
    },
  ],
  architecture: [
    {
      id: 'ddd_architect',
      title: 'Domain-Driven Design Architect',
      prompt: 'You are a Domain-Driven Design Architect. Enforce clean module boundaries, single responsibility, explicit contracts, and low coupling.',
    },
    {
      id: 'resilience_engineer',
      title: 'Resilience & Fault-Tolerance Engineer',
      prompt: 'You are a Resilience & Fault-Tolerance Engineer. Design idempotent operations, graceful degradation, circuit breakers, and clear error taxonomy.',
    },
  ],
}

const DOMAIN_RULES = [
  { domain: 'database', pattern: /\b(sql|postgres|mysql|sqlite|prisma|drizzle|typeorm|migration|index|schema|table|query|database|db|transaction)\b/i },
  { domain: 'security', pattern: /\b(security|auth|jwt|oauth|csrf|xss|ssrf|injection|traversal|permission|encrypt|hash|token|secret|vulnerability|cve)\b/i },
  { domain: 'frontend', pattern: /\b(react|vue|svelte|css|tailwind|html|dom|component|ui|ux|button|modal|layout|responsive|aria|accessibility|style)\b/i },
  { domain: 'performance', pattern: /\b(performance|optimize|latency|throughput|cache|memory|leak|benchmark|bottleneck|fast|profil|concurrent|parallel)\b/i },
  { domain: 'testing', pattern: /\b(test|unit|integration|e2e|mock|assert|coverage|vitest|jest|playwright|tdd|regression)\b/i },
]

/**
 * Classifies a user prompt into a specialized technical domain.
 *
 * @param {string} prompt
 * @returns {{ domain: string, confidence: number, matchedKeywords: string[] }}
 */
export function classifyPromptDomain(prompt) {
  const text = String(prompt || '').trim()
  if (!text) return { domain: 'architecture', confidence: 0.5, matchedKeywords: [] }

  let bestDomain = 'architecture'
  let bestCount = 0
  let bestMatches = []

  for (const rule of DOMAIN_RULES) {
    const matches = [...text.matchAll(new RegExp(rule.pattern.source, 'gi'))].map((m) => m[0].toLowerCase())
    const unique = [...new Set(matches)]
    if (unique.length > bestCount) {
      bestCount = unique.length
      bestDomain = rule.domain
      bestMatches = unique
    }
  }

  return {
    domain: bestDomain,
    confidence: bestCount > 0 ? Math.min(0.98, Number((0.6 + bestCount * 0.12).toFixed(2))) : 0.55,
    matchedKeywords: bestMatches,
  }
}

/**
 * Synthesizes and assigns complementary domain-specific personas to reference model slots.
 *
 * @param {Array<object>} references
 * @param {string} prompt
 * @returns {{ domain: string, references: Array<object>, personasAssigned: Array<object> }}
 */
export function assignAdaptivePersonas(references, prompt) {
  if (!Array.isArray(references) || references.length === 0) {
    return { domain: 'architecture', references: [], personasAssigned: [] }
  }

  const { domain } = classifyPromptDomain(prompt)
  const pool = DOMAIN_PERSONA_POOLS[domain] || DOMAIN_PERSONA_POOLS.architecture
  const fallbackPool = DOMAIN_PERSONA_POOLS.architecture

  const personasAssigned = []
  const enrichedRefs = references.map((slot, idx) => {
    const chosen = pool[idx % pool.length] || fallbackPool[idx % fallbackPool.length]
    personasAssigned.push({
      candidateIndex: idx + 1,
      model: `${slot.provider || ''}:${slot.model || ''}`,
      domain,
      personaId: chosen.id,
      personaTitle: chosen.title,
    })
    return {
      ...slot,
      adaptive_domain: domain,
      adaptive_persona_id: chosen.id,
      adaptive_persona_title: chosen.title,
      adaptive_persona_prompt: `[ADAPTIVE EXPERT ROLE — ${chosen.title} (${domain.toUpperCase()})]: ${chosen.prompt}`,
    }
  })

  return {
    domain,
    references: enrichedRefs,
    personasAssigned,
  }
}
