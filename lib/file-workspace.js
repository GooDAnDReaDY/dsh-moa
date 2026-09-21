import { bestEffort } from './best-effort.js'
import vm from 'node:vm'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Validates that an untrusted relative path is safe and does not traverse upwards.
 */
export function isSafeRelativePath(relPath) {
  if (!relPath || typeof relPath !== 'string') return false
  const trimmed = relPath.trim()
  if (!trimmed || path.isAbsolute(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\')) return false
  const normalized = path.normalize(trimmed)
  return Boolean(normalized && !normalized.startsWith('..') && !path.isAbsolute(normalized))
}

/**
 * Asserts that a resolved path is strictly contained within baseDir.
 */
export function assertPathContained(baseDir, subPath) {
  const resolvedBase = path.resolve(baseDir)
  const resolvedTarget = path.resolve(resolvedBase, subPath)
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Path traversal violation: "${subPath}" escapes base directory "${baseDir}"`)
  }
  return resolvedTarget
}

/**
 * Parses markdown code blocks that specify file paths.
 */
export function extractFileBlocks(text) {
  if (!text || typeof text !== 'string') return []

  const files = []
  const seenPaths = new Set()

  const addFile = (rawPath, fileContent) => {
    if (rawPath && isSafeRelativePath(rawPath) && !seenPaths.has(rawPath)) {
      seenPaths.add(rawPath)
      files.push({ relativePath: rawPath, content: fileContent.trimEnd() + '\n' })
    }
  }

  // Pattern 1: fenced blocks with file="..." or path="..." in info string
  const fenceRegex = /```[\w-]*\s+(?:file|path|filepath)=["']?([^\s"'\n\r]+)["']?[\r\n]+([\s\S]*?)```/gi
  let match
  while ((match = fenceRegex.exec(text)) !== null) addFile(match[1].trim(), match[2])

  // Pattern 2: comment header: // File: path/to/file.ext or <!-- File: ... -->
  const commentRegex = /(?:\/\/|#|<!--)\s*(?:File|Path):\s*([^\s\n\r>]+)(?:\s*-->)?[\r\n]+```[\w-]*[\r\n]+([\s\S]*?)```/gi
  while ((match = commentRegex.exec(text)) !== null) addFile(match[1].trim(), match[2])

  // Pattern 3: markdown header: ### File: path/to/file.ext
  const headerRegex = /#{1,4}\s+(?:File|Path):\s*([^\s\n\r]+)[\r\n]+```[\w-]*[\r\n]+([\s\S]*?)```/gi
  while ((match = headerRegex.exec(text)) !== null) addFile(match[1].trim(), match[2])

  // Pattern 4: first line inside code block: // File: path/to/file.ext
  const inlineRegex = /```[\w-]*[\r\n]+(?:\/\/|#|<!--)\s*(?:File|Path):\s*([^\s\n\r>]+)(?:\s*-->)?[\r\n]+([\s\S]*?)```/gi
  while ((match = inlineRegex.exec(text)) !== null) addFile(match[1].trim(), match[2])

  // Fallback: single anonymous code block if it contains complete HTML
  if (files.length === 0) {
    const htmlBlockRegex = /```(?:html)?[\r\n]+([\s\S]*?)```/gi
    let htmlMatch
    while ((htmlMatch = htmlBlockRegex.exec(text)) !== null) {
      const candidateHtml = htmlMatch[1]
      if (/<(!DOCTYPE\s+)?html/i.test(candidateHtml) || /<body/i.test(candidateHtml)) {
        files.push({ relativePath: 'index.html', content: candidateHtml.trimEnd() + '\n' })
        break
      }
    }
  }

  return files
}

/**
 * Formats collected project files into a structured markdown context string.
 */
export function formatProjectContext(projectFiles = [], options = {}) {
  if (!Array.isArray(projectFiles) || projectFiles.length === 0) return ''
  const { skippedFiles = 0, skippedList = [] } = options
  const fence = '```'
  let formatted = projectFiles
    .map((f) => `### File: ${f.relativePath}\n${fence}\n${f.content}\n${fence}`)
    .join('\n\n')

  if (skippedFiles > 0) {
    const preview = skippedList.slice(0, 5).join(', ')
    const more = skippedList.length > 5 ? ` and ${skippedList.length - 5} more` : ''
    const warning = `> ⚠️ **Workspace Scan Notice:** ${skippedFiles} workspace file(s) were skipped or truncated due to size/budget limits or read errors (${preview}${more}). The workspace context below is partial.`
    formatted = `${warning}\n\n${formatted}`
  }
  return formatted
}

export async function collectProjectContext(baseDir, maxCharBudget = 16000) {
  if (!baseDir) return { files: [], totalChars: 0, skippedFiles: 0, skippedList: [] }

  const ignoreDirs = new Set(['node_modules', '.git', '.moa', '.worktrees', 'dist', 'build', '.dsh', '.next', '.nuxt', '.cache', 'coverage', '.turbo', '.idea', '.vscode'])
  const codeExts = new Set([
    '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
    '.vue', '.svelte', '.json', '.py', '.md', '.txt', '.sh', '.yaml', '.yml',
  ])

  const collected = []
  let totalChars = 0
  let skippedFiles = 0
  const skippedList = []

  async function scan(currentDir, relPrefix = '') {
    if (totalChars >= maxCharBudget) return
    let list
    try {
      list = await fs.readdir(currentDir, { withFileTypes: true })
    } catch {
      skippedFiles++
      skippedList.push(relPrefix || '.')
      return
    }

    for (const item of list) {
      if (item.name.startsWith('.')) continue
      const rel = relPrefix ? `${relPrefix}/${item.name}` : item.name
      const full = path.join(currentDir, item.name)

      if (totalChars >= maxCharBudget) {
        if (item.isFile() && codeExts.has(path.extname(item.name).toLowerCase())) {
          skippedFiles++
          skippedList.push(`${rel} (budget limit)`)
        }
        continue
      }

      if (item.isDirectory()) {
        if (!ignoreDirs.has(item.name)) await scan(full, rel)
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase()
        if (codeExts.has(ext)) {
          try {
            const stat = await fs.stat(full)
            if (stat.size > 100000) {
              skippedFiles++
              skippedList.push(`${rel} (>100KB)`)
              continue
            }
            const content = await fs.readFile(full, 'utf8')
            const budgetRemaining = maxCharBudget - totalChars
            const truncated = content.length > budgetRemaining ? content.slice(0, budgetRemaining) + '\n... [truncated]' : content
            totalChars += truncated.length
            collected.push({ relativePath: rel, content: truncated, size: stat.size })
          } catch {
            skippedFiles++
            skippedList.push(rel)
          }
        }
      }
    }
  }

  await scan(baseDir)
  return { files: collected, totalChars, skippedFiles, skippedList }
}

/**
 * Checks if a task prompt is an iterative refinement / modification.
 */
export function isRefinementTask(userPrompt = '', projectFiles = null) {
  if (Array.isArray(projectFiles) && projectFiles.length === 0) return false
  const p = userPrompt.toLowerCase().trim()
  if (!p) return false

  // Greenfield creation phrases - ALWAYS fresh task
  const freshPhrases = [
    'from scratch', 'new project', 'new app', 'create a new', 'build a new', 'generate a new',
    '从头开始', '新建项目', '创建项目', '新应用', '新建应用',
    'с нуля', 'новый проект', 'новое приложение', 'создай проект', 'создай приложение', 'создай игру', 'создай сервис',
    'сделай проект', 'сделай приложение', 'сделай игру',
  ]
  if (freshPhrases.some((phrase) => p.includes(phrase))) {
    return false
  }

  // Modification keywords
  const modKeywords = [
    'add', 'change', 'update', 'fix', 'modify', 'refactor', 'improve', 'enhance', 'adjust',
    'style', 'css', 'color', 'theme', 'bug',
    '添加', '修改', '更新', '修复', '重构', '改进', '调整', '样式', '颜色', '主题',
    'добавь', 'измени', 'поменяй', 'исправь', 'обнови', 'переделай', 'доработай', 'удали',
    'темн', 'светл', 'цвет', 'кнопк', 'баг',
  ]

  return modKeywords.some((kw) => p.includes(kw))
}

/**
 * Writes candidate files into an isolated candidate workspace:
 * <baseDir>/.moa/candidate-<index>/
 */
export async function writeCandidateWorkspace(baseDir, candidateIndex, files = []) {
  if (!baseDir || !Array.isArray(files) || files.length === 0) return []

  const targetStr = String(candidateIndex).trim()
  const sanitizedTarget = targetStr.replace(/[^a-zA-Z0-9_-]/g, '')
  const sub = /^\d+$/.test(sanitizedTarget) ? `candidate-${sanitizedTarget}` : (sanitizedTarget || 'candidate-1')
  const moaRoot = path.join(baseDir, '.moa')
  const candidateDir = assertPathContained(moaRoot, sub)
  await fs.mkdir(candidateDir, { recursive: true })

  const written = []
  for (const file of files) {
    if (!isSafeRelativePath(file.relativePath)) continue
    const fullPath = assertPathContained(candidateDir, file.relativePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, file.content, 'utf8')
    written.push({
      relativePath: file.relativePath,
      fullPath,
      size: Buffer.byteLength(file.content, 'utf8'),
    })
  }

  return written
}

/**
 * Best-effort integration with dsh-time-machine to create a shadow Git checkpoint
 * before candidate promotion overwrites files in the project workspace.
 */
export async function createPrePromotionCheckpoint(baseDir, candidateTarget, options = {}) {
  if (!baseDir || options.checkpoint === false) return null
  if (typeof options.checkpointFn === 'function') {
    const res = await bestEffort('custom checkpointFn', () => options.checkpointFn(baseDir, candidateTarget))
    return res || null
  }

  const label = options.checkpointLabel || `moa-pre-promotion: candidate-${candidateTarget}`
  const port = options.port || process.env.DSH_PORT || process.env.PORT || 3000
  const endpoint = options.timeMachineUrl || `http://127.0.0.1:${port}/dsh-time-machine/create`

  const snap = await bestEffort('dsh-time-machine pre-promotion checkpoint', async () => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dsh-trusted': '1' },
      body: JSON.stringify({ label, cwd: baseDir }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 1500),
    })
    if (res.ok) {
      const data = await res.json()
      return data?.snapshot || data || null
    }
    return null
  })
  return snap || null
}

