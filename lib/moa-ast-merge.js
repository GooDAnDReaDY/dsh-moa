/**
 * AST-Level Composite Merge Integration via dsh-context-lens (#248)
 * Semantically merges candidate files at the AST/declaration level (deduplicating imports,
 * combining type signatures, JSDoc comments, and function bodies) using dsh-context-lens
 * when available via ctx.reflect / service(ctx, 'contextLens'), with a clean fallback
 * to structured declaration merge and standard string composite directives.
 */

import vm from 'node:vm'
import { service } from './services.js'
import { logger } from './logger.js'
import { buildCompositeBlockDirectives } from './moa-multi-judge.js'
import { extractFileBlocks } from './workspace/fs.js'

/**
 * Checks whether dsh-context-lens service is available on the Cordis context.
 */
export function resolveContextLensService(ctx, explicitLens = null) {
  if (explicitLens) return explicitLens
  const fromSvc = service(ctx, 'contextLens')
  if (fromSvc) return fromSvc
  try {
    if (ctx?.reflect && typeof ctx.reflect.get === 'function') {
      const refl = ctx.reflect.get('contextLens') || ctx.reflect.get('dsh-context-lens')
      if (refl) return refl
    }
  } catch (err) {
    logger.debug('[dsh-moa:ast] context-lens reflection error:', err?.message || err)
  }
  return null
}

/**
 * Parses top-level imports, declarations, and JSDoc from JS/TS source code.
 */
export function parseModuleDeclarations(source = '') {
  const lines = String(source || '').split(/\r?\n/)
  const imports = []
  const bodyLines = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^import\s+/.test(trimmed) && (trimmed.endsWith(';') || trimmed.includes(' from '))) {
      imports.push(trimmed.replace(/;$/, ''))
    } else {
      bodyLines.push(line)
    }
  }

  const bodyText = bodyLines.join('\n')
  const declarations = new Map()
  const declRegex = /((?:\/\*\*[\s\S]*?\*\/\s*)?)(export\s+(?:async\s+)?(?:function|class|const|let|type|interface)\s+([A-Za-z0-9_$]+)[\s\S]*?)(?=(?:\n(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+(?:async\s+)?(?:function|class|const|let|type|interface)\s+)|$)/g
  let match
  while ((match = declRegex.exec(bodyText)) !== null) {
    const jsdoc = (match[1] || '').trim()
    const code = (match[2] || '').trim()
    const name = match[3]
    if (name) {
      declarations.set(name, { name, jsdoc, code })
    }
  }

  return { imports, declarations, rawBody: bodyText.trim() }
}

/**
 * Validates JavaScript syntax using node:vm compileFunction (ignoring TypeScript-only syntax).
 */
export function isValidJsAstSyntax(code = '', filename = 'module.js') {
  if (/\.tsx?$/i.test(filename)) return true
  const stripped = String(code)
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, 'const __default_export__ = ')
    .replace(/^\s*export\s+(async\s+function|function|class|const|let|var)\b/gm, '$1')
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '')
  try {
    new vm.Script(stripped, { filename })
    return true
  } catch {
    return false
  }
}

/**
 * Merges multiple candidate versions of the same file at declaration/AST level:
 * - Deduplicates all import statements without collisions
 * - Combines the richest JSDoc documentation, type signature, and implementation per symbol
 */
