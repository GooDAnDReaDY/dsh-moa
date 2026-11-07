/**
 * AST Consensus Heatmap in Code Diff Viewer (#297)
 *
 * Computes structural agreement heatmap across candidate model proposals:
 * 1. Normalizes syntax & code lines across JS/TS/Python/Go/Rust.
 * 2. Assigns per-line consensus scores:
 *    - Green (1.0): 100% agreement across all models.
 *    - Yellow (0.6 - 0.7): Majority structural consensus (e.g. 2 of 3).
 *    - Red (< 0.6): Divergence (conflicting architectures or algorithms).
 * 3. Identifies contested blocks with alternative switcher options.
 * 4. Merges user block selections into an agreed output.
 */

import { emitEvent, MOA_EVENTS } from '../events.js'

/**
 * Normalizes a line of source code for structural comparison.
 */
export function normalizeLineStructure(line = '') {
  return String(line || '')
    .trim()
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*|#.*/g, '') // remove inline comments
    .replace(/\s+/g, ' ')                        // collapse whitespace
    .replace(/['"`]/g, '"')                      // normalize quotes
    .replace(/;\s*$/, '')                        // ignore trailing semicolons
}

/**
 * Determines consensus status category from score.
 */
export function scoreToStatus(score) {
  if (score >= 0.99) return 'full_consensus'     // Green
  if (score >= 0.60) return 'partial_consensus'  // Yellow
  return 'diverged'                              // Red / Purple
}

/**
 * Computes AST consensus heatmap for a file given candidate outputs.
 *
 * @param {string} file - Target filename
 * @param {Array<{ label: string, index?: number, text?: string, files?: Array<{ path: string, content: string }> }>} candidates
 * @param {object} [options]
 * @returns {object}
 */
export function computeConsensusHeatmap(file = '', candidates = [], options = {}) {
  const activeCandidates = (candidates || []).filter((c) => c && (c.text || Array.isArray(c.files)))
  if (activeCandidates.length === 0) {
    return {
      file,
      totalLines: 0,
      overallConsensusScore: 1.0,
      lines: [],
      contestedBlocks: [],
      unifiedHeatmapDiff: '',
    }
  }

  // Extract content for target file from each candidate
  const candidateContents = activeCandidates.map((c, idx) => {
    let content = ''
    if (Array.isArray(c.files)) {
      const match = c.files.find((f) => f.path === file || f.name === file || f.file === file)
      if (match) content = match.content || match.text || ''
    }
    if (!content && typeof c.text === 'string') {
      content = c.text
    }
    return {
      index: c.index || (idx + 1),
      label: c.label || `Candidate ${idx + 1}`,
      lines: String(content || '').split(/\r?\n/),
      raw: String(content || ''),
    }
  })

  // Use the longest or primary candidate lines as reference spine
  let primaryIndex = 0
  let maxLen = 0
  candidateContents.forEach((c, idx) => {
    if (c.lines.length > maxLen) {
      maxLen = c.lines.length
      primaryIndex = idx
    }
  })

  const refSpine = candidateContents[primaryIndex]?.lines || []
  const totalModels = candidateContents.length
  const analyzedLines = []
  const contestedBlocks = []

  let currentBlock = null

  for (let lineNum = 1; lineNum <= refSpine.length; lineNum++) {
    const rawLine = refSpine[lineNum - 1]
    const normRef = normalizeLineStructure(rawLine)

    // Check agreement across all models
    let matchesCount = 0
    candidateContents.forEach((cand) => {
      const candLine = cand.lines[lineNum - 1]
      if (candLine !== undefined && normalizeLineStructure(candLine) === normRef) {
        matchesCount++
      }
    })

    const score = Number((matchesCount / totalModels).toFixed(2))
    const status = scoreToStatus(score)

    if (status === 'diverged') {
      if (!currentBlock) {
        currentBlock = {
          id: `contested-${contestedBlocks.length + 1}`,
          startLine: lineNum,
          endLine: lineNum,
          alternatives: candidateContents.map((c) => ({
            candidateIndex: c.index,
            label: c.label,
            code: c.lines[lineNum - 1] || '',
          })),
        }
      } else {
        currentBlock.endLine = lineNum
        candidateContents.forEach((c) => {
          const alt = currentBlock.alternatives.find((a) => a.candidateIndex === c.index)
          if (alt) {
            alt.code += '\n' + (c.lines[lineNum - 1] || '')
          }
        })
      }
    } else {
      if (currentBlock) {
        contestedBlocks.push(currentBlock)
        currentBlock = null
      }
    }

    analyzedLines.push({
      lineNumber: lineNum,
      content: rawLine,
      consensusScore: score,
      status,
      contestedBlockId: currentBlock ? currentBlock.id : (status === 'diverged' ? `contested-${contestedBlocks.length + 1}` : null),
    })
  }

  if (currentBlock) {
    contestedBlocks.push(currentBlock)
  }

  const overallScore = analyzedLines.length > 0
    ? Number((analyzedLines.reduce((acc, l) => acc + l.consensusScore, 0) / analyzedLines.length).toFixed(2))
    : 1.0

  // Generate unified heatmap diff format with confidence tags
  const unifiedLines = analyzedLines.map((l) => {
    let prefix = ' '
    if (l.status === 'full_consensus') prefix = '🟢 ' // Green
    else if (l.status === 'partial_consensus') prefix = '🟡 ' // Yellow
    else prefix = '🔴 ' // Red
    return `${prefix}[${Math.round(l.consensusScore * 100)}%] ${String(l.lineNumber).padStart(4, ' ')}: ${l.content}`
  })

  const result = {
    file,
    totalLines: analyzedLines.length,
    overallConsensusScore: overallScore,
    divergedBlocksCount: contestedBlocks.length,
    lines: analyzedLines,
    contestedBlocks,
    unifiedHeatmapDiff: unifiedLines.join('\n'),
  }

  emitEvent(options?.ctx, MOA_EVENTS.AST_HEATMAP_COMPUTED, {
    file,
    totalLines: result.totalLines,
    overallScore,
    divergedBlocksCount: contestedBlocks.length,
  })

  return result
}

/**
 * Merges user-selected alternative fragments into resolved code.
 *
 * @param {string} baseCode
 * @param {Array<object>} contestedBlocks
 * @param {Record<string, number>} selections - Map of blockId to chosen candidateIndex
 * @returns {string}
 */
export function resolveContestedBlocks(baseCode = '', contestedBlocks = [], selections = {}) {
  if (!contestedBlocks || contestedBlocks.length === 0 || !selections) {
    return baseCode
  }

  const lines = String(baseCode || '').split(/\r?\n/)
  // Sort blocks descending by startLine to avoid line shifting during replacement
  const sorted = [...contestedBlocks].sort((a, b) => b.startLine - a.startLine)

  for (const block of sorted) {
    const chosenCandidateIndex = selections[block.id]
    if (chosenCandidateIndex === undefined) continue

    const alt = block.alternatives.find((a) => a.candidateIndex === chosenCandidateIndex)
    if (!alt) continue

    const replacementLines = String(alt.code || '').split(/\r?\n/)
    const deleteCount = (block.endLine - block.startLine) + 1
    lines.splice(block.startLine - 1, deleteCount, ...replacementLines)
  }

  return lines.join('\n')
}
