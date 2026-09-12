/**
 * DeepSeek Harness Mixture of Agents (MoA) — Runner Engine
 *
 * Implements the full ensemble pipeline:
 * - Parallel fan-out to reference models with transient retry & quorum straggler mitigation
 * - Prompt caching aligned message structures
 * - Curator synthesis & antipatterns evaluation
 * - Aggregator fallback chain for resilience
 * - Live token streaming for aggregator
 * - File promotion & Live Canvas sandbox preview
 */

import path from 'node:path'
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

export const ANTIPATTERNS_RUBRIC = `### 🚫 Strict Antipatterns Evaluation Checklist
Penalize and strictly downgrade candidates exhibiting any of the following flaws:
1. 🚫 Lazy Code & Placeholders:
   - Phrases like "// ... rest of code unchanged", "/* TODO: implement */", incomplete functions or stubs returning null/mock without notice.
2. 🚫 Blind Mocking:
   - Hardcoded dummy arrays instead of real dynamic logic, user input handling, or real API integration.
3. 🚫 Silent Failures & Missing Error Handling:
   - Missing try/catch around async calls, fetch, JSON.parse; lack of user-facing fallback or retry states.
4. 🚫 AI Slop UI & Poor Ergonomics:
   - Generic purple/cyan gradients on pure black backgrounds, blurry drop-shadows without borders, lack of typographic hierarchy, low contrast (e.g. light gray text on white).
5. 🚫 Missing UI States:
   - Lack of loading state (spinner/skeleton), error display with retry action, or empty state when no data exists.
6. 🚫 Broken Layout & Mobile Incompatibility:
   - Fixed pixel widths (e.g. width: 800px) overflowing small viewports; unscrollable modal dialogs.
7. 🚫 Monolithic God Objects & Overengineering:
   - Dumping 1000+ lines into a single unmaintainable file, or building 10+ abstraction layers for a 2-function task.
8. 🚫 Context Amnesia & Regressions:
   - Dropping or breaking previously functioning project features while adding new code.`

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
    .map((r, i) => `Advisor ${i + 1} (${r.label}):\n${r.text}`)
    .join('\n\n')

  return `You are the lead architect and judge in a Mixture of Agents (MoA) ensemble.
The user gave the task:
"${userPrompt}"

The advisors proposed the following decision points and clarifications:
${joined}

Your task is to synthesize a single, compact, friendly and structured questionnaire (2-4 questions) in the same language as the user's prompt.
Each question must offer 2-3 concrete recommended answer options (e.g.: 1. Format: single-file HTML/JS or React? 2. Style: minimalism, iOS or neubrutalism?).
At the end, add a note that the user can answer briefly (e.g.: "1, 2, dark theme") or trust the defaults.`
}

