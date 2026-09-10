/**
 * Mixture of Agents (MoA) Orchestrator Engine (#1 - #16)
 *
 * Implements:
 * 1. Parallel candidate proposers with isolated workspaces (.moa/candidate-X/)
 * 2. Real-time multi-file block extractor and project context collector
 * 3. Iterative modification (Refinement) vs greenfield project awareness
 * 4. Aggregator / Judge synthesis prompt and candidate winner evaluation
 * 5. Automatic promotion of winning candidate files to workspace root
 * 6. Native Live Canvas visual preview generation for interactive apps
 * 7. Real-time cost tracking, token metrics and history logging
 * 8. Zero-latency async push-queue streaming for llm/stream turns
 */

import {
  extractFileBlocks,
  collectProjectContext,
  isRefinementTask,
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  cleanMoaWorkspaces,
} from './file-workspace.js'

import { estimateTokenCost } from './pricing.js'
import { recordMoaRun } from './history.js'

export { estimateTokenCost } from './pricing.js'

export const DEFAULT_PROMPT = 'Please propose an optimal, well-structured, production-ready solution with full code and explanations.'

export const REFERENCE_SYSTEM_PROMPT = `You are an expert AI software architect and senior engineer acting as a candidate proposer in a Mixture of Agents (MoA) ensemble.
Your task is to provide the highest-quality, robust, complete, production-ready solution to the user request.
Write clean, modern, fully functional code without placeholders or shortcuts.
When generating files for a project, explicitly specify file paths using fenced code blocks with file annotations, e.g.:
\`\`\`html file="index.html"
\`\`\`
\`\`\`javascript file="script.js"
\`\`\`
\`\`\`css file="style.css"
\`\`\``

export function slotLabel(slot) {
  if (!slot) return 'unknown'
  if (typeof slot === 'string') return slot
  if (slot.provider && slot.model) return `${slot.provider}:${slot.model}`
  return slot.model || slot.provider || 'unknown'
}

/**
 * Extracts and sanitizes conversation history for candidate models.
 * Robust against complex DSH message content types (strings, part arrays, objects, tool calls).
 */
export function cleanAdvisoryMessages(messages = [], maxCharBudget = 24000) {
  if (!Array.isArray(messages)) return []

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
        .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
    } else if (msg.content && typeof msg.content === 'object') {
      if (typeof msg.content.text === 'string') {
        text = msg.content.text
      } else if (typeof msg.content.content === 'string') {
        text = msg.content.content
      }
    } else if (typeof msg.text === 'string') {
      text = msg.text
    }

    text = text.trim()
    if (!text) continue

    if (text.length > maxCharBudget) {
      const head = text.slice(0, Math.floor(maxCharBudget * 0.7))
      const tail = text.slice(-Math.floor(maxCharBudget * 0.3))
      text = `${head}\n... [trimmed ${text.length - maxCharBudget} characters] ...\n${tail}`
    }

    trimmed.push({ role, content: text })
  }
  return trimmed
}

