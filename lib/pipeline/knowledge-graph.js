/**
 * Long-Term Consensus Knowledge Graph Integration with dsh-memory-brain (#322)
 *
 * Persists consensus decisions, winning rationale, and rejected anti-patterns:
 * 1. Autonomous mode (default): Local storage at ~/.dsh/moa/knowledge.json.
 * 2. Synergy mode: Live background export into Cordis service dsh-memory-brain.
 * 3. Recall: Enriches candidate generation prompts with relevant past precedents,
 *    preventing endless debates on settled architectural decisions.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { service } from '../services.js'
import { logger } from '../logger.js'
import { emitEvent, MOA_EVENTS } from '../events.js'

export function getBaseDshDir() {
  if (process.env.DSH_HOME) {
    const trimmed = process.env.DSH_HOME.trim()
    return trimmed.endsWith('.dsh') ? trimmed : path.join(trimmed, '.dsh')
  }
  return path.join(os.homedir(), '.dsh')
}

/**
 * Resolves local file path for knowledge graph storage.
 */
export function getKnowledgeFilePath(customPath = null) {
  if (customPath && typeof customPath === 'string' && customPath.trim().length > 0) {
    return path.resolve(customPath)
  }
  if (process.env.DSH_MOA_KNOWLEDGE_PATH) {
    return path.resolve(process.env.DSH_MOA_KNOWLEDGE_PATH)
  }
  return path.join(getBaseDshDir(), 'moa', 'knowledge.json')
}

/**
 * Reads local knowledge file safely.
 */
export function loadLocalKnowledge(filePath = null) {
  const target = getKnowledgeFilePath(filePath)
  if (!target) {
    return { version: 1, entries: [] }
  }
  try {
    if (!fs.existsSync(target)) {
      return { version: 1, entries: [] }
    }
    const raw = fs.readFileSync(target, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed
    }
    return { version: 1, entries: [] }
  } catch (err) {
    logger.debug('[dsh-moa:knowledge] Error reading knowledge file:', err?.message || err)
    return { version: 1, entries: [] }
  }
}

/**
 * Writes local knowledge file atomically.
 */
export function saveLocalKnowledge(filePath = null, data = { version: 1, entries: [] }) {
  const target = getKnowledgeFilePath(filePath)
  if (!target) {
    return false
  }
  try {
    const dir = path.dirname(target)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const payload = JSON.stringify(data, null, 2)
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
    fs.writeFileSync(tmp, payload, 'utf-8')
    fs.renameSync(tmp, target)
    return true
  } catch (err) {
    logger.warn('[dsh-moa:knowledge] Failed to save local knowledge:', err?.message || err)
    return false
  }
}

/**
 * Discovers dsh-memory-brain service from Cordis context.
 */
export function resolveMemoryBrainService(ctx, overrides = {}) {
  let memoryBrain = overrides.memoryBrain || null
  if (!memoryBrain && ctx) {
    memoryBrain = service(ctx, 'memoryBrain') || service(ctx, 'dsh-memory-brain')
    if (!memoryBrain && ctx.reflect && typeof ctx.reflect.get === 'function') {
      try {
        memoryBrain = ctx.reflect.get('memoryBrain') || ctx.reflect.get('dsh-memory-brain')
      } catch (_e) {}
    }
  }
  return memoryBrain || null
}

/**
 * Extracts simple keywords/tokens from text.
 */