export function buildCuratorSynthesisPrompt(userPrompt, referenceOutputs = [], judgeCriteria = '') {
  const joined = referenceOutputs
    .map((r, i) => {
      const fileSummary = (r.files && r.files.length > 0)
        ? ` [Files created: ${r.files.map((f) => f.relativePath).join(', ')}]`
        : ''
      let textContent = r.text
      if (referenceOutputs.length >= 3 && textContent.length > 3000) {
        textContent = stripOrSummarizeCode(textContent)
      }
      return `Candidate ${i + 1} — ${r.label}:${fileSummary}\n${textContent}`
    })
    .join('\n\n')

  const criteriaBlock = judgeCriteria && judgeCriteria.trim()
    ? `\n### 🎯 Additional evaluation criteria:\n${judgeCriteria.trim()}\n`
    : ''

  return `You are the expert Lead Technical Curator and Solution Architect in a Mixture of Agents (MoA) ensemble.
Your mission is not merely to select one candidate, but to synthesize the optimal solution by extracting the finest components from each candidate's response, identifying potential flaws using the strict antipatterns rubric, and selecting/advising which single agent model is best suited to assemble the final unified deliverable.

User Request:
${userPrompt}
${criteriaBlock}
Candidate proposals:
${joined}

${ANTIPATTERNS_RUBRIC}

Instructions:
Your response MUST be structured into three clear parts (respond in the same language as the user's prompt, e.g. Russian):

### 1. 🔍 Curator Analysis & Component Breakdown
- For EACH candidate, provide:
  - ⭐ **Strongest aspects** (e.g. robust architecture, superior UI/CSS design, clean data validation).
  - ⚠️ **Defects or Antipatterns** found from the checklist above.
- Highlight which candidate provides the best foundation for each component (e.g. Candidate 1 for core logic, Candidate 2 for visual UI).

### 2. 🧩 Assembly Recipe & Recommended Master Assembler
- Recommend the best single agent model to assemble and finalize the solution:
  RECOMMENDED_ASSEMBLER: <number from 1 to N> (<provider:model>)
- State the machine winner index marker for file promotion:
  WINNER_CANDIDATE_INDEX: <number from 1 to N>
- Provide the exact blueprint / instructions for combining the best pieces into a unified deliverable.

### 3. 🚀 Unified Solution & Execution Guide
- Present the final synthesized code or complete instructions combining the best candidate features.
- How to run, verify, and use the deliverable.`
}

export function buildSynthesisPrompt(userPrompt, referenceOutputs = [], judgeCriteria = '', options = {}) {
  if (options.curatorSynthesis) {
    return buildCuratorSynthesisPrompt(userPrompt, referenceOutputs, judgeCriteria)
  }

  const joined = referenceOutputs
    .map((r, i) => {
      const fileSummary = (r.files && r.files.length > 0)
        ? ` [Files created: ${r.files.map((f) => f.relativePath).join(', ')}]`
        : ''
      let textContent = r.text
      if (referenceOutputs.length >= 3 && textContent.length > 3000) {
        textContent = stripOrSummarizeCode(textContent)
      }
      return `Reference ${i + 1} — ${r.label}:${fileSummary}\n${textContent}`
    })
    .join('\n\n')

  const criteriaBlock = judgeCriteria && judgeCriteria.trim()
    ? `\n### 🎯 Additional evaluation criteria from the user:\n${judgeCriteria.trim()}\n`
    : ''

  return `You are the expert aggregator/judge in a Mixture of Agents (MoA) process. You evaluate solutions from multiple candidate models, judge which one is best (or how to combine their best parts), and deliver the final authoritative verdict and solution.

Original user prompt:
${userPrompt}
${criteriaBlock}
Reference responses from candidate models:
${joined}

${ANTIPATTERNS_RUBRIC}

Instructions:
Your response MUST be structured into three clear parts (respond in the same language as the user's prompt, e.g. Russian):

### 1. ⚖️ Judge verdict and comparative analysis
- **Winner**: clearly name the model and candidate number (e.g. "Winner: Candidate 1 (opencode-go:deepseek-v4-flash)" or "Reference 1 (label) is chosen").
- Always add the machine winner-selection marker:
  WINNER_CANDIDATE_INDEX: <number from 1 to N>
- **Why this choice**: compare code, architecture, strengths, weaknesses and reliability of all candidates in detail.

### 2. 📁 Project files created
- List the winner files promoted to the project root and their purpose.

### 3. 🚀 How to run and use
- Describe how to open and run the created project.`
}

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
 * Invokes LLM call with transient retry for recoverable network/rate-limit errors.
 */
export async function callWithTransientRetry(callLlmFn, callArgs, maxRetries = 0, retryDelayMs = 1200) {
  let attempt = 0
  while (true) {
    try {
      return await callLlmFn(callArgs)
    } catch (err) {
      attempt++
      const msg = err?.message || String(err)
      const isTransient = /429|rate limit|502|503|504|econnreset|etimedout|socket hang up/i.test(msg)
      if (attempt <= maxRetries && isTransient) {
        await new Promise((r) => setTimeout(r, retryDelayMs))
        continue
      }
      throw err
    }
  }
}