export function isBroadPromptRequiringQuestions(userPrompt = '', messages = []) {
  if (!userPrompt || typeof userPrompt !== 'string') return false
  const p = userPrompt.trim()
  const wordCount = p.split(/\s+/).length

  if (/^(да|нет|1|2|3|4|ок|погнали|давай|yes|no)\b/i.test(p) && wordCount <= 5) {
    return false
  }

  const hasRecentQuestion = messages.some((m) => {
    const text = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content || '')
    return text.includes('Уточнение требований') || text.includes('опросник') || text.includes('Вариант 1')
  })
  if (hasRecentQuestion) {
    return false
  }

  const creationTriggers = [
    'сделай', 'создай', 'напиши', 'разработай', 'придумай', 'реализуй',
    'make', 'build', 'create', 'generate', 'develop',
  ]
  const startsWithCreation = creationTriggers.some((t) => p.toLowerCase().startsWith(t))

  if (startsWithCreation && wordCount <= 18) {
    return true
  }

  const vagueNouns = ['приложение', 'игру', 'сервис', 'сайт', 'лендинг', 'калькулятор', 'виджет', 'дашборд', 'app', 'game', 'tool', 'website']
  if (vagueNouns.some((n) => p.toLowerCase().includes(n))) {
    if (wordCount <= 12) return true
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

export function buildSynthesisPrompt(userPrompt, referenceOutputs = [], judgeCriteria = '') {
  const joined = referenceOutputs
    .map((r, i) => {
      const fileSummary = (r.files && r.files.length > 0)
        ? ` [Созданные файлы: ${r.files.map((f) => f.relativePath).join(', ')}]`
        : ''
      // If 3+ candidates, summarize text to prevent judge context overflow (#13)
      let textContent = r.text
      if (referenceOutputs.length >= 3 && textContent.length > 3000) {
        textContent = stripOrSummarizeCode(textContent)
      }
      return `Reference ${i + 1} — ${r.label}:${fileSummary}\n${textContent}`
    })
    .join('\n\n')

  const criteriaBlock = judgeCriteria && judgeCriteria.trim()
    ? `\n### 🎯 Дополнительные критерии оценки от пользователя:\n${judgeCriteria.trim()}\n`
    : ''

  return `You are the expert aggregator/judge in a Mixture of Agents (MoA) process. You evaluate solutions from multiple candidate models, judge which one is best (or how to combine their best parts), and deliver the final authoritative verdict and solution.

Original user prompt:
${userPrompt}
${criteriaBlock}
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
  const candMatch = /(?:Кандидат|Reference)\s*(\d+)\b/i.exec(judgeText)
  if (candMatch) {
    const idx = parseInt(candMatch[1], 10)
    if (!isNaN(idx) && idx >= 1) return idx
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
 * Dispatches queries to all reference models in parallel.
 */
export async function runReferencesParallel(references, messages, options = {}, callLlm, onProgress) {
  if (!Array.isArray(references) || references.length === 0) {
    return []
  }

  const advisoryMessages = cleanAdvisoryMessages(messages)
  const systemPrompt = options.systemPrompt || REFERENCE_SYSTEM_PROMPT
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...advisoryMessages]
  const timeoutMs = options.timeoutMs ?? 75000

  const tasks = references.map(async (slot, i) => {
    const label = slotLabel(slot)
    if (typeof onProgress === 'function') {
      onProgress(`⚡ *Кандидат ${i + 1} (${label}) начал генерацию...*\n`)
    }

    try {
      const callPromise = callLlm({
        provider: slot.provider,
        model: slot.model,
        messages: fullMessages,
        temperature: options.temperature ?? 0.6,
        maxTokens: options.maxTokens ?? 4096,
      })

      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s`)), timeoutMs)
        timer.unref?.()
      })

      const res = await Promise.race([callPromise, timeoutPromise])
      const text = typeof res === 'string' ? res : (res?.content || res?.text || '')

      const fallbackUsage = (typeof res === 'object' && res?.usage) ? res.usage : {
        inputTokens: Math.max(1, Math.round(fullMessages.map((m) => m.content).join('').length / 4)),
        outputTokens: Math.max(1, Math.round(text.length / 4)),
      }
      const costInfo = estimateTokenCost(slot, fallbackUsage)

      if (typeof onProgress === 'function') {
        const costStr = costInfo.costUsd > 0 ? ` (~\$${costInfo.costUsd.toFixed(4)})` : ''
        onProgress(`✅ *Кандидат ${i + 1} (${label}) завершил ответ${costStr}*\n`)
      }

      return {
        index: i + 1,
        slot,
        label,
        text,
        usage: costInfo,
        costUsd: costInfo.costUsd,
        ok: true,
      }
    } catch (err) {
      const errMsg = err?.message || String(err)
      console.warn(`[dsh-moa] Reference ${label} failed:`, errMsg)
      if (typeof onProgress === 'function') {
        onProgress(`⚠️ *Кандидат ${i + 1} (${label}) ошибка: ${errMsg}*\n`)
      }
      return {
        index: i + 1,
        slot,
        label,
        text: `[Ошибка модели ${label}: ${errMsg}]`,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        costUsd: 0,
        ok: false,
        error: errMsg,
      }
    }
  })

  return Promise.all(tasks)
}

