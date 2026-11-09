/**
 * Context Injection via dsh-context-lens & dsh-llm-wiki with Graceful Degradation (#321)
 *
 * Enriches MoA candidate prompts with project context:
 * 1. dsh-context-lens: Linked AST symbol graph, exported types, dependencies.
 * 2. dsh-llm-wiki: Architectural invariants, coding standards, project guidelines.
 * 3. Graceful degradation: If companion plugins are absent, uses built-in lightweight
 *    AST symbol extraction without throwing or aborting.
 */

import { service } from '../services.js'
import { logger } from '../logger.js'
import { emitEvent, MOA_EVENTS } from '../events.js'

/**
 * Discovers contextLens and llmWiki services on the Cordis runtime.
 */
export function resolveEcosystemServices(ctx, overrides = {}) {
  let contextLens = overrides.contextLens || null
  let llmWiki = overrides.llmWiki || null

  if (!contextLens && ctx) {
    contextLens = service(ctx, 'contextLens') || service(ctx, 'dsh-context-lens')
    if (!contextLens && ctx.reflect && typeof ctx.reflect.get === 'function') {
      try {
        contextLens = ctx.reflect.get('contextLens') || ctx.reflect.get('dsh-context-lens')
      } catch (_e) {}
    }
  }

  if (!llmWiki && ctx) {
    llmWiki = service(ctx, 'llmWiki') || service(ctx, 'dsh-llm-wiki')
    if (!llmWiki && ctx.reflect && typeof ctx.reflect.get === 'function') {
      try {
        llmWiki = ctx.reflect.get('llmWiki') || ctx.reflect.get('dsh-llm-wiki')
      } catch (_e) {}
    }
  }

  return {
    contextLens: contextLens || null,
    llmWiki: llmWiki || null,
    hasContextLens: Boolean(contextLens),
    hasLlmWiki: Boolean(llmWiki),
  }
}

/**
 * Fallback lightweight AST symbol extractor for JS/TS/Python source code.
 */
export function extractBasicSymbols(code = '') {
  const lines = String(code || '').split(/\r?\n/)
  const symbols = []
  const imports = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue

    if (/^import\s+/.test(trimmed) || /^from\s+/.test(trimmed) || /require\(/.test(trimmed)) {
      if (imports.length < 15) imports.push(trimmed)
      continue
    }

    const fnMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/)
    if (fnMatch) {
      symbols.push({ kind: 'function', name: fnMatch[1] })
      continue
    }

    const classMatch = trimmed.match(/(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/)
    if (classMatch) {
      symbols.push({ kind: 'class', name: classMatch[1] })
      continue
    }

    const constMatch = trimmed.match(/^export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/)
    if (constMatch) {
      symbols.push({ kind: 'const', name: constMatch[1] })
      continue
    }

    const typeMatch = trimmed.match(/^export\s+(?:type|interface)\s+([a-zA-Z0-9_$]+)/)
    if (typeMatch) {
      symbols.push({ kind: 'type', name: typeMatch[1] })
      continue
    }
  }

  return { imports, symbols }
}

/**
 * Extracts and formats ecosystem context with graceful degradation.
 */