function tokenize(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

/**
 * Records a finalized consensus decision into local storage and memory-brain.
 */
export async function recordConsensusDecision({
  runId = null,
  prompt = '',
  winnerModel = '',
  winningApproach = '',
  verdict = '',
  rejectedReasons = [],
  rules = [],
  tags = [],
  ctx = null,
  config = {},
  filePath = null,
  overrides = {},
}) {
  const syncEnabled = config.sync_with_memory_brain !== false && config.syncWithMemoryBrain !== false
  const entryId = runId || randomUUID()
  const entry = {
    id: entryId,
    timestamp: new Date().toISOString(),
    prompt: String(prompt || '').slice(0, 500),
    winnerModel: String(winnerModel || ''),
    winningApproach: String(winningApproach || '').slice(0, 1000),
    verdict: String(verdict || '').slice(0, 1000),
    rejectedReasons: Array.isArray(rejectedReasons) ? rejectedReasons.slice(0, 10) : [],
    rules: Array.isArray(rules) ? rules.slice(0, 10) : [],
    tags: Array.isArray(tags) ? tags : [],
  }

  // 1. Autonomous mode: save to local knowledge.json
  const current = loadLocalKnowledge(filePath)
  current.entries.unshift(entry)
  if (current.entries.length > 500) {
    current.entries = current.entries.slice(0, 500)
  }
  const localSaved = saveLocalKnowledge(filePath, current)

  // 2. Synergy mode: export to dsh-memory-brain
  let memoryBrainSynced = false
  const memoryBrain = resolveMemoryBrainService(ctx, overrides)
  if (syncEnabled && memoryBrain) {
    try {
      const payload = {
        title: `MoA Consensus: ${entry.winnerModel}`,
        content: `Prompt: ${entry.prompt}\nWinner: ${entry.winnerModel}\nApproach: ${entry.winningApproach}\nVerdict: ${entry.verdict}`,
        metadata: {
          source: 'dsh-moa',
          runId: entry.id,
          winnerModel: entry.winnerModel,
          rejectedReasons: entry.rejectedReasons,
          rules: entry.rules,
        },
        tags: ['moa', 'consensus', 'architecture', ...entry.tags],
      }

      if (typeof memoryBrain.remember === 'function') {
        await memoryBrain.remember(payload)
        memoryBrainSynced = true
      } else if (typeof memoryBrain.record === 'function') {
        await memoryBrain.record(payload)
        memoryBrainSynced = true
      } else if (typeof memoryBrain.addNode === 'function') {
        await memoryBrain.addNode(payload)
        memoryBrainSynced = true
      }
    } catch (mbErr) {
      logger.debug('[dsh-moa:knowledge] memoryBrain export error:', mbErr?.message || mbErr)
    }
  }

  emitEvent(ctx, MOA_EVENTS.KNOWLEDGE_STORED, {
    entryId,
    localSaved,
    memoryBrainSynced,
    winnerModel: entry.winnerModel,
  })

  return { localSaved, memoryBrainSynced, entry }
}

/**
 * Recalls relevant past consensus decisions from local storage and memory-brain.
 */
export async function recallConsensusKnowledge({
  prompt = '',
  ctx = null,
  config = {},
  filePath = null,
  maxEntries = 3,
  overrides = {},
}) {
  const syncEnabled = config.sync_with_memory_brain !== false && config.syncWithMemoryBrain !== false
  const memoryBrain = resolveMemoryBrainService(ctx, overrides)
  const promptTokens = new Set(tokenize(prompt))

  // 1. Search local knowledge entries
  const localData = loadLocalKnowledge(filePath)
  const scored = []
  const normPrompt = prompt.trim().toLowerCase().replace(/\s+/g, ' ')

  for (const entry of localData.entries) {
    if (entry.prompt && entry.prompt.trim().toLowerCase().replace(/\s+/g, ' ') === normPrompt) {
      continue
    }
    let score = 0
    const entryTokens = tokenize(`${entry.prompt} ${entry.winningApproach} ${entry.verdict} ${(entry.rules || []).join(' ')}`)
    for (const t of entryTokens) {
      if (promptTokens.has(t)) score++
    }
    if (score > 0) {
      scored.push({ entry, score, source: 'local' })
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score)
  let matched = scored.slice(0, maxEntries).map((s) => s.entry)

  // 2. Synergy query to memoryBrain
  if (syncEnabled && memoryBrain) {
    try {
      let mbResults = null
      if (typeof memoryBrain.recall === 'function') {
        mbResults = await memoryBrain.recall({ query: prompt, limit: maxEntries })
      } else if (typeof memoryBrain.search === 'function') {
        mbResults = await memoryBrain.search(prompt, { limit: maxEntries })
      }

      if (Array.isArray(mbResults) && mbResults.length > 0) {
        for (const res of mbResults) {
          const content = res.content || res.text || (typeof res === 'string' ? res : '')
          if (content && !matched.some((m) => m.winningApproach?.includes(content.slice(0, 30)))) {
            matched.push({
              id: res.id || randomUUID(),
              prompt: res.title || prompt.slice(0, 100),
              winnerModel: res.metadata?.winnerModel || 'memory-brain',
              winningApproach: content,
              rules: res.metadata?.rules || [],
              source: 'memoryBrain',
            })
          }
        }
      }
    } catch (mbErr) {
      logger.debug('[dsh-moa:knowledge] memoryBrain recall error:', mbErr?.message || mbErr)
    }
  }

  matched = matched.slice(0, maxEntries)

  let directive = null
  if (matched.length > 0) {
    const bullets = matched.map((m) => {
      const summary = m.winningApproach || m.verdict || m.prompt
      const rulesStr = m.rules && m.rules.length > 0 ? ` (Rules: ${m.rules.join(', ')})` : ''
      return `- **Precedent (${m.winnerModel || 'Past Consensus'})**: ${summary}${rulesStr}`
    }).join('\n')

    directive = `### Past MoA Consensus Decisions & Architectural Precedents (Follow Existing Agreements):\n${bullets}`
  }

  emitEvent(ctx, MOA_EVENTS.KNOWLEDGE_RECALL, {
    matchedCount: matched.length,
    hasMemoryBrain: Boolean(memoryBrain),
  })

  return {
    matched,
    directive,
    count: matched.length,
    hasMemoryBrain: Boolean(memoryBrain),
  }
}