export async function mergeCandidateAstFiles(candidates = [], options = {}) {
  const lens = resolveContextLensService(options.ctx, options.contextLens)
  const byPath = new Map()

  for (const cand of candidates) {
    if (!cand || cand.ok === false) continue
    const files = Array.isArray(cand.files) && cand.files.length > 0
      ? cand.files
      : extractFileBlocks(cand.text || '')
    for (const f of files) {
      const rel = f.relativePath || f.path
      if (!rel || !f.content) continue
      if (!byPath.has(rel)) byPath.set(rel, [])
      byPath.get(rel).push({
        candidateIndex: cand.index,
        label: cand.label,
        content: f.content,
      })
    }
  }

  const mergedFiles = []
  for (const [relativePath, versions] of byPath.entries()) {
    if (versions.length === 1) {
      mergedFiles.push({
        relativePath,
        content: versions[0].content,
        contributors: [versions[0].label || `Candidate ${versions[0].candidateIndex}`],
        usedContextLens: Boolean(lens),
      })
      continue
    }

    // If dsh-context-lens provides a native mergeAst or analyzeAst method, use it first
    if (lens && typeof lens.mergeAst === 'function') {
      try {
        const mergedCode = await lens.mergeAst({
          filePath: relativePath,
          versions: versions.map((v) => v.content),
        })
        if (mergedCode && typeof mergedCode === 'string' && isValidJsAstSyntax(mergedCode, relativePath)) {
          mergedFiles.push({
            relativePath,
            content: mergedCode,
            contributors: versions.map((v) => v.label || `Candidate ${v.candidateIndex}`),
            usedContextLens: true,
          })
          continue
        }
      } catch (err) {
        logger.warn(`[dsh-moa:ast-merge] contextLens.mergeAst failed for ${relativePath}, using declaration AST merger:`, err?.message || err)
      }
    }

    // Declaration-level AST synthesis: deduplicate imports & merge JSDoc + bodies
    const uniqueImports = new Set()
    const mergedDecls = new Map()

    for (const ver of versions) {
      const parsed = parseModuleDeclarations(ver.content)
      for (const imp of parsed.imports) uniqueImports.add(imp)

      for (const [symName, decl] of parsed.declarations.entries()) {
        if (!mergedDecls.has(symName)) {
          mergedDecls.set(symName, { ...decl })
        } else {
          const existing = mergedDecls.get(symName)
          // Keep the richest JSDoc comment from any candidate
          if (decl.jsdoc && decl.jsdoc.length > (existing.jsdoc || '').length) {
            existing.jsdoc = decl.jsdoc
          }
          // Prefer more comprehensive implementation if existing is a short stub
          if (decl.code.length > existing.code.length && existing.code.length < 120) {
            existing.code = decl.code
          }
        }
      }
    }

    let assembled = ''
    if (uniqueImports.size > 0) {
      assembled += Array.from(uniqueImports).map((i) => `${i};`).join('\n') + '\n\n'
    }
    if (mergedDecls.size > 0) {
      assembled += Array.from(mergedDecls.values())
        .map((d) => (d.jsdoc ? `${d.jsdoc}\n${d.code}` : d.code))
        .join('\n\n') + '\n'
    } else {
      assembled = versions[0].content
    }

    if (!isValidJsAstSyntax(assembled, relativePath)) {
      assembled = versions[0].content
    }

    mergedFiles.push({
      relativePath,
      content: assembled,
      contributors: versions.map((v) => v.label || `Candidate ${v.candidateIndex}`),
      usedContextLens: Boolean(lens),
    })
  }

  return mergedFiles
}

/**
 * Builds the AST-level composite merge directive for the Judge/Curator.
 * Gracefully falls back to standard buildCompositeBlockDirectives when dsh-context-lens is absent
 * and no multi-version AST declarations are detected.
 */
export async function buildAstCompositeMergeDirective(candidates = [], options = {}) {
  const lens = resolveContextLensService(options.ctx, options.contextLens)
  const mergedFiles = await mergeCandidateAstFiles(candidates, options)
  const baseDirective = buildCompositeBlockDirectives(candidates, options)

  if (!lens && mergedFiles.length === 0) {
    return {
      degraded: true,
      usedContextLens: false,
      mergedFiles: [],
      directive: baseDirective,
    }
  }

  const astBlocks = mergedFiles
    .map((mf) => `#### AST Pre-Merged Preview: \`${mf.relativePath}\` (Contributors: ${mf.contributors.join(', ')})\n\`\`\`js path=${mf.relativePath}\n${mf.content.trim()}\n\`\`\``)
    .join('\n\n')

  const directive = [
    baseDirective.trim(),
    `\n### 🌳 AST-Level Semantic Composite Merge (${lens ? 'via `dsh-context-lens`' : 'Fallback Declaration Merger'}):`,
    'Imports have been deduplicated and declarations (JSDoc, type signatures, and function bodies) have been aligned across candidates:',
    astBlocks,
  ].join('\n\n')

  return {
    degraded: !lens,
    usedContextLens: Boolean(lens),
    mergedFiles,
    directive,
  }
}

