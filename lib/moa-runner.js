/**
 * Mixture of Agents (MoA) execution engine with Interactive Questioning
 * and Isolated Multi-Candidate File Execution.
 */

import {
  extractFileBlocks,
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  cleanMoaWorkspaces,
} from './file-workspace.js'

export {
  extractFileBlocks,
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  cleanMoaWorkspaces,
}

export const REFERENCE_SYSTEM_PROMPT = `You are an expert candidate engineer model in a Mixture of Agents (MoA) architecture.
You are directly implementing the solution for the user's task.

RULES:
1. Do NOT emit internal planning or pretend tool calls (no xml, no <invoke>, no brainstorming delays).
2. Write complete, production-ready, functional code.
3. Every file you produce MUST be formatted in markdown code blocks with clear file path annotation, e.g.:
   \`\`\`html file="index.html"
   ...
   \`\`\`
   or
   \`\`\`javascript file="src/app.js"
   ...
   \`\`\`
4. If the user request is broad, make opinionated, high-quality technical decisions and deliver a complete working project.
5. Never leave placeholders like "// TODO" or "... rest of code". Deliver exhaustive, working code.`

export const ADVISOR_QUESTION_PROMPT = `You are a senior technical advisor in a Mixture of Agents (MoA) architecture.
The user has provided a prompt that may have multiple design choices, architectural paths, or underspecified requirements.

Review the user prompt and identify 1 to 3 critical, high-impact clarifying questions or architectural options that would define the implementation (e.g. framework/vanilla, features, design style, target environment).
Keep questions very clear, structured, and actionable. Avoid trivial questions. Respond directly in Russian.`

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

/**
 * Checks if the prompt should trigger a clarifying questions phase
 * instead of immediate execution.
 */
export function isBroadPromptRequiringQuestions(userPrompt = '', messages = []) {
  const prompt = (userPrompt || '').trim()
  // If the conversation already has prior messages answering questions, don't ask again
  const priorUserMsgs = messages.filter((m) => m && m.role === 'user')
  if (priorUserMsgs.length > 0) return false

  // Trigger on Russian broad verbs and general concepts
  const lower = prompt.toLowerCase()
  const broadKeywords = ['создай', 'сделай', 'разработай']
  const hasBroadKeyword = broadKeywords.some((k) => lower.includes(k))

  // If it contains "создай" / "сделай" and is relatively brief (<= 8 words)
  if (hasBroadKeyword) {
    const wordCount = prompt.split(/\s+/).filter(Boolean).length
    if (wordCount <= 8) return true
  }

  return false
}

export function buildQuestionSynthesisPrompt(userPrompt, referenceOutputs = []) {
  const joined = referenceOutputs
    .map((r, i) => `Советник ${i + 1} (${r.label}):\n${r.text}`)
    .join('\n\n')

  return `Ты — ведущий архитектор и судья в архитектуре Mixture of Agents (MoA).
Пользователь дал задачу:
"${userPrompt}"

Советники предложили следующие развилки и уточнения:
${joined}

Твоя задача — синтезировать единый, компактный, дружелюбный и структурированный опросник (2-4 вопроса) для пользователя на русском языке.
Каждый вопрос должен предлагать 2-3 конкретных рекомендуемых варианта ответа (например: 1. Формат: HTML/JS в одном файле или React? 2. Стиль: Минимализм, iOS или Необрутализм?).
В конце добавь примечание, что пользователь может ответить кратко (например: "1, 2, темная тема") или довериться выбору по умолчанию.`
}

