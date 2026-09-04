/**
 * Mixture of Agents (MoA) execution engine.
 * Inspired by Hermes Agent moa_loop and OpenClaw multi-model orchestration.
 */

export const REFERENCE_SYSTEM_PROMPT = `You are an expert advisor model in a Mixture of Agents (MoA) architecture. You are one of several diverse AI models working together on the user's task.

Your goal is to provide your best, most thoughtful, and complete response or solution to the user's request. Surface key insights, accurate reasoning, correct code or facts, and note any potential pitfalls.

Respond clearly, concisely, and directly. Your response will be reviewed by an aggregator model alongside other models' solutions to synthesize the optimal final result, and will also be displayed to the user.`

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

  return `You are the expert aggregator/judge in a Mixture of Agents (MoA) process. You evaluate solutions from multiple candidate models, judge which one is best (or how to combine their best parts), and deliver the final authoritative verdict and solution.

Original user prompt:
${userPrompt}

Reference responses from candidate models:
${joined}

Instructions:
Your response MUST be structured into two clear parts (respond in the same language as the user's prompt, e.g. Russian):

### 1. ⚖️ Вердикт судьи и анализ вариантов
- **Чей вариант выбран**: Чётко укажи имя модели (например: "Выбран вариант модели Reference 1 (label)" или "Выбран гибридный вариант на основе Reference 1 и Reference 2").
- **Почему сделан этот выбор**: Подробно сравни решения всех кандидатов:
  - Что сделано хорошо и какие сильные стороны у каждого кандидата.
  - Какие ошибки, баги, недочёты или упущения обнаружены у каждого кандидата.
  - Почему итоговый выбор пал именно на этот вариант (или какие конкретные части были взяты от каждой модели).

### 2. 🚀 Итоговое решение
- Предоставь полное, чистое, готовое к использованию решение задачи (код, инструкцию или исчерпывающий ответ), свободное от недочётов кандидатов.`
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

/**
 * Formats full MoA output showing both candidate advisors' answers and the aggregator's synthesis.
 */

/**
 * Formats full MoA output showing both candidate advisors' answers and the aggregator's synthesis.
 */
export function formatMoAResponse({ moaResult, presetName }) {
  const parts = []
  const pName = presetName || moaResult?.presetName || 'default'
  const judge = moaResult?.aggregator || 'unknown'
  const refs = moaResult?.references || []

  parts.push('## 🧠 Mixture of Agents (Пресет: ' + pName + ' | Судья: ' + judge + ')')
  parts.push('')

  if (Array.isArray(refs) && refs.length > 0) {
    parts.push('### 👥 Ответы моделей-советников (' + refs.length + '):')
    parts.push('')
    refs.forEach((ref, i) => {
      const statusIcon = ref.ok ? '✅' : '⚠️'
      parts.push('#### ' + statusIcon + ' Модель ' + (i + 1) + ': ' + ref.label)
      parts.push('')
      parts.push(ref.text)
      parts.push('')
      parts.push('---')
      parts.push('')
    })
  }

  parts.push('### ⚖️ Вердикт судьи и итоговое решение (Синтез: ' + judge + ')')
  parts.push('')
  parts.push(moaResult?.content || '(нет ответа)')

  return parts.join('\n')
}
