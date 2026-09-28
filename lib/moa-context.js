/**
 * Multi-Turn Conversation Memory & Context Pruning
 * Feature 8 (Multi-Turn Continuity)
 */

/**
 * Extracts concise prior turn baseline from previous conversation messages.
 */
export function extractPriorTurnBaseline(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) return null

  // Find the last assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg?.role === 'assistant' && typeof msg?.content === 'string') {
      const text = msg.content.trim()
      if (text.length > 0) {
        // Strip out noisy banners if present
        const cleaned = text
          .replace(/^#+\s*🏆[^\n]+\n/m, '')
          .replace(/<!--\s*moa-metadata[\s\S]*?-->/g, '')
          .trim()
        return cleaned.slice(0, 3500)
      }
    }
  }
  return null
}

/**
 * Prunes conversation history for candidate fan-out to prevent token ballooning
 * while preserving multi-turn context continuity.
 */
export function pruneMultiTurnMessages(messages = [], maxHistoryTokens = 3000) {
  if (!Array.isArray(messages) || messages.length <= 2) {
    return messages || []
  }

  const pruned = []
  const sysMsg = messages.find((m) => m && m.role === 'system')
  if (sysMsg) {
    pruned.push(sysMsg)
  }

  // Get conversation turns excluding system
  const nonSys = messages.filter((m) => m && m.role !== 'system')
  if (nonSys.length === 0) return pruned

  // Always keep up to the final 4 turns (last 2 user + assistant pairs)
  const recentTurns = nonSys.slice(-4)

  // Calculate dynamic character budget derived from maxHistoryTokens (approx 4 chars per token)
  const totalCharBudget = Math.max(1200, (Number(maxHistoryTokens) || 3000) * 4)
  const maxTurnChars = Math.max(400, Math.floor(totalCharBudget / recentTurns.length))
  const maxHead = Math.floor(maxTurnChars * 0.75)
  const maxTail = Math.max(50, maxTurnChars - maxHead)

  for (let idx = 0; idx < recentTurns.length; idx++) {
    const msg = recentTurns[idx]
    const isLatest = idx === recentTurns.length - 1
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

    if (isLatest || content.length <= maxTurnChars) {
      pruned.push(msg)
    } else {
      // Prune long prior assistant or user text to protect candidate context
      const truncated = content.slice(0, maxHead) + '\n\n[...context pruned for token efficiency...]\n' + content.slice(-maxTail)
      pruned.push({
        role: msg.role,
        content: truncated,
      })
    }
  }

  return pruned
}
