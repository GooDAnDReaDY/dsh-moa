import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Parses markdown code blocks that specify file paths.
 * Supports patterns like:
 * ```html file="index.html"
 * ```javascript filepath=script.js
 * // File: index.html
 * <!-- File: styles.css -->
 * ### File: index.html
 * ```html
 */
export function extractFileBlocks(text) {
  if (!text || typeof text !== 'string') return []

  const files = []
  const seenPaths = new Set()

  // Pattern 1: fenced blocks with file="..." or path="..." in info string
  // Example: ```html file="index.html" or ```js path=src/main.js
  const fenceRegex = /```[\w-]*\s+(?:file|path|filepath)=["']?([^\s"'\n\r]+)["']?[\r\n]+([\s\S]*?)```/gi
  let match
  while ((match = fenceRegex.exec(text)) !== null) {
    const rawPath = match[1].trim()
    const content = match[2]
    if (rawPath && !seenPaths.has(rawPath)) {
      seenPaths.add(rawPath)
      files.push({ relativePath: sanitizePath(rawPath), content })
    }
  }

  // Pattern 2: Explicit headers before code blocks, e.g.
  // **File: `index.html`** or ### File: index.html or `File: index.html` followed by ```
  const headerRegex = /(?:###?\s*File:\s*|File:\s*|#\s*File:\s*)[`"]?([a-zA-Z0-9_.\-\/\\]+)[`"]?\s*[\r\n]+```[\w-]*[\r\n]+([\s\S]*?)```/gi
  while ((match = headerRegex.exec(text)) !== null) {
    const rawPath = match[1].trim()
    const content = match[2]
    if (rawPath && !seenPaths.has(rawPath)) {
      seenPaths.add(rawPath)
      files.push({ relativePath: sanitizePath(rawPath), content })
    }
  }

  // Pattern 3: Comment inside the code block on line 1: // File: foo.js or /* File: foo.css */ or <!-- File: index.html -->
  const commentRegex = /```[\w-]*[\r\n]+(?:\/\/|\/\*|<!--|#)\s*(?:File|filename):\s*([a-zA-Z0-9_.\-\/\\]+)(?:\s*\*\/|\s*-->)?[\r\n]+([\s\S]*?)```/gi
  while ((match = commentRegex.exec(text)) !== null) {
    const rawPath = match[1].trim()
    const content = match[2]
    if (rawPath && !seenPaths.has(rawPath)) {
      seenPaths.add(rawPath)
      files.push({ relativePath: sanitizePath(rawPath), content })
    }
  }

  // Fallback: If no annotated blocks found, check if text has exactly one prominent standalone code block with common extensions
  if (files.length === 0) {
    const singleBlockRegex = /```(html|css|javascript|js|json|python|py|sh|bash)[\r\n]+([\s\S]*?)```/gi
    const singleMatches = []
    while ((match = singleBlockRegex.exec(text)) !== null) {
      singleMatches.push({ lang: match[1].toLowerCase(), content: match[2] })
    }
    if (singleMatches.length === 1) {
      const extMap = {
        html: 'index.html',
        javascript: 'index.js',
        js: 'index.js',
        css: 'style.css',
        python: 'main.py',
        py: 'main.py',
        json: 'data.json',
        bash: 'run.sh',
        sh: 'run.sh',
      }
      const defaultName = extMap[singleMatches[0].lang] || 'output.txt'
      files.push({ relativePath: defaultName, content: singleMatches[0].content })
    }
  }

  return files
}

function sanitizePath(filePath) {
  const normalized = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '')
  return normalized.replace(/^[\\\/]+/, '')
}

/**
 * Collects readable text files from current workspace to feed as context for candidate models (#6).
 * Ignores node_modules, .git, .moa, binary files, large bundles.
 */