/**
 * Dispatches queries to all reference models in parallel with transient retry and quorum straggler mitigation.
 */
export async function runReferencesParallel(references, messages, options = {}, callLlm, onProgress) {
  if (!Array.isArray(references) || references.length === 0) {
    return []
  }

  const advisoryMessages = cleanAdvisoryMessages(messages)
  const systemPrompt = options.systemPrompt || REFERENCE_SYSTEM_PROMPT
  // Deterministic prefix for optimal prompt caching hit rate (#2.3)
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...advisoryMessages]
  const timeoutMs = options.timeoutMs ?? 75000
  const maxRetries = options.maxRetries ?? 0
  const quorumEnabled = Boolean(options.quorumEnabled)
  const gracePeriodMs = (options.gracePeriodSec ?? 10) * 1000

  const total = references.length
  let finishedCount = 0
  const results = new Array(total)
  const abortControllers = references.map(() => new AbortController())

  let onTaskFinished = null
  const notifyFinished = () => {
    if (typeof onTaskFinished === 'function') onTaskFinished()
  }

  if (typeof onProgress === 'function') {
    onProgress(`⚡ *Launching ${total} candidate models in parallel...*\n`)
  }

  references.forEach((slot, i) => {
    const label = slotLabel(slot)

    const runOne = async () => {
      try {
        const callPromise = callWithTransientRetry(
          callLlm,
          {
            provider: slot.provider,
            model: slot.model,
            messages: fullMessages,
            temperature: options.temperature ?? 0.6,
            maxTokens: options.maxTokens ?? 4096,
            signal: abortControllers[i].signal,
          },
          maxRetries
        )

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
        const costInfo = estimateTokenCost(slot, fallbackUsage, options.prices)

        finishedCount++
        if (typeof onProgress === 'function') {
          const costStr = costInfo.costUsd > 0 ? ` (~\${costInfo.costUsd.toFixed(4)})` : ''
          onProgress(`✅ *Candidate ${i + 1}/${total} (${label}) finished${costStr}*\n`)
        }

        results[i] = {
          index: i + 1,
          slot,
          label,
          text,
          usage: costInfo,
          costUsd: costInfo.costUsd,
          ok: true,
        }
      } catch (err) {
        finishedCount++
        const errMsg = err?.message || String(err)
        console.warn(`[dsh-moa] Reference ${label} failed:`, errMsg)
        if (typeof onProgress === 'function') {
          onProgress(`⚠️ *Candidate ${i + 1}/${total} (${label}) error: ${errMsg}*\n`)
        }
        results[i] = {
          index: i + 1,
          slot,
          label,
          text: `[Model ${label} error: ${errMsg}]`,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
          costUsd: 0,
          ok: false,
          error: errMsg,
        }
      } finally {
        notifyFinished()
      }
    }

    runOne()
  })

  // Quorum straggler mitigation: exit as soon as grace period expires
  if (quorumEnabled && total >= 3) {
    const quorumTarget = Math.max(2, Math.min(total - 1, Math.ceil(total * 0.6)))
    let graceTimer = null
    let quorumTriggered = false

    await new Promise((resolve) => {
      const checkQuorum = () => {
        if (finishedCount >= total) {
          if (graceTimer) clearTimeout(graceTimer)
          return resolve()
        }
        if (finishedCount >= quorumTarget && !quorumTriggered) {
          quorumTriggered = true
          if (typeof onProgress === 'function') {
            onProgress(`⏳ *Quorum reached (${finishedCount}/${total}). Grace period ${gracePeriodMs / 1000}s for remaining models...*\n`)
          }
          graceTimer = setTimeout(() => {
            if (typeof onProgress === 'function' && finishedCount < total) {
              onProgress(`⏩ *Grace period expired. Proceeding with ${finishedCount}/${total} ready candidates.*\n`)
            }
            for (let k = 0; k < total; k++) {
              if (!results[k]) {
                try { abortControllers[k].abort(new Error('Quorum grace period timed out')) } catch {}
              }
            }
            resolve()
          }, gracePeriodMs)
          // active timer keeps event loop alive
        }
      }

      onTaskFinished = checkQuorum
      checkQuorum()
    })

    for (let i = 0; i < total; i++) {
      if (!results[i]) {
        const slot = references[i]
        const label = slotLabel(slot)
        results[i] = {
          index: i + 1,
          slot,
          label,
          text: `[Model ${label} timed out (quorum grace period exceeded)]`,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
          costUsd: 0,
          ok: false,
          error: 'Quorum grace period timed out',
        }
      }
    }
    return results
  }

  // Standard mode: wait for all tasks to complete
  await new Promise((resolve) => {
    const checkAll = () => {
      if (finishedCount >= total) resolve()
    }
    onTaskFinished = checkAll
    checkAll()
  })

  return results
}