export function buildSynthesisPrompt(userPrompt, referenceOutputs = []) {
  const joined = referenceOutputs
    .map((r, i) => {
      const fileSummary = (r.files && r.files.length > 0)
        ? ` [Созданные файлы: ${r.files.map((f) => f.relativePath).join(', ')}]`
        : ''
      return `Reference ${i + 1} — ${r.label}:${fileSummary ? ` ${fileSummary}` : ""}\n${r.text}`
    })
    .join('\n\n')

  return `You are the expert aggregator/judge in a Mixture of Agents (MoA) process. You evaluate solutions from multiple candidate models, judge which one is best (or how to combine their best parts), and deliver the final authoritative verdict and solution.

Original user prompt:
${userPrompt}

Reference responses from candidate models:
${joined}

Instructions:
Your response MUST be structured into three clear parts (respond in the same language as the user's prompt, e.g. Russian):

### 1. ⚖️ Вердикт судьи и анализ вариантов
- **Чей вариант выбран**: Чётко укажи имя модели и номер кандидата (например: "Победитель: Кандидат 1 (opencode-go:deepseek-v4-flash)" или "Выбран вариант модели Reference 1 (label)").
- Обязательно добавь машинный маркер выбора победителя:
  WINNER_CANDIDATE_INDEX: <число от 1 до N>
- **Почему сделан этот выбор**: Подробно сравни код, архитектуру, сильные стороны, недочёты и надёжность всех кандидатов.

### 2. 📁 Созданные файлы проекта
- Перечисли файлы победителя, которые были перенесены в корень проекта, и их назначение.

### 3. 🚀 Инструкция по запуску и использованию
- Опиши, как открыть и запустить созданный проект.`
}

export function parseWinnerIndex(judgeText, defaultIndex = 1) {
  if (!judgeText || typeof judgeText !== 'string') return defaultIndex
  const match = /WINNER_CANDIDATE_INDEX:\s*(\d+)/i.exec(judgeText)
  if (match) {
    const idx = parseInt(match[1], 10)
    if (!isNaN(idx) && idx >= 1) return idx
  }
  // Fallback: look for "Кандидат 1", "Reference 1", "Кандидат 2", "Reference 2"
  if (/(?:Кандидат|Reference)\s*2\b/i.test(judgeText) && !/(?:Кандидат|Reference)\s*1\b/i.test(judgeText)) {
    return 2
  }
  return defaultIndex
}

export function parseMoACommand(text, presets = []) {
  if (typeof text !== 'string' || !text.startsWith('/moa')) {
    return null
  }

  const remainder = text.slice(4).trim()
  if (!remainder) {
    return {
      presetName: 'default',
      prompt: '',
    }
  }

  const matchPreset = /^--preset=([a-zA-Z0-9_-]+)\s*(.*)/s.exec(remainder)
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
 * Dispatches queries to all reference models in parallel.
 */
export async function runReferencesParallel(references, messages, options = {}, callLlm) {
  if (!Array.isArray(references) || references.length === 0) {
    return []
  }

  const advisoryMessages = cleanAdvisoryMessages(messages)
  const systemPrompt = options.systemPrompt || REFERENCE_SYSTEM_PROMPT
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...advisoryMessages]

  const tasks = references.map(async (slot, i) => {
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
      const files = extractFileBlocks(text)

      return {
        index: i + 1,
        label,
        provider: slot.provider,
        model: slot.model,
        text: text || '(empty response)',
        files,
        ok: true,
      }
    } catch (err) {
      return {
        index: i + 1,
        label,
        provider: slot.provider,
        model: slot.model,
        text: `[failed: ${err?.message || String(err)}]`,
        files: [],
        ok: false,
      }
    }
  })

  return Promise.all(tasks)
}

/**
 * Runs the full Mixture of Agents pipeline:
 * 1. Checks if questions are needed
 * 2. Parallel candidate proposers write to .moa/candidate-X/
 * 3. Aggregator judges and picks winner
 * 4. Promotes winner files and cleans up
 */
