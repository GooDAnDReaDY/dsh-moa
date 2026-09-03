/**
 * Mixture of Agents (MoA) execution engine.
 * Inspired by Hermes Agent moa_loop and OpenClaw multi-model orchestration.
 */

export const REFERENCE_SYSTEM_PROMPT = `You are a reference advisor in a Mixture of Agents (MoA) process. You are NOT the acting agent and you do NOT execute anything: you cannot call tools, run commands, browse, or access files, repositories, or URLs, and you should not try to or apologize for being unable to. A separate aggregator/orchestrator model holds those capabilities and will take the actual actions.

The conversation below is the current state of a task handled by that acting agent. Your job is to give your most intelligent analysis of that state: understand the goal, reason about the problem, and advise on what to do next. Surface the best approach, concrete next steps, likely pitfalls and risks, and anything the acting agent may have missed or gotten wrong. Assume any referenced files, URLs, or systems exist and reason about them from the context given rather than asking for access.

Respond with your advice directly — no preamble, no disclaimers about tools or access. Your response is private guidance handed to the aggregator, not an answer shown to the user.`

export function slotLabel(slot) {
  if (!slot || typeof slot !== 'object') return 'unknown'
  const prov = String(slot.provider || '').trim()
  const model = String(slot.model || '').trim()
  if (prov && model) return `${prov}:${model}`
  return prov || model || 'unknown'
}

/**
 * Strips tool results, system prompts, and tool calls from history
 * to give reference advisors a clean, advisory-safe context.
 */
export function cleanAdvisoryMessages(messages = [], maxCharBudget = 4000) {
  const trimmed = []
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    const role = msg.role
    if (role !== 'user' && role !== 'assistant') continue

    let text = ''
    if (typeof msg.content === 'string') {
      text = msg.content
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
    }

    if (!text.trim()) continue

    if (text.length > maxCharBudget) {
      const head = text.slice(0, Math.floor(maxCharBudget * 0.7))
      const tail = text.slice(-Math.floor(maxCharBudget * 0.3))
      text = `${head}\n... [trimmed ${text.length - maxCharBudget} characters] ...\n${tail}`
    }

    trimmed.push({ role, content: text })
  }

  return trimmed
}

export function buildSynthesisPrompt(userPrompt, referenceOutputs = []) {
  const joined = referenceOutputs
    .map((r, i) => `Reference ${i + 1} — ${r.label}:\n${r.text}`)
    .join('\n\n')

  return `You are the aggregator in a Mixture of Agents (MoA) process. You evaluate multiple candidate solutions and synthesize the best possible unified answer.

Original user prompt:
${userPrompt}

Reference responses from candidate models:
${joined}

Instructions:
1. Carefully compare the reference responses above.
2. Identify strengths, accurate facts, and high-quality reasoning in each response.
3. Catch and correct any hallucinations, logical bugs, syntax errors, or oversights present in candidate solutions.
4. Synthesize a comprehensive, authoritative, and polished final response that directly and completely addresses the user's prompt.
5. Output the final solution clearly and directly to the user.`
}

export function parseMoACommand(text, presets = []) {
  if (typeof text !== 'string' || !text.startsWith('/moa')) {
    return null
  }

  const remainder = text.slice(4).trim()
  if (!remainder) {
    return { presetName: 'default', prompt: '' }
  }

  const parts = remainder.split(/\s+/)
  const firstWord = parts[0]
  const matchedPreset = presets.find((p) => p && p.name === firstWord)

  if (matchedPreset) {
    return {
      presetName: matchedPreset.name,
      prompt: remainder.slice(firstWord.length).trim(),
    }
  }

  return {
    presetName: 'default',
    prompt: remainder,
  }
}

/**
 * Dispatches queries to all reference models in parallel.
 */
export async function runReferencesParallel(references, messages, options = {}, callLlm) {
  if (!Array.isArray(references) || references.length === 0) {
    return []
  }

  const advisoryMessages = cleanAdvisoryMessages(messages)
  const systemPrompt = options.systemPrompt || REFERENCE_SYSTEM_PROMPT
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...advisoryMessages]

  const tasks = references.map(async (slot) => {
    const label = slotLabel(slot)
    try {
      const res = await callLlm({
        provider: slot.provider,
        model: slot.model,
        messages: fullMessages,
        temperature: options.referenceTemperature ?? 0.6,
        maxTokens: options.maxTokens ?? 4096,
      })

      const text = (typeof res === 'string' ? res : (res?.content || res?.text || '')).trim()
      return {
        label,
        provider: slot.provider,
        model: slot.model,
        text: text || '(empty response)',
        ok: true,
      }
    } catch (err) {
      return {
        label,
        provider: slot.provider,
        model: slot.model,
        text: `[failed: ${err?.message || String(err)}]`,
        ok: false,
      }
    }
  })

  return Promise.all(tasks)
}

/**
 * Runs the full Mixture of Agents pipeline:
 * 1. Parallel candidate proposers
 * 2. Aggregator synthesis
 */
export async function runMoAPipeline({
  userPrompt,
  messages = [],
  preset,
  callLlm,
}) {
  if (typeof callLlm !== 'function') {
    throw new Error('callLlm function is required for runMoAPipeline')
  }

  const referenceModels = preset?.reference_models || preset?.referenceModels || []
  const aggregator = preset?.aggregator || { provider: 'default', model: 'default' }
  const refTemp = preset?.reference_temperature ?? preset?.referenceTemperature ?? 0.6
  const aggTemp = preset?.aggregator_temperature ?? preset?.aggregatorTemperature ?? 0.4
  const maxTokens = preset?.max_tokens ?? preset?.maxTokens ?? 4096

  // Step 1: Query proposers in parallel
  const referenceOutputs = await runReferencesParallel(
    referenceModels,
    [...messages, { role: 'user', content: userPrompt }],
    { referenceTemperature: refTemp, maxTokens },
    callLlm,
  )

  // Step 2: Synthesis by Aggregator
  const synthPrompt = buildSynthesisPrompt(userPrompt, referenceOutputs)
  const aggLabel = slotLabel(aggregator)

  let synthesizedText = ''
  try {
    const res = await callLlm({
      provider: aggregator.provider,
      model: aggregator.model,
      messages: [{ role: 'user', content: synthPrompt }],
      temperature: aggTemp,
      maxTokens,
    })
    synthesizedText = (typeof res === 'string' ? res : (res?.content || res?.text || '')).trim()
  } catch (err) {
    // If aggregator fails, fallback to joined references so the user still gets candidate insights
    synthesizedText = `[Aggregator error: ${err?.message || String(err)}]\n\nFallback candidate outputs:\n\n` +
      referenceOutputs.map((r, i) => `### ${r.label}\n${r.text}`).join('\n\n')
  }

  return {
    content: synthesizedText,
    aggregator: aggLabel,
    references: referenceOutputs,
    presetName: preset?.name || 'default',
  }
}
