/**
 * Cross-Candidate Unchanged Base Context Pruning (#305)
 *
 * Replaces large, mostly-unchanged candidate file blocks with compact unified diffs
 * containing only modified hunks and a configurable number of context lines.
 * This drastically cuts Judge prompt token overhead (often by 70-85%) on large files
 * while preserving full context for winner promotion.
 */

import { computeLineDiff } from '../workspace/diff.js'
import { isSafeRelativePath } from '../workspace/security.js'

/**
 * Extracts code blocks along with their raw Markdown text from candidate output.
 *
 * @param {string} text
 * @returns {Array<{ relativePath: string, content: string, rawBlock: string }>}
 */
export function extractCandidateFileBlocks(text) {
  if (!text || typeof text !== 'string') return []
  const blocks = []
  const seenPaths = new Set()

  const patterns = [
    /```[\w-]*\s+(?:file|path|filepath)=["']?([^\s"'\n\r]+)["']?[\r\n]+([\s\S]*?)```/gi,
    /(?:\/\/|#|<!--)\s*(?:File|Path):\s*([^\s\n\r>]+)(?:\s*-->)?[\r\n]+```[\w-]*[\r\n]+([\s\S]*?)```/gi,
    /#{1,4}\s+(?:File|Path):\s*([^\s\n\r]+)[\r\n]+```[\w-]*[\r\n]+([\s\S]*?)```/gi,
    /```[\w-]*[\r\n]+(?:\/\/|#|<!--)\s*(?:File|Path):\s*([^\s\n\r>]+)(?:\s*-->)?[\r\n]+([\s\S]*?)```/gi,
  ]

  for (const regex of patterns) {
    let match
    while ((match = regex.exec(text)) !== null) {
      const rawPath = match[1].trim()
      if (rawPath && isSafeRelativePath(rawPath) && !seenPaths.has(rawPath)) {
        seenPaths.add(rawPath)
        blocks.push({
          relativePath: rawPath,
          content: match[2].trimEnd() + '\n',
          rawBlock: match[0],
        })
      }
    }
  }

  return blocks
}


/**
 * Generates unified diff hunks from line diff items with a specified context window.
 *
 * @param {string} oldText - Original baseline file content
 * @param {string} newText - Candidate's proposed file content
 * @param {object} [options]
 * @param {number} [options.contextLines=5] - Unchanged lines before and after changes
 * @param {string} [options.filePath='file'] - Relative file path for header
 * @returns {string} Standard unified diff representation
 */
export function generateUnifiedDiff(oldText = '', newText = '', options = {}) {
  const { contextLines = 5, filePath = 'file' } = options
  const trimmedOld = String(oldText || '').replace(/[\r\n]+$/, '')
  const trimmedNew = String(newText || '').replace(/[\r\n]+$/, '')
  if (trimmedOld === trimmedNew) return ''

  const diffItems = computeLineDiff(trimmedOld, trimmedNew)
  if (!diffItems || diffItems.length === 0) return ''

  // Group diff items into hunks with contextLines
  const changeIndices = []
  for (let i = 0; i < diffItems.length; i++) {
    if (diffItems[i].type !== 'same') {
      changeIndices.push(i)
    }
  }

  if (changeIndices.length === 0) return ''

  // Cluster change ranges that are closer than 2 * contextLines
  const clusters = []
  let currentCluster = {
    start: Math.max(0, changeIndices[0] - contextLines),
    end: Math.min(diffItems.length - 1, changeIndices[0] + contextLines),
  }

  for (let k = 1; k < changeIndices.length; k++) {
    const idx = changeIndices[k]
    const nextStart = Math.max(0, idx - contextLines)
    const nextEnd = Math.min(diffItems.length - 1, idx + contextLines)

    if (nextStart <= currentCluster.end + 1) {
      currentCluster.end = Math.max(currentCluster.end, nextEnd)
    } else {
      clusters.push(currentCluster)
      currentCluster = { start: nextStart, end: nextEnd }
    }
  }
  clusters.push(currentCluster)

  const hunkOutputs = []
  for (const cluster of clusters) {
    const slice = diffItems.slice(cluster.start, cluster.end + 1)
    let oldStart = null
    let newStart = null
    let oldCount = 0
    let newCount = 0
    const hunkLines = []

    for (const item of slice) {
      if (item.type === 'same') {
        if (oldStart === null && item.oldNum !== undefined) oldStart = item.oldNum
        if (newStart === null && item.newNum !== undefined) newStart = item.newNum
        oldCount++
        newCount++
        hunkLines.push(` ${item.line}`)
      } else if (item.type === 'removed') {
        if (oldStart === null && item.oldNum !== undefined) oldStart = item.oldNum
        oldCount++
        hunkLines.push(`-${item.line}`)
      } else if (item.type === 'added') {
        if (newStart === null && item.newNum !== undefined) newStart = item.newNum
        newCount++
        hunkLines.push(`+${item.line}`)
      }
    }

    const header = `@@ -${oldStart || 1},${oldCount} +${newStart || 1},${newCount} @@`
    hunkOutputs.push([header, ...hunkLines].join('\n'))
  }

  const prefix = `--- a/${filePath}\n+++ b/${filePath}`
  return `${prefix}\n${hunkOutputs.join('\n')}`
}

/**
 * Checks whether a candidate's file output qualifies for context pruning.
 *
 * @param {string} originalText - Original file content
 * @param {string} candidateText - Proposed file content
 * @param {object} [options]
 * @param {number} [options.minLines=25] - Minimum file length to consider pruning
 * @param {number} [options.maxChangeRatio=0.65] - Maximum proportion of changed lines
 * @returns {boolean}
 */
export function shouldPruneFile(originalText, candidateText, options = {}) {
  const { minLines = 25, maxChangeRatio = 0.65 } = options
  if (typeof originalText !== 'string' || typeof candidateText !== 'string') return false
  const trimmedOld = originalText.replace(/[\r\n]+$/, '')
  const trimmedNew = candidateText.replace(/[\r\n]+$/, '')
  if (trimmedOld === trimmedNew) return false

  const oldLines = trimmedOld.split(/\r?\n/)
  if (oldLines.length < minLines) return false

  const diffItems = computeLineDiff(trimmedOld, trimmedNew)
  let changed = 0
  for (const item of diffItems) {
    if (item.type !== 'same') changed++
  }

  const ratio = changed / Math.max(1, diffItems.length)
  return ratio > 0 && ratio <= maxChangeRatio
}

/**
 * Prunes unmodified base context from a single candidate's Markdown output.
 *
 * @param {string} candidateText - Raw candidate text containing file blocks
 * @param {Map<string, string>|Record<string, string>} baseFiles - Map of relative paths to baseline file contents
 * @param {object} [options]
 * @param {number} [options.contextLines=5]
 * @param {number} [options.minLines=25]
 * @returns {{ text: string, prunedFiles: string[], savedChars: number, originalChars: number }}
 */
export function pruneCandidateOutput(candidateText = '', baseFiles = {}, options = {}) {
  if (typeof candidateText !== 'string' || !candidateText.trim()) {
    return { text: candidateText, prunedFiles: [], savedChars: 0, originalChars: 0 }
  }

  const { contextLines = 5, minLines = 25 } = options
  const baseMap = baseFiles instanceof Map
    ? baseFiles
    : new Map(Object.entries(baseFiles || {}))

  if (baseMap.size === 0) {
    return { text: candidateText, prunedFiles: [], savedChars: 0, originalChars: 0 }
  }

  const fileBlocks = extractCandidateFileBlocks(candidateText)
  if (!Array.isArray(fileBlocks) || fileBlocks.length === 0) {
    return { text: candidateText, prunedFiles: [], savedChars: 0, originalChars: 0 }
  }

  let prunedText = candidateText
  const prunedFiles = []
  let savedChars = 0

  for (const block of fileBlocks) {
    const relPath = block.relativePath || block.path
    if (!relPath || !baseMap.has(relPath)) continue

    const baseContent = baseMap.get(relPath)
    if (!shouldPruneFile(baseContent, block.content, { minLines })) continue

    const unifiedDiff = generateUnifiedDiff(baseContent, block.content, {
      contextLines,
      filePath: relPath,
    })

    if (!unifiedDiff) continue

    const originalBlockText = block.rawBlock || block.block || `\`\`\`${block.language || ''}\n${block.content}\n\`\`\``
    const replacementBlock = `\`\`\`diff\n// Unified diff patch for ${relPath} (context pruned)\n${unifiedDiff}\n\`\`\``

    if (replacementBlock.length < originalBlockText.length) {
      prunedText = prunedText.replace(originalBlockText, replacementBlock)
      savedChars += (originalBlockText.length - replacementBlock.length)
      prunedFiles.push(relPath)
    }
  }

  return {
    text: prunedText,
    prunedFiles,
    savedChars,
    originalChars: candidateText.length,
  }
}

/**
 * Prunes unmodified context across all successful candidate outputs.
 *
 * @param {Array<object>} candidates - List of candidate response objects
 * @param {Array<object>|Map<string, string>|Record<string, string>} projectFiles - Project context files
 * @param {object} [options]
 * @param {boolean} [options.enabled=true]
 * @param {number} [options.contextLines=5]
 * @returns {{ candidates: Array<object>, totalSavedChars: number, totalSavedTokens: number, prunedFiles: string[], isPruned: boolean }}
 */
export function pruneCandidateEnsemble(candidates = [], projectFiles = [], options = {}) {
  const { enabled = true, contextLines = 5, minLines = 25 } = options
  if (!enabled || !Array.isArray(candidates) || candidates.length === 0) {
    return {
      candidates,
      totalSavedChars: 0,
      totalSavedTokens: 0,
      prunedFiles: [],
      isPruned: false,
    }
  }

  // Build base files map
  const baseMap = new Map()
  if (Array.isArray(projectFiles)) {
    for (const f of projectFiles) {
      if (f && f.path && typeof f.content === 'string') {
        baseMap.set(f.path, f.content)
      } else if (f && f.relativePath && typeof f.content === 'string') {
        baseMap.set(f.relativePath, f.content)
      }
    }
  } else if (projectFiles instanceof Map) {
    for (const [k, v] of projectFiles.entries()) baseMap.set(k, v)
  } else if (projectFiles && typeof projectFiles === 'object') {
    for (const [k, v] of Object.entries(projectFiles)) baseMap.set(k, v)
  }

  if (baseMap.size === 0) {
    return {
      candidates,
      totalSavedChars: 0,
      totalSavedTokens: 0,
      prunedFiles: [],
      isPruned: false,
    }
  }

  let totalSavedChars = 0
  const allPrunedFiles = new Set()

  const prunedCandidates = candidates.map((cand) => {
    if (!cand || typeof cand.text !== 'string') return cand
    const result = pruneCandidateOutput(cand.text, baseMap, { contextLines, minLines })
    if (result.savedChars > 0) {
      totalSavedChars += result.savedChars
      result.prunedFiles.forEach((f) => allPrunedFiles.add(f))
      return {
        ...cand,
        text: result.text,
        prunedStats: {
          savedChars: result.savedChars,
          prunedFiles: result.prunedFiles,
        },
      }
    }
    return cand
  })

  const totalSavedTokens = Math.round(totalSavedChars / 4)
  return {
    candidates: prunedCandidates,
    totalSavedChars,
    totalSavedTokens,
    prunedFiles: Array.from(allPrunedFiles),
    isPruned: totalSavedChars > 0,
  }
}

/**
 * Emits a structured instruction directive for the Judge when context pruning was applied.
 *
 * @param {Array<string>} [prunedFiles=[]] - List of pruned file paths
 * @param {number} [savedTokens=0] - Estimated token count saved
 * @returns {string}
 */
export function formatPruningDirective(prunedFiles = [], savedTokens = 0) {
  if (!Array.isArray(prunedFiles) || prunedFiles.length === 0) return ''
  const fileList = prunedFiles.map((f) => `\`${f}\``).join(', ')
  return `### Context Pruning Notice
To minimize token bloat and accelerate evaluation, large baseline files with localized modifications (${fileList}) have been pruned into standard unified diff patches (---/+++ with context hunks).
Evaluate the precision, correctness, and edge-case safety of the added and removed lines without penalizing candidates for using diff format.`
}