export async function stageEcosystemContext({
  ctx = null,
  userPrompt = '',
  targetFiles = [],
  fileContents = {},
  options = {},
  overrides = {},
}) {
  const enabled = options.enableEcosystemContext !== false && options.enable_ecosystem_context !== false
  if (!enabled) {
    return {
      enabled: false,
      injected: false,
      hasContextLens: false,
      hasLlmWiki: false,
      directive: null,
      summary: 'Ecosystem context disabled by configuration.',
    }
  }

  const { contextLens, llmWiki, hasContextLens, hasLlmWiki } = resolveEcosystemServices(ctx, overrides)
  const sections = []
  let contextLensInjected = false
  let llmWikiInjected = false

  // 1. dsh-context-lens: AST symbols & graph
  if (hasContextLens) {
    try {
      let lensData = null
      if (typeof contextLens.getLinkedSymbols === 'function') {
        lensData = await contextLens.getLinkedSymbols(targetFiles, { prompt: userPrompt })
      } else if (typeof contextLens.getSymbols === 'function') {
        lensData = await contextLens.getSymbols(targetFiles[0] || '')
      } else if (typeof contextLens.analyzeFile === 'function') {
        lensData = await contextLens.analyzeFile(targetFiles[0] || '', fileContents[targetFiles[0]] || '')
      } else if (typeof contextLens.getContext === 'function') {
        lensData = await contextLens.getContext({ files: targetFiles, prompt: userPrompt })
      }

      if (lensData) {
        const text = typeof lensData === 'string' ? lensData : JSON.stringify(lensData, null, 2)
        sections.push(`### Ecosystem AST Context (via dsh-context-lens):\n${text}`)
        contextLensInjected = true
      }
    } catch (lensErr) {
      logger.debug('[dsh-moa:ecosystem] contextLens error, falling back:', lensErr?.message || lensErr)
    }
  }

  // Graceful fallback if contextLens is not active or failed
  if (!contextLensInjected && targetFiles.length > 0) {
    const fileSummaries = []
    for (const f of targetFiles.slice(0, 5)) {
      const code = fileContents[f] || ''
      if (code) {
        const { imports, symbols } = extractBasicSymbols(code)
        if (symbols.length > 0 || imports.length > 0) {
          const symStr = symbols.map((s) => `${s.kind} ${s.name}`).join(', ')
          fileSummaries.push(`- **${f}**:\n  - Symbols: ${symStr || 'none'}\n  - Key imports: ${imports.slice(0, 5).join('; ') || 'none'}`)
        }
      }
    }
    if (fileSummaries.length > 0) {
      sections.push(`### Project AST & Symbol Overview (Local Autonomous Fallback):\n${fileSummaries.join('\n')}`)
    }
  }

  // 2. dsh-llm-wiki: Architectural Invariants & Guidelines
  if (hasLlmWiki) {
    try {
      let wikiData = null
      if (typeof llmWiki.getInvariants === 'function') {
        wikiData = await llmWiki.getInvariants(userPrompt)
      } else if (typeof llmWiki.getGuidelines === 'function') {
        wikiData = await llmWiki.getGuidelines(targetFiles[0] || '')
      } else if (typeof llmWiki.search === 'function') {
        wikiData = await llmWiki.search(userPrompt)
      }

      if (wikiData) {
        const text = typeof wikiData === 'string'
          ? wikiData
          : (Array.isArray(wikiData) ? wikiData.map((w) => `- ${w}`).join('\n') : JSON.stringify(wikiData, null, 2))
        sections.push(`### Architectural Invariants & Guidelines (via dsh-llm-wiki):\n${text}`)
        llmWikiInjected = true
      }
    } catch (wikiErr) {
      logger.debug('[dsh-moa:ecosystem] llmWiki error, falling back:', wikiErr?.message || wikiErr)
    }
  }

  const directive = sections.length > 0 ? sections.join('\n\n') : null
  const injected = Boolean(directive)

  if (injected) {
    emitEvent(ctx, MOA_EVENTS.ECOSYSTEM_CONTEXT, {
      hasContextLens,
      hasLlmWiki,
      contextLensInjected,
      llmWikiInjected,
      sectionCount: sections.length,
    })
  }

  return {
    enabled: true,
    injected,
    hasContextLens,
    hasLlmWiki,
    contextLensInjected,
    llmWikiInjected,
    directive,
    summary: injected
      ? `Injected ecosystem context (contextLens: ${contextLensInjected ? 'active' : 'fallback'}, llmWiki: ${llmWikiInjected ? 'active' : 'absent'}).`
      : 'No additional ecosystem context available.',
  }
}