/**
 * Main MoA pipeline runner.
 */
export async function runMoAPipeline({
  userPrompt,
  messages = [],
  preset,
  callLlm,
  cwd = process.cwd(),
  onProgress,
}) {
  const startTime = Date.now()
  const referenceModels = preset?.reference_models || [
    { provider: 'opencode-go', model: 'deepseek-v4-flash' },
    { provider: 'grok', model: 'grok-build-0.1' },
  ]
  const aggregator = preset?.aggregator || { provider: 'codex', model: 'gpt-5.6-sol' }
  const aggLabel = slotLabel(aggregator)
  const refTemp = preset?.reference_temperature ?? 0.6
  const aggTemp = preset?.aggregator_temperature ?? 0.4
  const maxTokens = preset?.max_tokens ?? 4096
  const judgeCriteria = preset?.judge_criteria ?? ''
  const isFastMode = referenceModels.length === 1 && !preset?.force_aggregator

  // 1. Collect current project workspace context (#6)
  if (typeof onProgress === 'function') {
    onProgress('🔍 *Сканирование контекста проекта...*\n')
  }
  const projectContext = await collectProjectContext(cwd)
  const isRefinement = isRefinementTask(userPrompt, projectContext.files)

  // 2. Check if broad prompt requires user questionnaire (#7)
  const askQuestions = preset?.ask_clarifying_questions !== false
  const needsQuestions = !isFastMode && askQuestions && !isRefinement && isBroadPromptRequiringQuestions(userPrompt, messages)

  // 3. Build enriched prompt for candidates
  let candidateSystemPrompt = REFERENCE_SYSTEM_PROMPT
  if (isRefinement && projectContext.files.length > 0) {
    const fileList = projectContext.files.map((f) => `- \`${f.relativePath}\` (${f.content.length} chars)`).join('\n')
    const fileContents = projectContext.files.map((f) => `### File: ${f.relativePath}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
    candidateSystemPrompt += `\n\nExisting project structure:\n${fileList}\n\nProject files:\n${fileContents}\n\nYou are modifying an existing project. Output modified or new files with explicit file paths.`
  }

  let promptForCandidates = userPrompt
  if (needsQuestions) {
    promptForCandidates += '\n(Примечание: задача широкая. Предложи ключевые архитектурные и функциональные развилки для уточнения требований пользователя).'
  }

  const enrichedMessages = [...messages, { role: 'user', content: promptForCandidates }]

  // 4. Parallel fan-out to candidate models
  if (typeof onProgress === 'function') {
    onProgress(`🚀 *Запуск ${referenceModels.length} моделей-кандидатов параллельно...*\n`)
  }

  const referenceOutputs = await runReferencesParallel(
    referenceModels,
    enrichedMessages,
    { systemPrompt: candidateSystemPrompt, temperature: refTemp, maxTokens },
    callLlm,
    onProgress
  )

  // Fail fast if all candidates failed (#12)
  const successfulRefs = referenceOutputs.filter((r) => r.ok)
  if (successfulRefs.length === 0) {
    const reasons = referenceOutputs.map((r) => `${r.label}: ${r.error || 'unknown error'}`).join('; ')
    return {
      kind: 'failure',
      content: `⚠️ Все модели-советники (${referenceOutputs.length}) завершились с ошибкой: ${reasons}`,
      aggregator: aggLabel,
      references: referenceOutputs,
      presetName: preset?.name || 'default',
      isRefinement,
      isFastMode,
      winningIndex: 0,
      winnerModel: 'none',
      promotedFiles: [],
      usage: {
        totalTokens: 0,
        totalCostUsd: 0,
        candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
        aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      },
      durationMs: Date.now() - startTime,
    }
  }

  // 5. Extract file blocks & write candidate workspaces (#1, #2)
  for (let i = 0; i < referenceOutputs.length; i++) {
    const ref = referenceOutputs[i]
    if (!ref.ok) continue
    const files = extractFileBlocks(ref.text)
    ref.files = files
    if (files.length > 0) {
      await writeCandidateWorkspace(cwd, i + 1, files)
    }
  }

  // 6. Questionnaire synthesis branch (#7)
  if (needsQuestions) {
    if (typeof onProgress === 'function') {
      onProgress('📋 *Синтез опросника судьей...*\n')
    }
    const questionPrompt = buildQuestionSynthesisPrompt(userPrompt, referenceOutputs)
    let questionsContent = ''
    try {
      const qRes = await callLlm({
        provider: aggregator.provider,
        model: aggregator.model,
        messages: [{ role: 'user', content: questionPrompt }],
        temperature: 0.3,
        maxTokens: 2048,
      })
      questionsContent = typeof qRes === 'string' ? qRes : (qRes?.content || qRes?.text || '')
    } catch {
      questionsContent = '### Уточнение требований к проекту\nПожалуйста, уточните детали реализации и желаемый стек.'
    }

    return {
      kind: 'questions',
      content: questionsContent,
      references: referenceOutputs,
      presetName: preset?.name || 'default',
      isRefinement: false,
    }
  }

  // 7. Fast mode bypass for single candidate
  if (isFastMode) {
    const single = referenceOutputs[0]
    let promotedFiles = []
    if (single.files && single.files.length > 0) {
      promotedFiles = await promoteCandidateWorkspace(cwd, 1)
    } else {
      await cleanMoaWorkspaces(cwd)
    }

    const totalTokens = single.usage?.totalTokens || 0
    const totalCostUsd = single.costUsd || 0
    const durationMs = Date.now() - startTime

    return {
      kind: 'synthesis',
      content: single.text,
      aggregator: 'Fast Mode (Direct)',
      references: referenceOutputs,
      presetName: preset?.name || 'default',
      isRefinement,
      isFastMode: true,
      winningIndex: 1,
      winnerModel: single.label,
      promotedFiles,
      usage: {
        totalTokens,
        totalCostUsd,
        candidates: [{ label: single.label, usage: single.usage, costUsd: single.costUsd }],
        aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      },
      durationMs,
    }
  }

  // 8. Aggregator / Judge synthesis (#5, #8)
  if (typeof onProgress === 'function') {
    onProgress(`⚖️ *Ведущая модель (${aggLabel}) оценивает варианты и синтезирует решение...*\n`)
  }

  const synthesisPrompt = buildSynthesisPrompt(userPrompt, referenceOutputs, judgeCriteria)
  let synthesizedText = ''
  let aggUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }

  try {
    const aggRes = await callLlm({
      provider: aggregator.provider,
      model: aggregator.model,
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: aggTemp,
      maxTokens,
    })
    synthesizedText = typeof aggRes === 'string' ? aggRes : (aggRes?.content || aggRes?.text || '')
    const aggFallbackUsage = (typeof aggRes === 'object' && aggRes?.usage) ? aggRes.usage : {
      inputTokens: Math.max(1, Math.round(synthesisPrompt.length / 4)),
      outputTokens: Math.max(1, Math.round(synthesizedText.length / 4)),
    }
    aggUsage = estimateTokenCost(aggregator, aggFallbackUsage)
  } catch (err) {
    console.warn(`[dsh-moa] Aggregator ${aggLabel} failed:`, err)
    synthesizedText = `⚠️ *[Aggregator error: ${err?.message || err}. Fallback candidate outputs:]*\n\n` +
      successfulRefs.map((r, i) => `### Кандидат ${i + 1} (${r.label})\n${r.text}`).join('\n\n')
  }

  // 9. Evaluate winner & promote files (#1, #2)
  const winningIndex = parseWinnerIndex(synthesizedText, 1)
  let promotedFiles = []
  if (referenceOutputs[winningIndex - 1]?.files?.length > 0) {
    promotedFiles = await promoteCandidateWorkspace(cwd, winningIndex)
  } else if (successfulRefs[0]?.files?.length > 0) {
    const fallbackIdx = successfulRefs[0].index
    promotedFiles = await promoteCandidateWorkspace(cwd, fallbackIdx)
  } else {
    await cleanMoaWorkspaces(cwd)
  }

  // 10. Live Canvas preview (#16)
  let liveCanvas = null
  const htmlFile = promotedFiles.find((f) => f.endsWith('.html') || f.endsWith('index.html'))
  if (htmlFile) {
    liveCanvas = {
      previewUrl: `http://localhost:3000/preview/${encodeURIComponent(htmlFile)}`,
      file: htmlFile,
      title: 'Interactive Web Preview',
    }
  }

  const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0) + aggUsage.totalTokens
  const totalCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + aggUsage.costUsd).toFixed(5))
  const durationMs = Date.now() - startTime

  const winningRef = referenceOutputs[winningIndex - 1]
  const winnerModel = winningRef?.label || slotLabel(referenceModels[0])

  // Record run to history (#9, #10, #11)
  try {
    recordMoaRun({
      prompt: userPrompt,
      preset: preset?.name || 'default',
      isRefinement,
      candidates: referenceOutputs,
      aggregator: isFastMode ? null : { provider: aggregator.provider, model: aggregator.model, usage: aggUsage, costUsd: aggUsage.costUsd },
      winnerIndex: winningIndex,
      winnerModel,
      promotedFiles,
      totalTokens,
      totalCostUsd,
      durationMs,
    })
  } catch (histErr) {
    console.warn('[dsh-moa] Failed to record run in history:', histErr)
  }

  return {
    kind: 'synthesis',
    content: synthesizedText,
    aggregator: isFastMode ? 'Fast Mode (Direct)' : aggLabel,
    references: referenceOutputs,
    presetName: preset?.name || 'default',
    isRefinement,
    isFastMode,
    winningIndex,
    winnerModel,
    promotedFiles,
    liveCanvas,
    usage: {
      totalTokens,
      totalCostUsd,
      candidates: referenceOutputs.map(r => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
      aggregator: aggUsage,
    },
    durationMs,
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
    const label = fileHint ? `файл \`${fileHint}\`` : (lang ? `код \`${lang}\`` : 'код')
    return `\n> 📄 *[${label} — ${lines.length} строк сохранены на диск]*\n`
  })
}

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

  if (moaResult?.kind === 'failure') {
    parts.push('## ⚠️ Mixture of Agents — Сбой выполнения')
    parts.push(moaResult.content)
    return parts.join('\n')
  }

  const modeBadge = moaResult?.isFastMode ? '⚡ Fast Mode' : `Судья: ${judge}`
  parts.push(`## 🧠 Mixture of Agents (Пресет: ${pName} | ${modeBadge})`)
  parts.push('')

  if (moaResult?.isRefinement) {
    parts.push('> 🔄 **Режим**: Итеративная доработка проекта (Refinement)')
  }

  const hasPromoted = moaResult?.promotedFiles && moaResult.promotedFiles.length > 0
  if (hasPromoted) {
    parts.push(`> 📦 **Созданы файлы в проекте**: \`${moaResult.promotedFiles.join('`, `')}\``)
  }

  if (moaResult?.liveCanvas?.previewUrl) {
    parts.push(`> 🎨 **Live Canvas**: [🚀 Открыть ${moaResult.liveCanvas.title || 'превью'} в Live Canvas](${moaResult.liveCanvas.previewUrl}) | [↗ Открыть в новой вкладке](${moaResult.liveCanvas.previewUrl})`)
  }

  // Cost tracking card (#10)
  if (moaResult?.usage) {
    const u = moaResult.usage
    const costStr = u.totalCostUsd > 0 ? `~\$${u.totalCostUsd.toFixed(4)}` : 'Бесплатно'
    const tokStr = u.totalTokens >= 1000 ? `${(u.totalTokens / 1000).toFixed(1)}k` : `${u.totalTokens}`
    parts.push(`> 💰 **Стоимость запуска**: ${costStr} (всего ${tokStr} токенов)`)
  }

  parts.push('')

  if (!moaResult?.isFastMode) {
    parts.push(`### ⚖️ Вердикт судьи и итоговое решение (Синтез: ${judge})`)
    parts.push('')
    const cleanJudgeContent = hasPromoted
      ? stripOrSummarizeCode(moaResult?.content || '')
      : (moaResult?.content || '(нет ответа)')
    parts.push(cleanJudgeContent)
    parts.push('')
  }

  if (Array.isArray(refs) && refs.length > 0) {
    const title = moaResult?.isFastMode ? '### 🚀 Результат генерации кандидата:' : `### 👥 Ответы моделей-советников (${refs.length}):`
    parts.push(title)
    parts.push('')
    refs.forEach((ref, i) => {
      const statusIcon = ref.ok ? '✅' : '⚠️'
      const fileBadge = ref.files?.length ? ` (${ref.files.length} файл(ов))` : ''
      const costBadge = ref.costUsd > 0 ? ` [~\$${ref.costUsd.toFixed(4)}]` : ''
      parts.push(`#### ${statusIcon} Модель ${i + 1}: ${ref.label}${fileBadge}${costBadge}`)
      parts.push('')
      parts.push(stripOrSummarizeCode(ref.text))
      parts.push('')
      parts.push('---')
      parts.push('')
    })
  }

  return parts.join('\n')
}

