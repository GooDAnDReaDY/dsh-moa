/**
 * Empirical Elo Rating and Active Learning Leaderboard by Task Category (#249)
 * Calculates pairwise Elo ratings (K-factor = 32, baseline = 1500) segmented by
 * task category (frontend, backend, refactoring, testing, sql, general),
 * and exposes category leaders to Smart Routing.
 */

export const INITIAL_ELO = 1500
export const DEFAULT_K_FACTOR = 32

const CATEGORY_PATTERNS = [
  { category: 'sql', regex: /\b(sql|postgres|sqlite|mysql|query|database|schema|migration|prisma|index|table)\b/i },
  { category: 'frontend', regex: /\b(frontend|ui|css|html|react|vue|tailwind|component|button|layout|modal|svg|dom)\b/i },
  { category: 'testing', regex: /\b(test|unit\s*test|e2e|vitest|jest|playwright|assert|coverage|mock|tdd)\b/i },
  { category: 'refactoring', regex: /\b(refactor|clean|simplify|dedup|modular|rename|extract|decompose|yagni)\b/i },
  { category: 'backend', regex: /\b(backend|api|endpoint|server|route|auth|jwt|middleware|express|http|rest|webhook|stream)\b/i },
]

/**
 * Classifies a prompt into one of the standard Elo leaderboard categories.
 *
 * @param {string} prompt
 * @returns {'frontend' | 'backend' | 'refactoring' | 'testing' | 'sql' | 'general'}
 */
export function classifyEloCategory(prompt = '') {
  const text = String(prompt || '').trim()
  if (!text) return 'general'
  for (const rule of CATEGORY_PATTERNS) {
    if (rule.regex.test(text)) return rule.category
  }
  return 'general'
}

/**
 * Calculates expected win probability of player A against player B.
 */
export function expectedEloScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/**
 * Updates pairwise Elo ratings when winnerKey beats all other participantKeys in a round.
 *
 * @param {Map<string, number>} ratingMap
 * @param {string} winnerKey
 * @param {string[]} participantKeys
 * @param {number} [kFactor=32]
 */
export function applyRoundEloUpdate(ratingMap, winnerKey, participantKeys = [], kFactor = DEFAULT_K_FACTOR) {
  if (!winnerKey || participantKeys.length < 2) return
  const opponents = participantKeys.filter((k) => k && k !== winnerKey)
  if (opponents.length === 0) return

  // Normalize K-factor across the number of pairwise comparisons in the multi-candidate round
  const effectiveK = kFactor / opponents.length
  let winnerRating = ratingMap.get(winnerKey) ?? INITIAL_ELO
  let winnerDelta = 0

  for (const oppKey of opponents) {
    const oppRating = ratingMap.get(oppKey) ?? INITIAL_ELO
    const expWin = expectedEloScore(winnerRating, oppRating)
    const expOpp = 1 - expWin

    winnerDelta += effectiveK * (1 - expWin)
    const nextOpp = oppRating + effectiveK * (0 - expOpp)
    ratingMap.set(oppKey, nextOpp)
  }

  ratingMap.set(winnerKey, winnerRating + winnerDelta)
}

/**
 * Computes global and per-category Elo ratings across a chronological list of MoA runs.
 *
 * @param {Array<object>} runs - Array of history run objects (oldest to newest)
 * @param {number} [kFactor=32]
 * @returns {{
 *   globalRatings: Map<string, number>,
 *   categoryRatings: Map<string, Map<string, number>>
 * }}
 */
export function computeEloFromRuns(runs = [], kFactor = DEFAULT_K_FACTOR) {
  const globalRatings = new Map()
  const categoryRatings = new Map()

  for (const run of runs) {
    if (!run || !Array.isArray(run.candidates) || run.candidates.length === 0) continue

    const category = run.category || classifyEloCategory(run.prompt || '')
    if (!categoryRatings.has(category)) {
      categoryRatings.set(category, new Map())
    }
    const catMap = categoryRatings.get(category)

    const participantKeys = []
    let winnerKey = null

    const rawWinner = run.winnerModel ? String(run.winnerModel).trim() : null
    const cleanWinner = rawWinner ? rawWinner.replace(/\s*\[fallback for .*\]$/i, '').trim() : null
    const normWinner = cleanWinner && cleanWinner !== 'none' && cleanWinner !== 'unknown'
      ? cleanWinner.replace(/[\/:]/g, ':').toLowerCase()
      : null

    for (let idx = 0; idx < run.candidates.length; idx++) {
      const cand = run.candidates[idx]
      const key = cand.provider && cand.model ? `${cand.provider}:${cand.model}` : (cand.model || 'unknown')
      participantKeys.push(key)
      if (!globalRatings.has(key)) globalRatings.set(key, INITIAL_ELO)
      if (!catMap.has(key)) catMap.set(key, INITIAL_ELO)

      if (!winnerKey) {
        if (normWinner) {
          const normKey = key.replace(/[\/:]/g, ':').toLowerCase()
          const normModel = String(cand.model || '').replace(/[\/:]/g, ':').toLowerCase()
          if (normWinner === normKey || normWinner === normModel || normWinner.endsWith(`:${normModel}`)) {
            winnerKey = key
          }
        }
        if (!winnerKey && typeof run.winnerIndex === 'number' && run.winnerIndex > 0) {
          if (cand.index === run.winnerIndex || idx === run.winnerIndex - 1) {
            winnerKey = key
          }
        }
      }
    }

    if (winnerKey && participantKeys.length >= 2) {
      applyRoundEloUpdate(globalRatings, winnerKey, participantKeys, kFactor)
      applyRoundEloUpdate(catMap, winnerKey, participantKeys, kFactor)
    }
  }

  return { globalRatings, categoryRatings }
}

/**
 * Selects the best preset for a prompt category based on historical Elo ratings of its reference models.
 *
 * @param {string} prompt
 * @param {Array<object>} presets
 * @param {object} leaderboard - Result from getMoaLeaderboard()
 * @returns {{ presetName: string, category: string, avgElo: number } | null}
 */
export function selectBestPresetByElo(prompt = '', presets = [], leaderboard = null) {
  if (!leaderboard || !Array.isArray(leaderboard.models) || leaderboard.models.length === 0) return null
  if (!Array.isArray(presets) || presets.length === 0) return null

  const category = classifyEloCategory(prompt)
  const modelMap = new Map()
  for (const m of leaderboard.models) {
    modelMap.set(m.modelKey, m)
  }

  let bestPreset = null
  let bestElo = -Infinity

  for (const preset of presets) {
    if (preset.enabled === false) continue
    const refs = Array.isArray(preset.reference_models) ? preset.reference_models : []
    if (refs.length === 0) continue

    let sumElo = 0
    let matchedCount = 0
    for (const ref of refs) {
      const key = ref.provider && ref.model ? `${ref.provider}:${ref.model}` : ref.model
      const st = modelMap.get(key)
      if (st) {
        const catElo = st.categoryElo?.[category] ?? st.elo ?? INITIAL_ELO
        sumElo += catElo
        matchedCount++
      }
    }

    if (matchedCount > 0) {
      const avgElo = sumElo / matchedCount
      if (avgElo > bestElo && avgElo > INITIAL_ELO) {
        bestElo = avgElo
        bestPreset = preset.name
      }
    }
  }

  if (!bestPreset) return null
  return {
    presetName: bestPreset,
    category,
    avgElo: Math.round(bestElo),
  }
}
