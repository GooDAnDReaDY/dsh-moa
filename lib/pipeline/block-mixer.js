/**
 * DeepSeek Harness Mixture of Agents (MoA) — AST & Markdown Block Mixer (#296)
 * Breaks candidate outputs into discrete semantic blocks and stitches them into hybrid solutions.
 */

/**
 * Parses markdown/code text into discrete semantic blocks.
 */
export function parseCandidateBlocks(text, candidateLabel = 'candidate_1') {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return []
  }

  const lines = text.split(/\r?\n/)
  const blocks = []
  let blockIdx = 0

  let inCode = false
  let codeLang = ''
  let codeLines = []

  let listLines = []
  let listType = null // 'ul' | 'ol'

  let paraLines = []

  function flushParagraph() {
    if (paraLines.length > 0) {
      const content = paraLines.join('\n').trim()
      if (content.length > 0) {
        blockIdx++
        blocks.push({
          id: `blk_${candidateLabel}_${blockIdx}`,
          candidate: candidateLabel,
          type: 'paragraph',
          content,
          metadata: { lines: paraLines.length }
        })
      }
      paraLines = []
    }
  }

  function flushList() {
    if (listLines.length > 0) {
      blockIdx++
      blocks.push({
        id: `blk_${candidateLabel}_${blockIdx}`,
        candidate: candidateLabel,
        type: 'list',
        content: listLines.join('\n'),
        metadata: { listType, itemCount: listLines.length }
      })
      listLines = []
      listType = null
    }
  }

  function flushCode() {
    if (codeLines.length > 0) {
      blockIdx++
      blocks.push({
        id: `blk_${candidateLabel}_${blockIdx}`,
        candidate: candidateLabel,
        type: 'code',
        content: codeLines.join('\n'),
        metadata: { lang: codeLang || 'text', lineCount: codeLines.length }
      })
      codeLines = []
      codeLang = ''
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Code fence start/end
    if (trimmed.startsWith('```')) {
      if (!inCode) {
        flushParagraph()
        flushList()
        inCode = true
        codeLang = trimmed.slice(3).trim()
        codeLines = []
      } else {
        inCode = false
        flushCode()
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blockIdx++
      blocks.push({
        id: `blk_${candidateLabel}_${blockIdx}`,
        candidate: candidateLabel,
        type: 'heading',
        content: headingMatch[2].trim(),
        metadata: { level: headingMatch[1].length }
      })
      continue
    }

    // List item
    const isUl = /^[*-]\s+/.test(trimmed)
    const isOl = /^\d+\.\s+/.test(trimmed)
    if (isUl || isOl) {
      flushParagraph()
      if (listType && listType !== (isUl ? 'ul' : 'ol')) {
        flushList()
      }
      listType = isUl ? 'ul' : 'ol'
      listLines.push(line)
      continue
    }

    // Blank line
    if (trimmed.length === 0) {
      flushParagraph()
      flushList()
      continue
    }

    // Regular paragraph line
    paraLines.push(line)
  }

  if (inCode) flushCode()
  flushParagraph()
  flushList()

  return blocks
}

/**
 * Stitches an ordered list of blocks into a unified output document.
 */
export function stitchCandidateBlocks(blocks, options = {}) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, stitchedText: '', blockCount: 0, sources: [] }
  }

  const sections = []
  const sourcesSet = new Set()

  for (const block of blocks) {
    if (!block || typeof block.content !== 'string') continue
    if (block.candidate) sourcesSet.add(block.candidate)

    switch (block.type) {
      case 'heading': {
        const hashes = '#'.repeat(block.metadata?.level || 2)
        sections.push(`${hashes} ${block.content}`)
        break
      }
      case 'code': {
        const lang = block.metadata?.lang || ''
        sections.push(`\`\`\`${lang}\n${block.content}\n\`\`\``)
        break
      }
      case 'list':
      case 'paragraph':
      default:
        sections.push(block.content)
        break
    }
  }

  const stitchedText = sections.join('\n\n')
  return {
    ok: true,
    stitchedText,
    blockCount: blocks.length,
    sources: Array.from(sourcesSet)
  }
}

/**
 * Generates directive for judge to smooth and harmonize stitched blocks.
 */
export function formatBlockMixerDirective(stitchedData, userGoal = '') {
  if (!stitchedData || !stitchedData.stitchedText) return null
  const sourceList = (stitchedData.sources || []).join(', ')
  return [
    '=== HUMAN OPERATOR COMPOSITE BLOCK MIXER ===',
    `The user has manually selected and ordered ${stitchedData.blockCount} semantic block(s) from candidate(s): [${sourceList}].`,
    'Your duty as Arbiter/Judge is to smooth transitions, eliminate redundant declarations, unify naming conventions, and resolve any semantic seams.',
    userGoal ? `Contextual Goal: ${userGoal}` : null,
    'Draft Stitched Content:',
    '```',
    stitchedData.stitchedText,
    '```',
    'Preserve the intent of the operator-selected components while delivering an integrated, error-free consensus output.'
  ].filter(Boolean).join('\n')
}