export async function runMoAPipeline({
  userPrompt,
  messages = [],
  preset,
  callLlm,
  cwd,
  onProgress,
  skipQuestions = false,
}) {
  if (typeof callLlm !== 'function') {
    throw new Error('callLlm function is required for runMoAPipeline')
  }

  const referenceModels = preset?.reference_models || preset?.referenceModels || []
  const aggregator = preset?.aggregator || { provider: 'default', model: 'default' }
  const refTemp = preset?.reference_temperature ?? preset?.referenceTemperature ?? 0.6
  const aggTemp = preset?.aggregator_temperature ?? preset?.aggregatorTemperature ?? 0.4
  const maxTokens = preset?.max_tokens ?? preset?.maxTokens ?? 4096
  const workDir = cwd || process.cwd()

  // Phase 1: Check if clarifying questions should be asked
  const needsQuestions = !skipQuestions && isBroadPromptRequiringQuestions(userPrompt, messages)
  if (needsQuestions) {
    if (typeof onProgress === 'function') {
      onProgress('🔍 *Задача требует уточнения. Советники формируют ключевые вопросы...*\n\n')
    }

    const questionOutputs = await runReferencesParallel(
      referenceModels,
      [...messages, { role: 'user', content: userPrompt }],
      { systemPrompt: ADVISOR_QUESTION_PROMPT, referenceTemperature: 0.5, maxTokens: 1024 },
      callLlm,
    )

    const qSynthPrompt = buildQuestionSynthesisPrompt(userPrompt, questionOutputs)
    let questionsText = ''
    try {
      const res = await callLlm({
        provider: aggregator.provider,
        model: aggregator.model,
        messages: [{ role: 'user', content: qSynthPrompt }],
        temperature: 0.3,
        maxTokens: 1500,
      })
      questionsText = (typeof res === 'string' ? res : (res?.content || res?.text || '')).trim()
    } catch (err) {
      questionsText = `Не удалось сформировать вопросы судьи: ${err?.message || String(err)}`
    }

    return {
      kind: 'questions',
      content: questionsText,
      aggregator: slotLabel(aggregator),
      references: questionOutputs,
      presetName: preset?.name || 'default',
    }
  }

  // Phase 2: Parallel execution & file generation
  if (typeof onProgress === 'function') {
    onProgress(`🚀 *Запускаю параллельную реализацию советниками (${referenceModels.length})...*\n\n`)
  }

  const referenceOutputs = await runReferencesParallel(
    referenceModels,
    [...messages, { role: 'user', content: userPrompt }],
    { referenceTemperature: refTemp, maxTokens },
    callLlm,
  )

  // Write files for each candidate into .moa/candidate-X/
  for (let i = 0; i < referenceOutputs.length; i++) {
    const ref = referenceOutputs[i]
    if (ref.ok && ref.files && ref.files.length > 0) {
      try {
        await writeCandidateWorkspace(workDir, i + 1, ref.files)
        if (typeof onProgress === 'function') {
          onProgress(`📁 *Кандидат ${i + 1} (${ref.label}) создал ${ref.files.length} файл(а) в .moa/candidate-${i + 1}/*\n\n`)
        }
      } catch (writeErr) {
        console.warn(`[dsh-moa] Failed to write candidate ${i + 1} workspace:`, writeErr)
      }
    }
  }

  // Phase 3: Aggregator evaluation
  if (typeof onProgress === 'function') {
    onProgress(`⚖️ *Судья (${slotLabel(aggregator)}) анализирует код и файлы кандидатов...*\n\n`)
  }

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
    synthesizedText = `[Aggregator error: ${err?.message || String(err)}]\n\nFallback candidate outputs:\n\n` +
      referenceOutputs.map((r, i) => `### ${r.label}\n${r.text}`).join('\n\n')
  }

  // Phase 4: Promote winner files and cleanup
  const winningIndex = parseWinnerIndex(synthesizedText, 1)
  let promotedFiles = []
  try {
    promotedFiles = await promoteCandidateWorkspace(workDir, winningIndex)
    if (typeof onProgress === 'function' && promotedFiles.length > 0) {
      onProgress(`✅ *Файлы победителя (Кандидат ${winningIndex}) успешно перенесены в проект: ${promotedFiles.join(', ')}*\n\n`)
    }
  } catch (promoteErr) {
    console.warn('[dsh-moa] Error promoting candidate files:', promoteErr)
  }

  return {
    kind: 'synthesis',
    content: synthesizedText,
    aggregator: aggLabel,
    references: referenceOutputs,
    presetName: preset?.name || 'default',
    winningIndex,
    promotedFiles,
  }
}

/**
 * Formats full MoA output showing candidate outputs, judge synthesis, and promoted files.
 */
