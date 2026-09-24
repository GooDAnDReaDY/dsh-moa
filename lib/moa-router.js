/**
 * Smart Preset Router for Mixture of Agents (MoA).
 * Supports heuristic keyword classification and optional JEV/LLM zero-shot routing.
 */

const INTENT_RULES = [
  { preset: 'security-audit', regex: /\b(security|vulnerability|exploit|cve|xss|injection|sanitize|threat|auth|permission|secret)\b/i },
  { preset: 'bug-hunter', regex: /\b(bug|fix|error|crash|exception|regression|reproduce|broken|fail|issue)\b/i },
  { preset: 'refactor-cleanup', regex: /\b(refactor|clean|simplify|ponytail|yagni|prune|dedup|modular|dead\s*code)\b/i },
  { preset: 'code-review', regex: /\b(review|critique|audit|pr|pull\s*request|diff|inspect|check\s*code)\b/i },
  { preset: 'frontend-ui', regex: /\b(frontend|ui|css|html|react|vue|tailwind|styling|styles?|stylesheet|component|button|layout|page|landing|modal)\b/i },
  { preset: 'deep-architect', regex: /\b(architect|distributed|system|microservice|database|scalab|pipeline|infra|schema)\b/i },
  { preset: 'math-logic', regex: /\b(math|algorithm|proof|matrix|calc|complexity|combinatorics|graph|tree|dynamic\s*programming)\b/i },
  { preset: 'creative-brainstorm', regex: /\b(brainstorm|idea|concept|creative|alternative|options|feature\s*idea)\b/i },
  { preset: 'fast-audit', regex: /\b(quick|fast|brief|summary|one-line|short|tldr)\b/i },
]

/**
 * Fast keyword-based intent classification.
 */
export function classifyPromptIntent(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return null
  const text = prompt.trim()
  for (const rule of INTENT_RULES) {
    if (rule.regex.test(text)) {
      return rule.preset
    }
  }
  return null
}

/**
 * Resolves the optimal preset for a given user prompt.
 */
export async function resolvePresetForPrompt({
  prompt = '',
  presets = [],
  defaultPreset = 'default',
  routingModel = null,
  callLlm = null,
  enabled = false,
  timeoutMs = 2000,
}) {
  const availableNames = (presets || []).map((p) => p.name).filter(Boolean)
  const safeDefault = availableNames.includes(defaultPreset) ? defaultPreset : (availableNames[0] || 'default')

  if (!enabled || !prompt || typeof prompt !== 'string') {
    return { presetName: safeDefault, reason: 'default', isAutoRouted: false }
  }

  // 1. If LLM routing model (e.g. JEV) is configured and callable, run fast zero-shot classifier
  if (routingModel?.provider && routingModel?.model && typeof callLlm === 'function') {
    try {
      const systemPrompt = `You are the MoA Preset Router. Given user prompt, classify which preset is best suited.
Available presets: ${availableNames.join(', ')}
Respond with ONLY the chosen preset name and nothing else.`

      const abortCtrl = new AbortController()
      const timer = setTimeout(() => abortCtrl.abort(), timeoutMs)
      timer.unref?.()

      const res = await callLlm({
        provider: routingModel.provider,
        model: routingModel.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt.slice(0, 500) },
        ],
        temperature: 0.1,
        maxTokens: 30,
        signal: abortCtrl.signal,
      })
      clearTimeout(timer)

      const rawChoice = typeof res === 'string' ? res : (res?.content || res?.text || '')
      const match = availableNames.find((name) => new RegExp(`\\b${name}\\b`, 'i').test(rawChoice))
      if (match) {
        return {
          presetName: match,
          reason: 'llm_classifier',
          routerModel: `${routingModel.provider}:${routingModel.model}`,
          isAutoRouted: true,
        }
      }
    } catch {
      // Fallback silently to heuristic rules on timeout or network error
    }
  }

  // 2. Keyword heuristic classifier
  const heuristic = classifyPromptIntent(prompt)
  if (heuristic && availableNames.includes(heuristic)) {
    return {
      presetName: heuristic,
      reason: 'keyword_heuristic',
      isAutoRouted: true,
    }
  }

  // 3. Fallback to default
  return { presetName: safeDefault, reason: 'default_fallback', isAutoRouted: false }
}