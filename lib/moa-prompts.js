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

export const ROLE_PERSONA_PROMPTS = {
  minimalist: `### 🎯 Specialized Engineering Persona: THE MINIMALIST (Ponytail)
- Prioritize the standard library and native platform capabilities over third-party dependencies.
- Zero boilerplate, no premature abstractions, interfaces, or unneeded layers.
- Write the shortest, cleanest working solution with maximum readability.`,

  robustness: `### 🎯 Specialized Engineering Persona: ROBUSTNESS & DEFENSIVE DESIGN
- Emphasize paranoid input validation, boundary checking, and comprehensive error handling.
- Anticipate network failures, null/undefined edge cases, malformed data, and race conditions.
- Ensure grace under failure and informative, actionable error reporting.`,

  performance: `### 🎯 Specialized Engineering Persona: HIGH PERFORMANCE & EFFICIENCY
- Prioritize asymptotic time and space complexity, minimal memory allocations, and zero redundant work.
- Optimize hot paths, streaming data processing, and efficient algorithmic structures.
- Document the Big-O complexity and performance characteristics of your solution.`,

  tester: `### 🎯 Specialized Engineering Persona: TESTABILITY & VERIFICATION
- Structure code for maximum testability, modular decoupling, and clear side-effect boundaries.
- Include comprehensive unit/integration test specifications verifying happy paths and edge cases.
- Emphasize deterministic behavior and assertions.`,

  general: '',
}

export const SYNTAX_CORRECTION_DIRECTIVE = `### ⚠️ Syntax Warning & Auto-Fix Directive:
Some candidate proposals have detected syntax flaws (annotated with [⚠️ Syntax Warning]).
CRITICAL JUDGE DIRECTIVE: If a candidate with a syntax flaw presents superior architecture, algorithm, or engineering logic compared to other candidates, DO NOT reject them solely for this syntax flaw!
Instead, you MUST correct the syntax error directly during synthesis/assembly and declare that candidate the winner.`

export const LANGUAGE_MIRRORING_DIRECTIVE = `### 🌐 Language Mirroring Requirement
CRITICAL: You MUST write your entire analysis, reasoning, verdict, explanations and instructions in the EXACT SAME LANGUAGE as the user's prompt (e.g. Russian if the prompt is written in Russian, English if in English). Do NOT switch or translate to English unless explicitly requested by the user.`

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

  if (/^(yes|no|1|2|3|4|ok|sure|是|否|好|да|нет|ок|погнали|давай)\b/i.test(p) && wordCount <= 5) {
    return false
  }

  const hasRecentQuestion = messages.some((m) => {
    const text = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content || '')
    return text.includes('Clarification of Requirements') || text.includes('需求澄清') || text.includes('Уточнение требований') || text.includes('опросник') || text.includes('Option 1') || text.includes('Вариант 1')
  })
  if (hasRecentQuestion) {
    return false
  }

  const creationTriggers = [
    'make', 'build', 'create', 'generate', 'develop', 'design',
    '制作', '创建', '构建', '开发', '设计',
    'сделай', 'создай', 'напиши', 'разработай', 'придумай', 'реализуй',
  ]
  const startsWithCreation = creationTriggers.some((t) => p.toLowerCase().startsWith(t))

  if (startsWithCreation && wordCount <= 18) {
    return true
  }

  const vagueNouns = ['app', 'game', 'tool', 'website', 'dashboard', 'widget', 'service', 'landing', 'calculator', '应用', '游戏', '工具', '网站', '仪表盘', '服务', 'приложение', 'игру', 'сервис', 'сайт', 'лендинг', 'калькулятор', 'виджет', 'дашборд']
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

${LANGUAGE_MIRRORING_DIRECTIVE}

Your task is to synthesize a single, compact, friendly and structured questionnaire (2-4 questions) in the same language as the user's prompt.
Each question must offer 2-3 concrete recommended answer options (e.g.: 1. Format: single-file HTML/JS or React? 2. Style: minimalism, iOS or neubrutalism?).
At the end, add a note that the user can answer briefly (e.g.: "1, 2, dark theme") or trust the defaults.`
}

/**
 * Builds the curator synthesis prompt with component analysis, model recommendation, and optional blind review.
 */
/**
 * Builds the Round 2 Consilium / Peer Critique prompt for candidate models.
 */
export function buildPeerCritiquePrompt(userPrompt, myProposal, otherProposals = [], isBlind = true) {
  const othersText = otherProposals
    .map((p, idx) => {
      const role = p.role_persona || p.slot?.role_persona || p.role || p.slot?.role
      const roleNote = role && role !== 'general' ? ` [Focus: ${role}]` : ''
      const label = isBlind ? `Candidate ${idx + 1}${roleNote}` : `${p.label || `Candidate ${idx + 1}`}${roleNote}`
      let text = p.text || ''
      if (text.length > 3000) {
        text = stripOrSummarizeCode(text)
      }
      return `### ${label} Alternative Proposal:\n${text}`
    })
    .join('\n\n---\n\n')

  return `You are participating in Round 2 (Consilium / Peer Critique & Solution Refinement) of an MoA ensemble.

Original User Request:
${userPrompt}

Your Initial Solution (Round 1):
${myProposal}

Alternative Solutions from Peer Candidates:
${othersText}

Instructions:
1. 🔍 Peer Critique: Briefly evaluate the other candidates' solutions. Point out any hidden bugs, race conditions, antipatterns, or edge-case omissions in their logic.
2. 🛡️ Defend & Refine: Adopt the strongest architectural ideas or optimizations from competitors to enhance your own solution. Fix any oversights in your own code.
3. 🚀 Final Refined Deliverable: Present your complete, production-ready, improved code with full explanations.

${LANGUAGE_MIRRORING_DIRECTIVE}`
}