function candidatesForHistory(referenceOutputs) {
  return (referenceOutputs || []).map((r) => ({
    provider: r.slot?.provider || '',
    model: r.slot?.model || '',
    files: (r.files || []).map((f) => f.relativePath),
    usage: r.usage || { inputTokens: 0, outputTokens: 0 },
    costUsd: r.costUsd || 0,
  }))
}

async function createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs) {
  if (!liveCanvas || typeof liveCanvas.createPreviewFromContent !== 'function') return null
  const htmlRel = (promotedFiles || []).find((f) => f.endsWith('.html') || f.endsWith('.htm'))
  if (!htmlRel) return null
  let content = null
  for (const r of referenceOutputs || []) {
    const block = (r?.files || []).find((f) => f.relativePath === htmlRel)
    if (block?.content) {
      content = block.content
      break
    }
  }
  if (!content) return null
  try {
    return await liveCanvas.createPreviewFromContent({ content, title: htmlRel, filePath: path.join(cwd, htmlRel) })
  } catch {
    return null
  }
}

/**
 * Main MoA pipeline runner with Curator Synthesis, Fallback Chains, and Live Token Streaming.
 */
export async function runMoAPipeline({
  userPrompt,
  messages = [],
  preset,
  callLlm,
  cwd = process.cwd(),
  onProgress,
  onStreamDelta,
  prices = {},
  historyFilePath,
  liveCanvas = null,
}) {
  const startTime = Date.now()
  const referenceModels = preset?.reference_models || [
    { provider: 'opencode-go', model: 'deepseek-v4-flash' },
    { provider: 'grok', model: 'grok-build-0.1' },
  ]
  const primaryJudge = preset?.aggregator || { provider: 'codex', model: 'gpt-5.6-sol' }
  const fallbackJudges = Array.isArray(preset?.aggregator_fallbacks) ? preset.aggregator_fallbacks : []
  const judgesChain = [primaryJudge, ...fallbackJudges]

  const refTemp = preset?.reference_temperature ?? 0.6
  const aggTemp = preset?.aggregator_temperature ?? 0.4
  const maxTokens = preset?.max_tokens ?? 4096
  const judgeCriteria = preset?.judge_criteria ?? ''
  const isFastMode = referenceModels.length === 1
  const isCuratorSynthesis = Boolean(preset?.curator_synthesis)
  const isStreamAggregator = preset?.stream_aggregator !== false
  const isQuorumEnabled = Boolean(preset?.quorum_enabled)
  const gracePeriodSec = preset?.grace_period_sec ?? 10
  const candidateRetries = preset?.retry_count ?? 1

  // 1. Collect current project workspace context
  if (typeof onProgress === 'function') {
    onProgress('🔍 *Scanning project context...*\n')
  }
  const projectContext = await collectProjectContext(cwd)
  const isRefinement = isRefinementTask(userPrompt, projectContext.files)

  // 2. Check if broad prompt requires user questionnaire
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
    promptForCandidates += "\n(Note: the task is broad. Propose the key architectural and functional decision points to clarify the user's requirements.)"
  }

  const enrichedMessages = [...messages, { role: 'user', content: promptForCandidates }]

  // 4. Parallel fan-out to candidate models with quorum & transient retry
  const referenceOutputs = await runReferencesParallel(
    referenceModels,
    enrichedMessages,
    {
      systemPrompt: candidateSystemPrompt,
      temperature: refTemp,
      maxTokens,
      prices,
      quorumEnabled: isQuorumEnabled,
      gracePeriodSec,
      maxRetries: candidateRetries,
    },
    callLlm,
    onProgress
  )

  // Fail fast if all candidates failed
  const successfulRefs = referenceOutputs.filter((r) => r.ok)
  if (successfulRefs.length === 0) {
    const reasons = referenceOutputs.map((r) => `${r.label}: ${r.error || 'unknown error'}`).join('; ')
    return {
      kind: 'failure',
      content: `⚠️ All advisor models (${referenceOutputs.length}) failed: ${reasons}`,
      aggregator: slotLabel(primaryJudge),
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

  // 5. Extract file blocks & write candidate workspaces
  for (let i = 0; i < referenceOutputs.length; i++) {
    const ref = referenceOutputs[i]
    if (!ref.ok) continue
    const files = extractFileBlocks(ref.text)
    ref.files = files
    if (files.length > 0) {
      await writeCandidateWorkspace(cwd, i + 1, files)
    }
  }

  // 6. Questionnaire synthesis branch
  if (needsQuestions) {
    if (typeof onProgress === 'function') {
      onProgress('📋 *Judge synthesizes the clarification questionnaire...*\n')
    }
    const questionPrompt = buildQuestionSynthesisPrompt(userPrompt, referenceOutputs)
    let questionsContent = ''
    let qUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
    try {
      const qRes = await callWithTransientRetry(callLlm, {
        provider: primaryJudge.provider,
        model: primaryJudge.model,
        messages: [{ role: 'user', content: questionPrompt }],
        temperature: 0.3,
        maxTokens: 2048,
      }, 1)
      questionsContent = typeof qRes === 'string' ? qRes : (qRes?.content || qRes?.text || '')
      const qFallback = (typeof qRes === 'object' && qRes?.usage) ? qRes.usage : {
        inputTokens: Math.max(1, Math.round(questionPrompt.length / 4)),
        outputTokens: Math.max(1, Math.round(questionsContent.length / 4)),
      }
      qUsage = estimateTokenCost(primaryJudge, qFallback, prices)
    } catch {
      questionsContent = '### Project requirements clarification\nPlease specify the implementation details and the desired stack.'
    }

    await cleanMoaWorkspaces(cwd)

    const qTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0) + qUsage.totalTokens
    const qCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + qUsage.costUsd).toFixed(5))

    try {
      recordMoaRun({
        prompt: userPrompt,
        preset: preset?.name || 'default',
        isRefinement,
        candidates: candidatesForHistory(referenceOutputs),
        aggregator: null,
        winnerIndex: -1,
        winnerModel: '',
        promotedFiles: [],
        totalTokens: qTokens,
        totalCostUsd: qCostUsd,
        durationMs: Date.now() - startTime,
      }, historyFilePath)
    } catch (histErr) {
      console.warn('[dsh-moa] Failed to record questionnaire run in history:', histErr)
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
    const livePreview = await createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs)

    try {
      recordMoaRun({
        prompt: userPrompt,
        preset: preset?.name || 'default',
        isRefinement,
        isFastMode: true,
        candidates: candidatesForHistory(referenceOutputs),
        aggregator: null,
        winnerIndex: 1,
        winnerModel: single.label,
        promotedFiles,
        totalTokens,
        totalCostUsd,
        durationMs,
      }, historyFilePath)
    } catch (histErr) {
      console.warn('[dsh-moa] Failed to record fast-mode run in history:', histErr)
    }

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
      ...(livePreview ? { liveCanvas: livePreview } : {}),
      usage: {
        totalTokens,
        totalCostUsd,
        candidates: [{ label: single.label, usage: single.usage, costUsd: single.costUsd }],
        aggregator: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      },
      durationMs,
    }
  }

  // 8. Aggregator / Judge synthesis with fallback chain (#3.3) & streaming (#2.1)
  const synthesisPrompt = buildSynthesisPrompt(
    userPrompt,
    referenceOutputs,
    judgeCriteria,
    { curatorSynthesis: isCuratorSynthesis }
  )

  let synthesizedText = ''
  let aggUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
  let chosenJudge = primaryJudge
  let judgeSuccess = false
  let lastJudgeError = null

  for (let jIdx = 0; jIdx < judgesChain.length; jIdx++) {
    const currentJudge = judgesChain[jIdx]
    const currentLabel = slotLabel(currentJudge)

    if (typeof onProgress === 'function') {
      const judgeTitle = isCuratorSynthesis ? 'Lead Curator' : 'Judge'
      const fallbackBadge = jIdx > 0 ? ` (Fallback #${jIdx})` : ''
      onProgress(`⚖️ *${judgeTitle} (${currentLabel})${fallbackBadge} evaluates candidates and synthesizes the solution...*\n`)
    }

    try {
      const aggRes = await callWithTransientRetry(callLlm, {
        provider: currentJudge.provider,
        model: currentJudge.model,
        messages: [{ role: 'user', content: synthesisPrompt }],
        temperature: aggTemp,
        maxTokens,
        onStreamDelta: (delta) => {
          if (isStreamAggregator && typeof onStreamDelta === 'function') {
            onStreamDelta(delta)
          }
        },
      }, 0)

      synthesizedText = typeof aggRes === 'string' ? aggRes : (aggRes?.content || aggRes?.text || '')
      const aggFallbackUsage = (typeof aggRes === 'object' && aggRes?.usage) ? aggRes.usage : {
        inputTokens: Math.max(1, Math.round(synthesisPrompt.length / 4)),
        outputTokens: Math.max(1, Math.round(synthesizedText.length / 4)),
      }
      aggUsage = estimateTokenCost(currentJudge, aggFallbackUsage, prices)
      chosenJudge = currentJudge
      judgeSuccess = true
      break
    } catch (err) {
      lastJudgeError = err
      console.warn(`[dsh-moa] Judge ${currentLabel} failed:`, err)
      if (typeof onProgress === 'function') {
        const nextJudge = judgesChain[jIdx + 1]
        const nextHint = nextJudge ? ` Trying fallback ${slotLabel(nextJudge)}...` : ''
        onProgress(`⚠️ *Judge ${currentLabel} failed: ${err?.message || err}.${nextHint}*\n`)
      }
    }
  }

  if (!judgeSuccess) {
    const firstErr = lastJudgeError ? (lastJudgeError.message || String(lastJudgeError)) : 'unknown error'
    synthesizedText = `⚠️ *[Aggregator error: ${firstErr}. Fallback candidate outputs:]*\n\n` +
      successfulRefs.map((r, i) => `### Candidate ${i + 1} (${r.label})\n${r.text}`).join('\n\n')
  }

  // 9. Evaluate winner & promote files
  const winningIndex = parseWinnerIndex(synthesizedText, 1, referenceOutputs.length)
  const recommendedAssembler = isCuratorSynthesis
    ? parseRecommendedAssembler(synthesizedText, winningIndex, referenceOutputs.length)
    : null

  // Check if aggregator synthesized unified file blocks directly
  const synthesizedFiles = extractFileBlocks(synthesizedText)
  let promotedFiles = []

  if (synthesizedFiles.length > 0) {
    await writeCandidateWorkspace(cwd, 'curator-synthesis', synthesizedFiles)
    promotedFiles = await promoteCandidateWorkspace(cwd, 'curator-synthesis')
  } else if (referenceOutputs[winningIndex - 1]?.files?.length > 0) {
    promotedFiles = await promoteCandidateWorkspace(cwd, winningIndex)
  } else if (successfulRefs[0]?.files?.length > 0) {
    const fallbackIdx = successfulRefs[0].index
    promotedFiles = await promoteCandidateWorkspace(cwd, fallbackIdx)
  } else {
    await cleanMoaWorkspaces(cwd)
  }

  const livePreview = await createPromotedPreview(liveCanvas, cwd, promotedFiles, referenceOutputs)

  const totalTokens = referenceOutputs.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0) + aggUsage.totalTokens
  const totalCostUsd = Number((referenceOutputs.reduce((acc, r) => acc + (r.costUsd || 0), 0) + aggUsage.costUsd).toFixed(5))
  const durationMs = Date.now() - startTime

  const winningRef = referenceOutputs[winningIndex - 1]
  const winnerModel = winningRef?.label || slotLabel(referenceModels[0])
  const finalAggLabel = slotLabel(chosenJudge)

  // Record run to history
  try {
    recordMoaRun({
      prompt: userPrompt,
      preset: preset?.name || 'default',
      isRefinement,
      candidates: candidatesForHistory(referenceOutputs),
      aggregator: { provider: chosenJudge.provider, model: chosenJudge.model, usage: aggUsage, costUsd: aggUsage.costUsd },
      winnerIndex: winningIndex,
      winnerModel,
      promotedFiles,
      totalTokens,
      totalCostUsd,
      durationMs,
    }, historyFilePath)
  } catch (histErr) {
    console.warn('[dsh-moa] Failed to record run in history:', histErr)
  }

  return {
    kind: 'synthesis',
    content: synthesizedText,
    aggregator: isFastMode ? 'Fast Mode (Direct)' : finalAggLabel,
    references: referenceOutputs,
    presetName: preset?.name || 'default',
    isRefinement,
    isFastMode,
    isCuratorSynthesis,
    recommendedAssembler,
    winningIndex,
    winnerModel,
    promotedFiles,
    ...(livePreview ? { liveCanvas: livePreview } : {}),
    usage: {
      totalTokens,
      totalCostUsd,
      candidates: referenceOutputs.map((r) => ({ label: r.label, usage: r.usage, costUsd: r.costUsd })),
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
    const label = fileHint ? `file \`${fileHint}\`` : (lang ? `code \`${lang}\`` : 'code')
    return `\n> 📄 *[${label} - ${lines.length} lines saved to disk]*\n`
  })
}

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

  return parts.join('\n')
}

export async function* streamMoATurn({ targetPreset, userPrompt, messages, callLlm, cwd, prices, historyFilePath, liveCanvas }, options = {}) {
  const signal = options?.signal
  if (signal?.aborted) return

  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'text-delta', index: 0, text: '🧠 *Mixture of Agents started...*\n\n' }

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
    onStreamDelta: (delta) => {
      pushUpdate(delta)
    },
    prices,
    historyFilePath,
    liveCanvas,
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
        yield { type: 'text-delta', index: 0, text: `⏳ *[${elapsedSec}s] Still processing...*\n` }
        lastYieldTime = Date.now()
      }
    }

    const result = await pipelinePromise
    if (signal?.aborted) {
      await cleanMoaWorkspaces(cwd)
      return
    }

    if (result?.error) {
      const errText = '\n\n⚠️ **Mixture of Agents error**: ' + (result.error?.message || String(result.error))
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
    yield {
      type: 'usage',
      usage: {
        inputTokens: result?.usage?.totalTokens || 0,
        outputTokens: Math.round((formatted.length || 0) / 4),
      },
    }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } finally {
    if (signal?.aborted) {
      await cleanMoaWorkspaces(cwd)
    }
  }
}

