// lib/moa-parser.js
// Parsers for model outputs, winner selection, commands, and code blocks for @goodandready/dsh-moa.

/**
 * Extracts candidate winner index from judge output.
 * Looks for machine marker WINNER_CANDIDATE_INDEX: N first, then conversational fallbacks.
 */
export function parseWinnerIndex(judgeText, defaultIndex = 1, candidateCount = Infinity) {
  if (!judgeText || typeof judgeText !== 'string') return defaultIndex
  const inRange = (idx) => !isNaN(idx) && idx >= 1 && idx <= candidateCount
  const match = /WINNER_CANDIDATE_INDEX:\s*(\d+)/i.exec(judgeText)
  if (match) {
    const idx = parseInt(match[1], 10)
    if (inRange(idx)) return idx
  }
  const candMatch = /(?:Кандидат|Candidate|Reference)\s*(\d+)\b/i.exec(judgeText)
  if (candMatch) {
    const idx = parseInt(candMatch[1], 10)
    if (inRange(idx)) return idx
  }
  return defaultIndex
}

/**
 * Parses the recommended assembler model index and label from curator output.
 */
export function parseRecommendedAssembler(judgeText, defaultIndex = 1, candidateCount = Infinity) {
  if (!judgeText || typeof judgeText !== 'string') return { index: defaultIndex, label: '' }
  const inRange = (idx) => !isNaN(idx) && idx >= 1 && idx <= candidateCount
  const match = /RECOMMENDED_ASSEMBLER:\s*(\d+)(?:\s*\(([^)]+)\))?/i.exec(judgeText)
  if (match) {
    const idx = parseInt(match[1], 10)
    if (inRange(idx)) {
      return { index: idx, label: match[2]?.trim() || '' }
    }
  }
  return { index: defaultIndex, label: '' }
}

/**
 * Parses a `/moa [preset] <prompt>` command invocation.
 */
export function parseMoACommand(text, presets = []) {
  if (typeof text !== 'string' || !text.startsWith('/moa')) {
    return null
  }

  // Check for promote subcommand: /moa promote <runId> <candidateIndex> or /moa promote <candidateIndex>
  const promoteMatch = /^\/moa\s+promote\s+([a-zA-Z0-9_\-]+)(?:\s+(\d+))?/i.exec(text.trim())
  if (promoteMatch) {
    const hasTwoArgs = Boolean(promoteMatch[2])
    return {
      isPromote: true,
      runId: hasTwoArgs ? promoteMatch[1] : null,
      candidateIndex: hasTwoArgs ? parseInt(promoteMatch[2], 10) : parseInt(promoteMatch[1], 10),
    }
  }

  const remainder = text.slice(4).trim()
  if (!remainder) {
    return {
      presetName: 'default',
      prompt: '',
    }
  }

  const matchPreset = /^--preset(?:=|\s+)([a-zA-Z0-9_-]+)\s*(.*)/s.exec(remainder)
  if (matchPreset) {
    return {
      presetName: matchPreset[1],
      prompt: matchPreset[2] || '',
    }
  }

  const parts = remainder.split(/\s+/)
  const firstWord = parts[0]
  if (Array.isArray(presets)) {
    const matched = presets.find((p) => p.name === firstWord)
    if (matched) {
      return {
        presetName: matched.name,
        prompt: parts.slice(1).join(' ').trim(),
      }
    }
  }

  return {
    presetName: 'default',
    prompt: remainder,
  }
}

/**
 * Replaces large code blocks with concise file/code summaries to avoid token waste and huge chat dumps.
 */