export async function promoteCandidateWorkspace(baseDir, winningIndex, options = { keepMoa: false }) {
  if (!baseDir || winningIndex === null || winningIndex === undefined) return []

  const targetStr = String(winningIndex).trim()
  const sanitizedTarget = targetStr.replace(/[^a-zA-Z0-9_-]/g, '')
  const sub = /^\d+$/.test(sanitizedTarget) ? `candidate-${sanitizedTarget}` : (sanitizedTarget || 'candidate-1')
  const moaRoot = path.join(baseDir, '.moa')
  const winningDir = assertPathContained(moaRoot, sub)

  try {
    const entries = await getFilesRecursively(winningDir)
    if (entries.length === 0) {
      if (!options.keepMoa) {
        await bestEffort('clean moaRoot on empty candidate', () => fs.rm(moaRoot, { recursive: true, force: true }))
      }
      return []
    }

    const checkpoint = await createPrePromotionCheckpoint(baseDir, winningIndex, options)

    const promoted = []
    for (const rel of entries) {
      if (!isSafeRelativePath(rel)) continue
      const srcPath = assertPathContained(winningDir, rel)
      const destPath = assertPathContained(baseDir, rel)

      await fs.mkdir(path.dirname(destPath), { recursive: true })
      await fs.copyFile(srcPath, destPath)
      promoted.push(rel)
    }

    if (checkpoint) promoted.checkpoint = checkpoint
    if (!options.keepMoa) await fs.rm(moaRoot, { recursive: true, force: true })

    return promoted
  } catch (err) {
    if (!options.keepMoa) {
      await bestEffort('clean moaRoot on promote error', () => fs.rm(moaRoot, { recursive: true, force: true }))
    }
    return []
  }
}

