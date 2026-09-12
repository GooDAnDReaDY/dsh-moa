// lib/moa-prompts.js
// Prompts, evaluation rubrics, and message sanitizer for @goodandready/dsh-moa.

import { stripOrSummarizeCode } from './moa-parser.js'

export const SYSTEM_ROLE_PROPOSER = `You are a specialized expert developer agent participating as an independent advisor in a Mixture of Agents (MoA) ensemble.
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

/**
 * Formats a provider + model slot into a readable string key.
 */
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

/**
 * Detects whether the user's prompt is a short/vague creative task requiring clarification.
 */
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

/**
 * Builds the questionnaire prompt for broad/unclear tasks.
 */
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

/**
 * Builds the curator synthesis prompt with component analysis and model recommendation.
 */
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

/**
 * Builds the judge synthesis prompt for standard or curator mode.
 */
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
