/**
 * DeepSeek Harness Mixture of Agents (MoA) — Judge Directive Budget (#370)
 *
 * Every quality gate returns a text directive. Without a budget the judge prompt
 * could accumulate tens of kilobytes of procedure text, eating the attention window
 * that the candidate code itself needs. This module assembles the judge directive
 * block under an explicit character budget: higher-priority directives are included
 * first, nothing is ever split mid-directive, and the caller receives the omitted
 * list so the spend is visible in telemetry.
 */

/**
 * Relative importance of directives when the budget forces omissions.
 * Blocking/correctness signals outrank advisory guidance.
 */
export const DIRECTIVE_PRIORITY = [
  'syntax',
  'security',
  'adversarialTdd',
  'cove',
  'privacy',
  'debate',
  'council',
  'tournament',
  'profiler',
  'mutation',
  'visual',
  'fileScoring',
  'pruning',
  'stackAware',
  'developerPreferences',
]

/**
 * Computes the directive budget from the candidate payload size: gate procedure
 * text must stay a small fraction of the prompt, not dominate it.
 *
 * @param {Array<string|object>} referenceTexts - candidate texts (strings or {text})
 * @param {object} [options]
 * @param {number} [options.fraction=0.15]
 * @param {number} [options.minChars=4000]
 * @param {number} [options.maxChars=24000]
 * @returns {number} budget in characters
 */
export function computeDirectiveBudget(referenceTexts = [], options = {}) {
  const { fraction = 0.15, minChars = 4000, maxChars = 24000 } = options
  let totalChars = 0
  for (const ref of referenceTexts) {
    const text = typeof ref === 'string' ? ref : (ref?.text || '')
    totalChars += text.length
  }
  const raw = Math.round(totalChars * fraction)
  return Math.max(minChars, Math.min(maxChars, raw))
}

/**
 * Assembles a directive block under a character budget.
 *
 * @param {Array<{key: string, text: string}>} items - directives in priority order
 * @param {object} [options]
 * @param {number} [options.budgetChars=12000]
 * @param {string} [options.separator='\n\n']
 * @param {Array<{key: string, text: string}>} [options.mandatory=[]]
 *   Always-included directives (e.g. user judge criteria) - they are never omitted.
 * @returns {{ text: string|null, included: string[], omitted: string[], chars: number, budgetChars: number }}
 */
export function assembleDirectives(items = [], options = {}) {
  const { budgetChars = 12000, separator = '\n\n', mandatory = [] } = options
  const parts = []
  const included = []
  const omitted = []
  let chars = 0

  const consume = (key, text) => {
    if (!text || typeof text !== 'string') return
    const partLen = text.length + (parts.length > 0 ? separator.length : 0)
    parts.push(text)
    included.push(key)
    chars += partLen
  }

  for (const m of mandatory) consume(m.key, m.text)

  for (const item of items) {
    const text = typeof item === 'string' ? item : item?.text
    const key = typeof item === 'string' ? `anon:${included.length}` : (item?.key || `anon:${included.length}`)
    if (!text) continue
    const partLen = text.length + (parts.length > 0 ? separator.length : 0)
    if (chars + partLen > budgetChars) {
      omitted.push(key)
      continue
    }
    consume(key, text)
  }

  return {
    text: parts.length > 0 ? parts.join(separator) : null,
    included,
    omitted,
    chars,
    budgetChars,
  }
}

/**
 * Rough token estimate for telemetry (chars/4, same convention as moa-budget).
 *
 * @param {number} chars
 * @returns {number}
 */
export function estimateDirectiveTokens(chars) {
  return Math.ceil((chars || 0) / 4)
}

/**
 * Orders directive items by DIRECTIVE_PRIORITY. Unknown keys keep their input
 * order after all known ones.
 *
 * @param {Array<{key: string, text: string}>} items
 * @returns {Array<{key: string, text: string}>}
 */
export function orderByPriority(items = []) {
  const rank = (key) => {
    const idx = DIRECTIVE_PRIORITY.indexOf(key)
    return idx === -1 ? DIRECTIVE_PRIORITY.length : idx
  }
  return [...items].sort((a, b) => rank(a.key) - rank(b.key))
}