export function buildCuratorSynthesisPrompt(userPrompt, referenceOutputs = [], judgeCriteria = '', options = {}) {
  const isBlind = Boolean(options.blindEvaluation)

  const joined = referenceOutputs
    .map((r, i) => {
      const fileSummary = (r.files && r.files.length > 0)
        ? ` [Files created: ${r.files.map((f) => f.relativePath).join(', ')}]`
        : ''
      let textContent = r.text
      if (textContent.length > 3000) {
        textContent = stripOrSummarizeCode(textContent)
      }
      const role = r.role_persona || r.slot?.role_persona || r.role || r.slot?.role
      const roleNote = role && role !== 'general' ? ` [Focus: ${role}]` : ''
      const syntaxNote = r.syntaxWarning ? ` [⚠️ Syntax Warning: ${r.syntaxWarning}]` : ''
      const header = isBlind
        ? `Candidate ${i + 1}${roleNote}:${syntaxNote}${fileSummary}`
        : `Candidate ${i + 1} — ${r.label}${roleNote}:${syntaxNote}${fileSummary}`
      return `${header}\n${textContent}`
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

${LANGUAGE_MIRRORING_DIRECTIVE}
${referenceOutputs.some((r) => r.syntaxWarning) ? `
${SYNTAX_CORRECTION_DIRECTIVE}
` : ''}
Instructions:
Your response MUST be structured into three clear parts:

### 1. 🔍 Curator Analysis & Component Breakdown
- For EACH candidate, provide:
  - ⭐ **Strongest aspects** (e.g. robust architecture, superior UI/CSS design, clean data validation).
  - ⚠️ **Defects or Antipatterns** found from the checklist above.
- Highlight which candidate provides the best foundation for each component (e.g. Candidate 1 for core logic, Candidate 2 for visual UI).

### 2. 🧩 Assembly Recipe & Recommended Master Assembler
- Recommend the best single agent model to assemble and finalize the solution:
  RECOMMENDED_ASSEMBLER: <number from 1 to N> ${isBlind ? '' : '(<provider:model>)'}
- State the machine winner index marker for file promotion:
  WINNER_CANDIDATE_INDEX: <number from 1 to N>
- Provide the exact blueprint / instructions for combining the best pieces into a unified deliverable.

### 3. 🚀 Unified Solution & Execution Guide
- Present the final synthesized code or complete instructions combining the best candidate features.
- How to run, verify, and use the deliverable.`
}

/**
 * Builds the judge synthesis prompt for standard or curator mode with optional blind evaluation.
 */
export function buildSynthesisPrompt(userPrompt, referenceOutputs = [], judgeCriteria = '', options = {}) {
  if (options.curatorSynthesis) {
    return buildCuratorSynthesisPrompt(userPrompt, referenceOutputs, judgeCriteria, options)
  }

  const isBlind = Boolean(options.blindEvaluation)

  const joined = referenceOutputs
    .map((r, i) => {
      const fileSummary = (r.files && r.files.length > 0)
        ? ` [Files created: ${r.files.map((f) => f.relativePath).join(', ')}]`
        : ''
      let textContent = r.text
      if (textContent.length > 3000) {
        textContent = stripOrSummarizeCode(textContent)
      }
      const role = r.role_persona || r.slot?.role_persona || r.role || r.slot?.role
      const roleNote = role && role !== 'general' ? ` [Focus: ${role}]` : ''
      const syntaxNote = r.syntaxWarning ? ` [⚠️ Syntax Warning: ${r.syntaxWarning}]` : ''
      const header = isBlind
        ? `Reference ${i + 1}${roleNote}:${syntaxNote}${fileSummary}`
        : `Reference ${i + 1} — ${r.label}${roleNote}:${syntaxNote}${fileSummary}`
      return `${header}\n${textContent}`
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

${LANGUAGE_MIRRORING_DIRECTIVE}
${referenceOutputs.some((r) => r.syntaxWarning) ? `\n${SYNTAX_CORRECTION_DIRECTIVE}\n` : ''}
Instructions:
Your response MUST be structured into three clear parts:

### 1. ⚖️ Judge verdict and comparative analysis
- **Winner**: clearly name the chosen candidate (e.g. "Winner: Candidate 1" or "Reference 1 is chosen").
- Always add the machine winner-selection marker:
  WINNER_CANDIDATE_INDEX: <number from 1 to N>
- **Why this choice**: compare code, architecture, strengths, weaknesses and reliability of all candidates in detail.

### 2. 📁 Project files created
- List the winner files promoted to the project root and their purpose.

### 3. 🚀 How to run and use
- Describe how to open and run the created project.`
}