/**
 * Cleans up any left-over .moa candidate folder.
 */
export async function cleanMoaWorkspaces(baseDir) {
  if (!baseDir) return
  const moaRoot = path.join(baseDir, '.moa')
  await bestEffort('cleanMoaWorkspaces', () => fs.rm(moaRoot, { recursive: true, force: true }))
}

async function getFilesRecursively(dir) {
  const results = []
  try {
    const stat = await fs.stat(dir)
    if (!stat.isDirectory()) return []
  } catch {
    return []
  }

  async function scan(current, relPrefix = '') {
    let list
    try {
      list = await fs.readdir(current, { withFileTypes: true })
      for (const item of list) {
        const rel = relPrefix ? `${relPrefix}/${item.name}` : item.name
        const full = path.join(current, item.name)
        if (item.isDirectory()) await scan(full, rel)
        else if (item.isFile()) results.push(rel)
      }
    } catch {
      return
    }
  }
  await scan(dir)
  return results
}

/**
 * Verifies the syntactic validity of generated code files.
 */
export function verifyFileSyntax(files = []) {
  if (!Array.isArray(files)) return []
  const warnings = []

  for (const file of files) {
    if (!file || typeof file.content !== 'string' || !file.relativePath) continue
    const ext = path.extname(file.relativePath).toLowerCase()

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      try {
        const transformed = file.content
          .replace(/^([ \t]*)export\s+default\s+/gm, '$1')
          .replace(/^([ \t]*)export\s*\{[^}]*\}\s*;?/gm, '$1')
          .replace(/^([ \t]*)export\s+(const|let|var|function|class|async\s+function)\s+/gm, '$1$2 ')
          .replace(/^([ \t]*)import\s+[^;\n]+;?/gm, '$1')
          .replace(/^([ \t]*)export\s+\*\s+from\s+[^;\n]+;?/gm, '$1')
        new vm.Script(transformed)
      } catch (err) {
        warnings.push({
          file: file.relativePath,
          error: err?.message || String(err),
          line: err?.lineNumber || 1,
        })
      }
    } else if (ext === '.json') {
      try {
        JSON.parse(file.content)
      } catch (err) {
        warnings.push({
          file: file.relativePath,
          error: err?.message || String(err),
          line: 1,
        })
      }
    }
  }

  return warnings
}