export async function collectProjectContext(baseDir, maxCharBudget = 16000) {
  if (!baseDir) return { files: [], totalChars: 0 }

  const ignoreDirs = new Set(['node_modules', '.git', '.moa', '.worktrees', 'dist', 'build', '.dsh', '.next', '.nuxt', '.cache', 'coverage', '.turbo', '.idea', '.vscode'])
  const codeExts = new Set([
    '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
    '.vue', '.svelte', '.json', '.py', '.md', '.txt', '.sh', '.yaml', '.yml',
  ])

  const collected = []
  let totalChars = 0

  async function scan(currentDir, relPrefix = '') {
    if (totalChars >= maxCharBudget) return
    try {
      const list = await fs.readdir(currentDir, { withFileTypes: true })
      for (const item of list) {
        if (totalChars >= maxCharBudget) break
        // Skip all dotfiles, including .env and .env.* variants: their
        // contents must never be shipped to third-party model providers.
        if (item.name.startsWith('.')) continue

        const rel = relPrefix ? `${relPrefix}/${item.name}` : item.name
        const full = path.join(currentDir, item.name)

        if (item.isDirectory()) {
          if (!ignoreDirs.has(item.name)) {
            await scan(full, rel)
          }
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase()
          if (codeExts.has(ext)) {
            try {
              const stat = await fs.stat(full)
              if (stat.size > 100000) continue // skip files > 100kb
              const content = await fs.readFile(full, 'utf8')
              const budgetRemaining = maxCharBudget - totalChars
              const truncated = content.length > budgetRemaining ? content.slice(0, budgetRemaining) + '\n... [truncated]' : content
              totalChars += truncated.length
              collected.push({ relativePath: rel, content: truncated, size: stat.size })
            } catch {}
          }
        }
      }
    } catch {}
  }

  await scan(baseDir)
  return { files: collected, totalChars }
}

/**
 * Checks if a task prompt is an iterative refinement / modification
 * of an existing project rather than a greenfield project creation (#4).
 */
export function isRefinementTask(userPrompt = '', projectFiles = []) {
  if (!Array.isArray(projectFiles) || projectFiles.length === 0) return false
  const p = userPrompt.toLowerCase().trim()
  if (!p) return false

  // Greenfield creation phrases - ALWAYS fresh task
  const freshPhrases = [
    'с нуля', 'from scratch', 'новый проект', 'новое приложение', 'new project', 'new app',
    'создай проект', 'создай приложение', 'создай игру', 'создай сервис',
    'сделай проект', 'сделай приложение', 'сделай игру',
    'create a new', 'build a new', 'generate a new',
  ]
  if (freshPhrases.some((phrase) => p.includes(phrase))) {
    return false
  }

  // Modification keywords
  const modKeywords = [
    'добавь', 'измени', 'поменяй', 'исправь', 'обнови', 'переделай', 'доработай', 'удали',
    'add', 'change', 'update', 'fix', 'modify', 'refactor', 'improve', 'enhance', 'adjust',
    'style', 'css', 'темн', 'светл', 'color', 'цвет', 'кнопк', 'theme', 'bug', 'баг',
  ]

  return modKeywords.some((kw) => p.includes(kw))
}

/**
 * Writes candidate files into an isolated candidate workspace:
 * <baseDir>/.moa/candidate-<index>/
 */
export async function writeCandidateWorkspace(baseDir, candidateIndex, files = []) {
  if (!baseDir || !Array.isArray(files) || files.length === 0) return []

  const candidateDir = path.join(baseDir, '.moa', `candidate-${candidateIndex}`)
  await fs.mkdir(candidateDir, { recursive: true })

  const written = []
  for (const file of files) {
    const fullPath = path.join(candidateDir, file.relativePath)
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
 * Promotes winning candidate files to baseDir root,
 * then cleans up the temporary .moa folder.
 */
export async function promoteCandidateWorkspace(baseDir, winningIndex, options = { keepMoa: false }) {
  if (!baseDir || winningIndex === null || winningIndex === undefined) return []

  const winningDir = path.join(baseDir, '.moa', `candidate-${winningIndex}`)
  const moaRoot = path.join(baseDir, '.moa')

  try {
    const entries = await getFilesRecursively(winningDir)
    if (entries.length === 0) {
      if (!options.keepMoa) {
        try { await fs.rm(moaRoot, { recursive: true, force: true }) } catch {}
      }
      return []
    }

    const promoted = []
    for (const rel of entries) {
      const srcPath = path.join(winningDir, rel)
      const destPath = path.join(baseDir, rel)

      await fs.mkdir(path.dirname(destPath), { recursive: true })
      await fs.copyFile(srcPath, destPath)
      promoted.push(rel)
    }

    if (!options.keepMoa) {
      // Clean up temporary .moa folder
      await fs.rm(moaRoot, { recursive: true, force: true })
    }

    return promoted
  } catch (err) {
    if (!options.keepMoa) {
      try { await fs.rm(moaRoot, { recursive: true, force: true }) } catch {}
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
  try {
    await fs.rm(moaRoot, { recursive: true, force: true })
  } catch {}
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
    try {
      const list = await fs.readdir(current, { withFileTypes: true })
      for (const item of list) {
        const rel = relPrefix ? `${relPrefix}/${item.name}` : item.name
        const full = path.join(current, item.name)
        if (item.isDirectory()) {
          await scan(full, rel)
        } else if (item.isFile()) {
          results.push(rel)
        }
      }
    } catch {}
  }
  await scan(dir)
  return results
}