export function formatMoAResponse({ moaResult, presetName }) {
  const parts = []
  const pName = presetName || moaResult?.presetName || 'default'
  const judge = moaResult?.aggregator || 'unknown'
  const refs = moaResult?.references || []

  if (moaResult?.kind === 'questions') {
    parts.push('## 🧠 Mixture of Agents — Уточнение требований')
    parts.push(`*Судья (${judge}) и советники проанализировали задачу:*\n`)
    parts.push(moaResult.content)
    return parts.join('\n')
  }

  parts.push(`## 🧠 Mixture of Agents (Пресет: ${pName} | Судья: ${judge})`)
  parts.push('')

  if (moaResult?.promotedFiles && moaResult.promotedFiles.length > 0) {
    parts.push(`> 📦 **Созданы файлы в проекте**: \`${moaResult.promotedFiles.join('`, `')}\``)
    parts.push('')
  }

  if (Array.isArray(refs) && refs.length > 0) {
    parts.push(`### 👥 Ответы моделей-советников (${refs.length}):`)
    parts.push('')
    refs.forEach((ref, i) => {
      const statusIcon = ref.ok ? '✅' : '⚠️'
      const fileBadge = ref.files?.length ? ` (${ref.files.length} файл(ов))` : ''
      parts.push(`#### ${statusIcon} Модель ${i + 1}: ${ref.label}${fileBadge}`)
      parts.push('')
      parts.push(ref.text)
      parts.push('')
      parts.push('---')
      parts.push('')
    })
  }

  parts.push(`### ⚖️ Вердикт судьи и итоговое решение (Синтез: ${judge})`)
  parts.push('')
  parts.push(moaResult?.content || '(нет ответа)')

  return parts.join('\n')
}

export class MoaRunnerAdapter {
  constructor(getMoaContext) {
    this.getMoaContext = getMoaContext
  }

  providerInfo(provider) {
    return { id: provider, name: 'Mixture of Agents Runner' }
  }

  providerRetryPolicy(_provider) {
    return undefined
  }

  imageRequestPricing(_provider, _model) {
    return undefined
  }

  async listModels() {
    return [{ id: 'ensemble', name: 'MoA Ensemble' }]
  }

  async resolveModel(provider, model) {
    return { provider, id: model, name: 'MoA Ensemble' }
  }

  async prepareCall(provider, model) {
    return {
      model: { provider, id: model, name: 'MoA Ensemble' },
      stream: (options) => this.stream(options),
    }
  }

  async *stream(options) {
    const signal = options.signal
    if (signal?.aborted) return

    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: '🧠 *Mixture of Agents запущен...*\n\n' }

    const { targetPreset, userPrompt, messages, callLlm, cwd } = this.getMoaContext(options)

    // Queue for streaming progress updates from within runMoAPipeline
    const progressChunks = []
    const onProgress = (text) => {
      progressChunks.push(text)
    }

    try {
      const pipelinePromise = runMoAPipeline({
        userPrompt,
        messages,
        preset: targetPreset,
        callLlm,
        cwd,
        onProgress,
      })

      // Interval to yield progressive updates while pipeline runs
      while (true) {
        if (signal?.aborted) return
        while (progressChunks.length > 0) {
          const chunk = progressChunks.shift()
          yield { type: 'text-delta', index: 0, text: chunk }
        }
        const done = await Promise.race([
          pipelinePromise.then(() => true),
          new Promise((r) => setTimeout(() => r(false), 250)),
        ])
        if (done) break
      }

      while (progressChunks.length > 0) {
        const chunk = progressChunks.shift()
        yield { type: 'text-delta', index: 0, text: chunk }
      }

      const moaResult = await pipelinePromise
      if (signal?.aborted) return

      const formatted = formatMoAResponse({
        moaResult,
        presetName: targetPreset?.name || 'default',
      })

      yield { type: 'text-delta', index: 0, text: '\n---\n\n' + formatted }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: formatted } }
      yield { type: 'usage', usage: { inputTokens: 100, outputTokens: formatted.length } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } catch (err) {
      if (signal?.aborted) return
      const errText = '\n\n⚠️ **Ошибка Mixture of Agents**: ' + (err?.message || String(err))
      yield { type: 'text-delta', index: 0, text: errText }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: errText } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
}