export function stripOrSummarizeCode(text) {
  if (!text || typeof text !== 'string') return ''
  return text.replace(/```([a-zA-Z0-9_\-\.\/]*)\s*([\w\.\/\-]+\.[a-zA-Z0-9]+)?\n([\s\S]*?)```/g, (match, lang, fileTag, code) => {
    const lines = code.trim().split('\n')
    if (lines.length <= 3 && !/html|jsx|tsx|vue|svelte|css|js|ts/i.test(lang)) {
      return match
    }
    const fileHint = fileTag || (code.match(/^\s*(?:\/\/|#|<!--|\/\*)\s*(?:file|filepath|path):\s*([^\s*]+)/im)?.[1])
    const label = fileHint ? `file \`${fileHint}\`` : (lang ? `code \`${lang}\`` : 'code')
    return `\n> 📄 *[${label} - ${lines.length} lines saved to disk]*\n`
  })
}

/**
 * Formats user-facing markdown response for synthesis, questions, and failure kinds.
 */
export function formatMoAResponse({ moaResult, presetName }) {
  const parts = []
  const pName = presetName || moaResult?.presetName || 'default'
  const judge = moaResult?.aggregator || 'unknown'
  const refs = moaResult?.references || []

  if (moaResult?.kind === 'questions') {
    parts.push('## 🧠 Mixture of Agents — Requirements Clarification')
    parts.push(`*Judge (${judge}) and the advisors analyzed the task:*\n`)
    parts.push(moaResult.content)
    return parts.join('\n')
  }

  if (moaResult?.kind === 'failure') {
    parts.push('## ⚠️ Mixture of Agents — Execution Failed')
    parts.push(moaResult.content)
    return parts.join('\n')
  }

  const modeBadge = moaResult?.isFastMode
    ? '⚡ Fast Mode'
    : (moaResult?.isCuratorSynthesis ? `🧠 Curator: ${judge}` : `Judge: ${judge}`)
  parts.push(`## 🧠 Mixture of Agents (Preset: ${pName} | ${modeBadge})`)
  parts.push('')

  if (moaResult?.isRefinement) {
    parts.push('> 🔄 **Mode**: Iterative project refinement (Refinement)')
  }

  const hasPromoted = moaResult?.promotedFiles && moaResult.promotedFiles.length > 0
  if (hasPromoted) {
    parts.push(`> 📦 **Files created in the project**: \`${moaResult.promotedFiles.join('`, `')}\``)
  }

  if (moaResult?.recommendedAssembler?.label) {
    parts.push(`> 🎯 **Recommended Master Assembler**: Candidate ${moaResult.recommendedAssembler.index} (\`${moaResult.recommendedAssembler.label}\`)`)
  }

  if (moaResult?.liveCanvas?.previewUrl) {
    parts.push(`> 🎨 **Live Canvas**: [🚀 Открыть ${moaResult.liveCanvas.title || 'превью'} в Live Canvas](${moaResult.liveCanvas.previewUrl}) | [↗ Открыть в новой вкладке](${moaResult.liveCanvas.previewUrl})`)
  }

  // Cost tracking card
  if (moaResult?.usage) {
    const u = moaResult.usage
    const costStr = u.totalCostUsd > 0 ? `~\$${u.totalCostUsd.toFixed(4)}` : 'Free'
    const tokStr = u.totalTokens >= 1000 ? `${(u.totalTokens / 1000).toFixed(1)}k` : `${u.totalTokens}`
    parts.push(`> 💰 **Run cost**: ${costStr} (${tokStr} tokens total)`)
  }

  parts.push('')

  if (!moaResult?.isFastMode) {
    parts.push(`### ⚖️ Judge verdict and final synthesis (Synthesis: ${judge})`)
    parts.push('')
    const cleanJudgeContent = hasPromoted
      ? stripOrSummarizeCode(moaResult?.content || '')
      : (moaResult?.content || '(нет ответа)')
    parts.push(cleanJudgeContent)
    parts.push('')
  }

  if (Array.isArray(refs) && refs.length > 0) {
    const title = moaResult?.isFastMode ? '### 🚀 Candidate generation result:' : `### 👥 Advisor responses (${refs.length}):`
    parts.push(title)
    parts.push('')
    refs.forEach((ref, i) => {
      const statusIcon = ref.ok ? '✅' : '⚠️'
      const fileBadge = ref.files?.length ? ` (${ref.files.length} файл(ов))` : ''
      const costBadge = ref.costUsd > 0 ? ` [~\$${ref.costUsd.toFixed(4)}]` : ''
      parts.push(`#### ${statusIcon} Model ${i + 1}: ${ref.label}${fileBadge}${costBadge}`)
      parts.push('')
      parts.push(stripOrSummarizeCode(ref.text))
      parts.push('')
      parts.push('---')
      parts.push('')
    })
  }

  if (moaResult?.allowCandidateOverride && refs.length > 1) {
    const runId = moaResult?.runId || ''
    parts.push('### 🔄 Candidate Override Actions')
    parts.push('To apply an alternative candidate\'s files instead of the judge\'s pick:')
    refs.forEach((ref, idx) => {
      const isWinner = (idx + 1) === moaResult.winningIndex
      const tag = isWinner ? ' *(Current Judge Pick)*' : ''
      const promoteCmd = runId ? `/moa promote ${runId} ${idx + 1}` : `/moa promote ${idx + 1}`
      parts.push(`- \`${promoteCmd}\` — Candidate ${idx + 1} (${ref.label})${tag}`)
    })
    parts.push('')
  }

  return parts.join('\n')
}
