import { estimateTokenCost as calculateTokenCost, resolveModelRates, refreshCatalogInBackground, DIRECT_VENDOR_RATES, FALLBACK_RATES } from './pricing.js'
/**
 * Mixture of Agents (MoA) execution engine with Interactive Questioning,
 * Isolated Multi-Candidate File Execution, Native Cost Tracking,
 * Refinement Mode, and Multi-Candidate Scalability.
 */

import {
  extractFileBlocks,
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  cleanMoaWorkspaces,
  collectProjectContext,
  isRefinementTask,
} from './file-workspace.js'

import { recordMoaRun } from './history.js'

export {
  extractFileBlocks,
  writeCandidateWorkspace,
  promoteCandidateWorkspace,
  cleanMoaWorkspaces,
  collectProjectContext,
  isRefinementTask,
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

export const REFINEMENT_SYSTEM_PROMPT = `You are an expert software engineer performing an iterative modification / refinement on an existing project.
You are provided with the current codebase files and the user's delta request.

RULES:
1. Modify the existing files or create new files to fulfill the user's change request.
2. Deliver complete, production-ready updated code for every modified file.
3. Format each updated file in markdown code blocks with explicit file attribute:
   \`\`\`javascript file="src/app.js"
   ...
   \`\`\`
4. Keep the existing architecture, styling conventions and dependencies consistent.`

export const ADVISOR_QUESTION_PROMPT = `You are a senior technical advisor in a Mixture of Agents (MoA) architecture.
The user has provided a prompt that may have multiple design choices, architectural paths, or underspecified requirements.

Review the user prompt and identify 1 to 3 critical, high-impact clarifying questions or architectural options that would define the implementation (e.g. framework/vanilla, features, design style, target environment).
Keep questions very clear, structured, and actionable. Avoid trivial questions. Respond directly in Russian.`

export { resolveModelRates, refreshCatalogInBackground, DIRECT_VENDOR_RATES, FALLBACK_RATES }

export function estimateTokenCost(slot, usage = {}, customPrices = {}) {
  return calculateTokenCost(slot, usage, customPrices)
}

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

export function isBroadPromptRequiringQuestions(userPrompt = '', messages = []) {
  if (!userPrompt || typeof userPrompt !== 'string') return false
  const p = userPrompt.trim()
  const wordCount = p.split(/\s+/).length

  if (/^(да|нет|1|2|3|4|ок|погнали|давай|yes|no)\b/i.test(p) && wordCount <= 5) {
    return false
  }

  const hasRecentQuestion = messages.some((m) => {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')
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
        temperature: options.referenceTemperature ?? 0.6,
        maxTokens: options.maxTokens ?? 4096,
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${Math.round(timeoutMs / 1000)}s waiting for ${label}`)), timeoutMs).unref()
      )

      const res = await Promise.race([callPromise, timeoutPromise])
      const text = (typeof res === 'string' ? res : (res?.content || res?.text || '')).trim()
      const files = extractFileBlocks(text)

      // Estimate tokens & cost
      const rawUsage = res?.usage || {
        inputTokens: Math.round(JSON.stringify(fullMessages).length / 4),
        outputTokens: Math.round(text.length / 4),
      }
      const costInfo = estimateTokenCost(slot, rawUsage, options.prices)

      if (typeof onProgress === 'function') {
        const fileMsg = files.length > 0 ? ` (создано файлов: ${files.length})` : ''
        onProgress(`✅ *Кандидат ${i + 1} (${label}) завершил ответ${fileMsg}.*\n`)
      }

      return {
        index: i + 1,
        label,
        provider: slot.provider,
        model: slot.model,
        text: text || '(empty response)',
        files,
        usage: costInfo,
        costUsd: costInfo.costUsd,
        ok: true,
      }
    } catch (err) {
      console.warn(`[dsh-moa] Reference ${label} failed:`, err)
      if (typeof onProgress === 'function') {
        onProgress(`⚠️ *Кандидат ${i + 1} (${label}) завершился с ошибкой: ${err?.message || String(err)}*\n`)
      }
      return {
        index: i + 1,
        label,
        provider: slot.provider,
        model: slot.model,
        text: `[failed: ${err?.message || String(err)}]`,
        files: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        costUsd: 0,
        ok: false,
      }
    }
  })

  return Promise.all(tasks)
}

/**
 * Runs the full Mixture of Agents pipeline:
 * 1. Checks if questions or refinement needed
 * 2. Parallel candidate proposers write to .moa/candidate-X/
 * 3. Aggregator judges and picks winner (or bypassed in Fast Mode)
 * 4. Promotes winner files, records history and calculates costs
 */
export async function runMoAPipeline({
  userPrompt,
  messages = [],
  preset,
  callLlm,
  cwd,
  onProgress,
  skipQuestions = false,
  prices = {},
}) {
  if (typeof callLlm !== 'function') {
    throw new Error('callLlm function is required for runMoAPipeline')
  }

  const startTime = Date.now()
  const referenceModels = preset?.reference_models || preset?.referenceModels || []
  const aggregator = preset?.aggregator || { provider: 'default', model: 'default' }
  const refTemp = preset?.reference_temperature ?? preset?.referenceTemperature ?? 0.6
  const aggTemp = preset?.aggregator_temperature ?? preset?.aggregatorTemperature ?? 0.4
  const maxTokens = preset?.max_tokens ?? preset?.maxTokens ?? 4096
  const judgeCriteria = preset?.judge_criteria || preset?.judgeCriteria || ''
  const workDir = cwd || process.cwd()

  // Collect project context (#6) and check refinement task (#4)
  const projectCtx = await collectProjectContext(workDir, 16000)
  const isRefinement = isRefinementTask(userPrompt, projectCtx.files)

  // System prompt selection
  let candidateSystemPrompt = REFERENCE_SYSTEM_PROMPT
  if (isRefinement && projectCtx.files.length > 0) {
    const fileList = projectCtx.files.map((f) => `### File: ${f.relativePath}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
    candidateSystemPrompt = `${REFINEMENT_SYSTEM_PROMPT}\n\n## Existing Project Files:\n${fileList}`
    if (typeof onProgress === 'function') {
      onProgress(`🔄 *[Refinement Mode]: Обнаружен существующий проект (${projectCtx.files.length} файлов). Кандидаты вносят точечные изменения...*\n\n`)
    }
  }

  // Phase 1: Check if clarifying questions should be asked
  const needsQuestions = !skipQuestions && !isRefinement && isBroadPromptRequiringQuestions(userPrompt, messages)
  if (needsQuestions) {
    if (typeof onProgress === 'function') {
      onProgress('🔍 *Задача общего характера. Советники формируют ключевые развилки...*\n\n')
    }

    const questionOutputs = await runReferencesParallel(
      referenceModels,
      [...messages, { role: 'user', content: userPrompt }],
      { systemPrompt: ADVISOR_QUESTION_PROMPT, referenceTemperature: 0.5, maxTokens: 1024 },
      callLlm,
      onProgress,
    )

    if (typeof onProgress === 'function') {
      onProgress(`\n⚖️ *Судья (${slotLabel(aggregator)}) синтезирует единый опросник для вас...*\n\n`)
    }

    const qSynthPrompt = buildQuestionSynthesisPrompt(userPrompt, questionOutputs)
    let questionsText = ''
    try {
      const qPromise = callLlm({
        provider: aggregator.provider,
        model: aggregator.model,
        messages: [{ role: 'user', content: qSynthPrompt }],
        temperature: 0.3,
        maxTokens: 1500,
      })
      const qTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for judge questions synthesis')), 60000).unref()
      )
      const res = await Promise.race([qPromise, qTimeout])
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

  // FAST MODE: single candidate model bypasses aggregator (#14)
  const isFastMode = referenceModels.length === 1

  // Phase 2: Parallel execution & file generation
  if (typeof onProgress === 'function') {
    const modeLabel = isFastMode ? '⚡ Fast Mode' : `советниками (${referenceModels.length})`
    onProgress(`🚀 *Запускаю реализацию ${modeLabel}...*\n\n`)
  }

  const referenceOutputs = await runReferencesParallel(
    referenceModels,
    [...messages, { role: 'user', content: userPrompt }],
    { systemPrompt: candidateSystemPrompt, referenceTemperature: refTemp, maxTokens },
    callLlm,
    onProgress,
  )

  // Write files for each candidate into .moa/candidate-X/
  for (let i = 0; i < referenceOutputs.length; i++) {
    const ref = referenceOutputs[i]
    if (ref.ok && ref.files && ref.files.length > 0) {
      try {
        await writeCandidateWorkspace(workDir, i + 1, ref.files)
        if (typeof onProgress === 'function') {
          onProgress(`📁 *Кандидат ${i + 1} (${ref.label}) сохранил ${ref.files.length} файл(а) в .moa/candidate-${i + 1}/*\n`)
        }
      } catch (writeErr) {
        console.warn(`[dsh-moa] Failed to write candidate ${i + 1} workspace:`, writeErr)
      }
    }
  }

  let synthesizedText = ''
  let winningIndex = 1
  let aggUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
  const aggLabel = slotLabel(aggregator)

  if (isFastMode) {
    // Fast mode: promote candidate 1 directly without judge
    synthesizedText = referenceOutputs[0]?.text || '(empty fast response)'
    winningIndex = 1
  } else {
    // Phase 3: Aggregator evaluation
    if (typeof onProgress === 'function') {
      onProgress(`\n⚖️ *Все кандидаты завершили генерацию. Судья (${aggLabel}) оценивает код и файлы...*\n\n`)
    }

    const synthPrompt = buildSynthesisPrompt(userPrompt, referenceOutputs, judgeCriteria)

    try {
      const aggPromise = callLlm({
        provider: aggregator.provider,
        model: aggregator.model,
        messages: [{ role: 'user', content: synthPrompt }],
        temperature: aggTemp,
        maxTokens,
      })
      const aggTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after 90s waiting for aggregator ${aggLabel}`)), 90000).unref()
      )
      const res = await Promise.race([aggPromise, aggTimeout])
      synthesizedText = (typeof res === 'string' ? res : (res?.content || res?.text || '')).trim()

      const rawAggUsage = res?.usage || {
        inputTokens: Math.round(synthPrompt.length / 4),
        outputTokens: Math.round(synthesizedText.length / 4),
      }
      aggUsage = estimateTokenCost(aggregator, rawAggUsage, prices)
    } catch (err) {
      synthesizedText = `[Aggregator error: ${err?.message || String(err)}]\n\nFallback candidate outputs:\n\n` +
        referenceOutputs.map((r, i) => `### ${r.label}\n${r.text}`).join('\n\n')
    }

    winningIndex = parseWinnerIndex(synthesizedText, 1)
  }

  // Phase 4: Promote winner files and cleanup
  let promotedFiles = []
  try {
    promotedFiles = await promoteCandidateWorkspace(workDir, winningIndex)
    if (typeof onProgress === 'function' && promotedFiles.length > 0) {
      onProgress(`\n✅ *Файлы победителя (Кандидат ${winningIndex}) перенесены в проект: ${promotedFiles.join(', ')}*\n\n`)
    }
  } catch (promoteErr) {
    console.warn('[dsh-moa] Error promoting candidate files:', promoteErr)
  }

  // Phase 5: Live Canvas preview auto-registration
  let liveCanvas = null
  if (promotedFiles && promotedFiles.length > 0) {
    const previewCandidate = promotedFiles.find(f => /\.(html|htm|jsx|tsx|vue|svelte)$/i.test(f)) || promotedFiles[0]
    if (previewCandidate) {
      try {
        const port = process.env.PORT || 3080
        const lcRes = await fetch(`http://127.0.0.1:${port}/dsh-live-canvas/api/open-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: previewCandidate }),
          signal: AbortSignal.timeout(500),
        })
        if (lcRes.ok) {
          const lcData = await lcRes.json()
          if (lcData?.canvasId) {
            liveCanvas = {
              canvasId: lcData.canvasId,
              title: lcData.title || previewCandidate,
              filePath: previewCandidate,
              previewUrl: lcData.previewUrl || `/dsh-live-canvas/sandbox/${lcData.canvasId}`
            }
            if (typeof onProgress === 'function') {
              onProgress(`\n🎨 *[Live Canvas]: Файл ${previewCandidate} открыт для предпросмотра!*\n\n`)
            }
          }
        }
      } catch (err) {
        // live-canvas plugin might not be installed or reachable, non-fatal
      }
    }
  }

  // Calculate totals
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

    const startTime = Date.now()
    let lastYieldTime = Date.now()

    // Yield progressive updates while pipeline runs
    while (true) {
      if (signal?.aborted) return

      let emittedAny = false
      while (progressChunks.length > 0) {
        const chunk = progressChunks.shift()
        yield { type: 'text-delta', index: 0, text: chunk }
        emittedAny = true
        lastYieldTime = Date.now()
      }

      const done = await Promise.race([
        pipelinePromise.then(() => true),
        new Promise((r) => { const t = setTimeout(() => r(false), 500); t.unref?.(); }),
      ])
      if (done) break

      const elapsedSec = Math.floor((Date.now() - startTime) / 1000)
      // If 3 seconds passed without any progress message, send a live tick
      if (!emittedAny && Date.now() - lastYieldTime >= 3000) {
        yield { type: 'text-delta', index: 0, text: `⏳ *[${elapsedSec}с] Идёт обработка...*\n` }
        lastYieldTime = Date.now()
      }
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
    yield { type: 'usage', usage: { inputTokens: moaResult?.usage?.totalTokens || 100, outputTokens: formatted.length } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } catch (err) {
    if (signal?.aborted) return
    const errText = '\n\n⚠️ **Ошибка Mixture of Agents**: ' + (err?.message || String(err))
    yield { type: 'text-delta', index: 0, text: errText }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: errText } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