export async function* streamMoATurn({ targetPreset, userPrompt, messages, callLlm, cwd }, options = {}) {
  const signal = options?.signal
  if (signal?.aborted) return

  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'text-delta', index: 0, text: '🧠 *Mixture of Agents запущен...*\n\n' }

  // Async push-queue for zero-latency live delta streaming
  const queue = []
  let notify = null

  const pushUpdate = (text) => {
    queue.push({ type: 'text-delta', index: 0, text })
    if (notify) {
      notify()
      notify = null
    }
  }

  let done = false
  const pipelinePromise = runMoAPipeline({
    userPrompt,
    messages,
    preset: targetPreset,
    callLlm,
    cwd,
    onProgress: pushUpdate,
  })
    .catch((err) => ({ error: err }))
    .finally(() => {
      done = true
      if (notify) {
        notify()
        notify = null
      }
    })

  const startTime = Date.now()
  let lastYieldTime = Date.now()

  try {
    while (!done || queue.length > 0) {
      if (signal?.aborted) {
        await cleanMoaWorkspaces(cwd)
        return
      }

      while (queue.length > 0) {
        const item = queue.shift()
        yield item
        lastYieldTime = Date.now()
      }

      if (done) break

      // Wait for next push item or max 2.5s heartbeat
      await Promise.race([
        new Promise((resolve) => { notify = resolve }),
        new Promise((resolve) => { const t = setTimeout(resolve, 2500); t.unref?.(); }),
      ])

      const elapsedSec = Math.floor((Date.now() - startTime) / 1000)
      if (!done && Date.now() - lastYieldTime >= 3000) {
        yield { type: 'text-delta', index: 0, text: `⏳ *[${elapsedSec}с] Идёт обработка...*\n` }
        lastYieldTime = Date.now()
      }
    }

    const result = await pipelinePromise
    if (signal?.aborted) {
      await cleanMoaWorkspaces(cwd)
      return
    }

    if (result?.error) {
      const errText = '\n\n⚠️ **Ошибка Mixture of Agents**: ' + (result.error?.message || String(result.error))
      yield { type: 'text-delta', index: 0, text: errText }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: errText } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }

    const formatted = formatMoAResponse({
      moaResult: result,
      presetName: targetPreset?.name || 'default',
    })

    yield { type: 'text-delta', index: 0, text: '\n---\n\n' + formatted }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: formatted } }
    yield { type: 'usage', usage: { inputTokens: result?.usage?.totalTokens || 100, outputTokens: formatted.length } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } finally {
    if (signal?.aborted) {
      await cleanMoaWorkspaces(cwd)
    }
  }
}

