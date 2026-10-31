import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'

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
  const codeExts = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.json', '.py', '.md', '.txt', '.sh', '.yaml', '.yml'])
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
          } catch (err) {
            skippedFiles++
            skippedList.push(`${rel} (read error: ${err?.message || String(err)})`)
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
  if ((Array.isArray(projectFiles) && projectFiles.length === 0) || !userPrompt?.trim()) return false
  const p = userPrompt.toLowerCase().trim()
  const fresh = ['from scratch', 'new project', 'new app', 'create a new', 'build a new', 'generate a new', '从头开始', '新建项目', '创建项目', '新应用', '新建应用', 'с нуля', 'новый проект', 'новое приложение', 'создай проект', 'создай приложение', 'создай игру', 'создай сервис', 'сделай проект', 'сделай приложение', 'сделай игру']
  if (fresh.some((phrase) => p.includes(phrase))) return false
  const mod = ['add', 'change', 'update', 'fix', 'modify', 'refactor', 'improve', 'enhance', 'adjust', 'style', 'css', 'color', 'theme', 'bug', '添加', '修改', '更新', '修复', '重构', '改进', '调整', '样式', '颜色', '主题', 'добавь', 'измени', 'поменяй', 'исправь', 'обнови', 'переделай', 'доработай', 'удали', 'темн', 'светл', 'цвет', 'кнопк', 'баг']
  return mod.some((kw) => p.includes(kw))
}

/**
 * Writes candidate files into an isolated candidate workspace.
 * Uses atomic staging and swap to prevent stale file accumulation and dirty snapshots.
 */