/**
 * Reads all files from a candidate workspace (.moa/candidate-N or .moa/curator-synthesis)
 */
export async function readCandidateFiles(baseDir, candidateTarget) {
  if (!baseDir || candidateTarget === undefined || candidateTarget === null) return []
  const targetStr = String(candidateTarget).trim()
  const sanitizedTarget = targetStr.replace(/[^a-zA-Z0-9_-]/g, '')
  const sub = /^\d+$/.test(sanitizedTarget) ? `candidate-${sanitizedTarget}` : (sanitizedTarget || 'candidate-1')
  const moaRoot = path.join(baseDir, '.moa')

  let targetDir
  try {
    targetDir = assertPathContained(moaRoot, sub)
  } catch {
    return []
  }

  try {
    const relFiles = await getFilesRecursively(targetDir)
    const result = []
    for (const rel of relFiles) {
      if (!isSafeRelativePath(rel)) continue
      try {
        const fullPath = assertPathContained(targetDir, rel)
        const content = await fs.readFile(fullPath, 'utf8')
        result.push({
          relativePath: rel,
          content,
          size: Buffer.byteLength(content, 'utf8'),
        })
      } catch {
        // file read error best-effort
      }
    }
    return result
  } catch {
    return []
  }
}

/**
 * Computes a line-by-line diff between two text strings using LCS with
 * common prefix and suffix trimming for optimal O(delta) performance.
 * Returns an array of diff items: { type: 'same' | 'added' | 'removed', line: string, oldNum?: number, newNum?: number }
 */
export function computeLineDiff(oldText = '', newText = '') {
  const oldLines = typeof oldText === 'string' ? oldText.split(/\r?\n/) : []
  const newLines = typeof newText === 'string' ? newText.split(/\r?\n/) : []

  const n = oldLines.length
  const m = newLines.length

  if (n === 0 && m === 0) return []
  if (oldText === newText) {
    return oldLines.map((line, idx) => ({
      type: 'same',
      line,
      oldNum: idx + 1,
      newNum: idx + 1,
    }))
  }

  // 1. Trim common prefix
  let start = 0
  while (start < n && start < m && oldLines[start] === newLines[start]) {
    start++
  }

  // 2. Trim common suffix
  let oldEnd = n - 1
  let newEnd = m - 1
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--
    newEnd--
  }

  const prefixItems = []
  for (let k = 0; k < start; k++) {
    prefixItems.push({ type: 'same', line: oldLines[k], oldNum: k + 1, newNum: k + 1 })
  }

  const suffixItems = []
  const suffixLen = (n - 1) - oldEnd
  for (let k = 0; k < suffixLen; k++) {
    const oNum = oldEnd + 1 + k + 1
    const nNum = newEnd + 1 + k + 1
    suffixItems.push({ type: 'same', line: oldLines[oldEnd + 1 + k], oldNum: oNum, newNum: nNum })
  }

  const subOld = oldLines.slice(start, oldEnd + 1)
  const subNew = newLines.slice(start, newEnd + 1)
  const subN = subOld.length
  const subM = subNew.length

  const middleItems = []

  if (subN === 0) {
    for (let j = 0; j < subM; j++) {
      middleItems.push({ type: 'added', line: subNew[j], newNum: start + j + 1 })
    }
  } else if (subM === 0) {
    for (let i = 0; i < subN; i++) {
      middleItems.push({ type: 'removed', line: subOld[i], oldNum: start + i + 1 })
    }
  } else if (subN > 2000 || subM > 2000) {
    for (let i = 0; i < subN; i++) {
      middleItems.push({ type: 'removed', line: subOld[i], oldNum: start + i + 1 })
    }
    for (let j = 0; j < subM; j++) {
      middleItems.push({ type: 'added', line: subNew[j], newNum: start + j + 1 })
    }
  } else {
    const dp = Array.from({ length: subN + 1 }, () => new Uint16Array(subM + 1))
    for (let i = 0; i < subN; i++) {
      for (let j = 0; j < subM; j++) {
        if (subOld[i] === subNew[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1])
        }
      }
    }

    let i = subN
    let j = subM
    const stack = []

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && subOld[i - 1] === subNew[j - 1]) {
        stack.push({ type: 'same', line: subOld[i - 1], oldNum: start + i, newNum: start + j })
        i--
        j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        stack.push({ type: 'added', line: subNew[j - 1], newNum: start + j })
        j--
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        stack.push({ type: 'removed', line: subOld[i - 1], oldNum: start + i })
        i--
      }
    }

    middleItems.push(...stack.reverse())
  }

  return [...prefixItems, ...middleItems, ...suffixItems]
}
