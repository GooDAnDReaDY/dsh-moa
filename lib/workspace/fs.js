import { bestEffort } from '../best-effort.js'
import { logger } from '../logger.js'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { isSafeRelativePath, assertPathContained } from './security.js'
import { createPrePromotionCheckpoint } from './checkpoint.js'

const promotionLocks = new Map()

export function resolveCandidateFolder(baseDir, candidateTarget, options = {}) {
  const targetStr = String(candidateTarget ?? 1).trim()
  const sanitizedTarget = targetStr.replace(/[^a-zA-Z0-9_-]/g, '')
  const sub = /^\d+$/.test(sanitizedTarget) ? `candidate-${sanitizedTarget}` : (sanitizedTarget || 'candidate-1')
  const rawRunId = typeof options === 'string' ? options : options?.runId
  const safeRunId = rawRunId ? String(rawRunId).trim().replace(/[^a-zA-Z0-9_-]/g, '') : null
  const moaRoot = assertPathContained(baseDir, '.moa')
  const runRoot = safeRunId ? assertPathContained(moaRoot, safeRunId) : moaRoot
  return { moaRoot, runRoot, safeRunId, sub, candidateDir: assertPathContained(runRoot, sub) }
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

  const patterns = [
    /```[\w-]*\s+(?:file|path|filepath)=["']?([^\s"'\n\r]+)["']?[\r\n]+([\s\S]*?)```/gi,
    /(?:\/\/|#|<!--)\s*(?:File|Path):\s*([^\s\n\r>]+)(?:\s*-->)?[\r\n]+```[\w-]*[\r\n]+([\s\S]*?)```/gi,
    /#{1,4}\s+(?:File|Path):\s*([^\s\n\r]+)[\r\n]+```[\w-]*[\r\n]+([\s\S]*?)```/gi,
    /```[\w-]*[\r\n]+(?:\/\/|#|<!--)\s*(?:File|Path):\s*([^\s\n\r>]+)(?:\s*-->)?[\r\n]+([\s\S]*?)```/gi,
  ]
  for (const regex of patterns) {
    let match
    while ((match = regex.exec(text)) !== null) addFile(match[1].trim(), match[2])
  }

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

export async function writeCandidateWorkspace(baseDir, candidateIndex, files = [], options = {}) {
  if (!baseDir || !Array.isArray(files) || files.length === 0) return []
  const { runRoot, sub, candidateDir } = resolveCandidateFolder(baseDir, candidateIndex, options)
  await fs.mkdir(runRoot, { recursive: true })

  const tempSub = `.tmp-${sub}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const tempCandidateDir = assertPathContained(runRoot, tempSub)
  await fs.mkdir(tempCandidateDir, { recursive: true })

  try {
    const written = []
    for (const file of files) {
      if (!isSafeRelativePath(file.relativePath)) continue
      const fullPath = assertPathContained(tempCandidateDir, file.relativePath)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, file.content, 'utf8')
      written.push({
        relativePath: file.relativePath,
        fullPath: path.join(candidateDir, file.relativePath),
        size: Buffer.byteLength(file.content, 'utf8'),
      })
    }

    if (written.length === 0 && files.length > 0) throw new Error('No valid files could be written to candidate workspace')
    await fs.rm(candidateDir, { recursive: true, force: true })
    await fs.rename(tempCandidateDir, candidateDir)
    return written
  } catch (err) {
    await bestEffort('clean tempCandidateDir on error', () => fs.rm(tempCandidateDir, { recursive: true, force: true }))
    throw err
  }
}


export async function promoteCandidateWorkspace(baseDir, winningIndex, options = { keepMoa: false }) {
  if (!baseDir || winningIndex === null || winningIndex === undefined) return []

  const key = path.resolve(baseDir)
  const prevLock = promotionLocks.get(key) || Promise.resolve()
  let releaseLock
  const currentLock = new Promise((resolve) => { releaseLock = resolve })
  promotionLocks.set(key, currentLock)

  try {
    await prevLock
    return await doPromoteCandidateWorkspace(baseDir, winningIndex, options)
  } finally {
    releaseLock()
    if (promotionLocks.get(key) === currentLock) {
      promotionLocks.delete(key)
    }
  }
}

async function doPromoteCandidateWorkspace(baseDir, winningIndex, options = { keepMoa: false }) {
  const { runRoot, moaRoot, safeRunId, candidateDir: winningDir } = resolveCandidateFolder(baseDir, winningIndex, options)
  const cleanupTarget = safeRunId ? runRoot : moaRoot

  try {
    const entries = await getFilesRecursively(winningDir)
    if (entries.length === 0) {
      if (!options.keepMoa) await bestEffort('clean empty candidate folder', () => fs.rm(cleanupTarget, { recursive: true, force: true }))
      return []
    }

    const checkpoint = await createPrePromotionCheckpoint(baseDir, winningIndex, options)
    if (options.checkpoint !== false && !checkpoint && !options.force) {
      const errMsg = `[dsh-moa] Pre-promotion checkpoint failed for candidate-${winningIndex} in ${baseDir}. File overwrite blocked to prevent uncheckpointed changes (pass force: true to override).`
      logger.warn(errMsg)
      throw new Error(errMsg)
    }
    if (options.signal?.aborted) {
      throw (options.signal.reason instanceof Error ? options.signal.reason : new Error('Turn aborted'))
    }

    const promoted = []
    const baseReal = await fs.realpath(baseDir).catch(() => path.resolve(baseDir))

    for (const rel of entries) {
      if (!isSafeRelativePath(rel)) continue
      const srcPath = assertPathContained(winningDir, rel)
      const destPath = assertPathContained(baseDir, rel)

      try {
        const destLstat = await fs.lstat(destPath)
        if (destLstat.isSymbolicLink()) {
          const destReal = await fs.realpath(destPath)
          if (destReal !== baseReal && !destReal.startsWith(baseReal + path.sep)) {
            throw new Error(`Path traversal violation: promotion destination symlink "${rel}" resolves outside "${baseDir}"`)
          }
          await fs.unlink(destPath)
        }
      } catch (lstatErr) {
        if (lstatErr?.code !== 'ENOENT') throw lstatErr
      }

      await fs.mkdir(path.dirname(destPath), { recursive: true })
      await fs.copyFile(srcPath, destPath)
      promoted.push(rel)
    }

    if (checkpoint) promoted.checkpoint = checkpoint
    if (!options.keepMoa) await fs.rm(cleanupTarget, { recursive: true, force: true })

    return promoted
  } catch (err) {
    if (!options.keepMoa) {
      await bestEffort('clean candidate on promote error', () => fs.rm(cleanupTarget, { recursive: true, force: true }))
    }
    throw err
  }
}

/**
 * Cleans up candidate workspaces, optionally scoped to a single runId.
 */
export async function cleanMoaWorkspaces(baseDir, options = {}) {
  if (!baseDir) return
  const rawRunId = typeof options === 'string' ? options : options?.runId
  const safeRunId = rawRunId ? String(rawRunId).trim().replace(/[^a-zA-Z0-9_-]/g, '') : null
  const moaRoot = assertPathContained(baseDir, '.moa')
  if (safeRunId) {
    await bestEffort('cleanMoaWorkspaces runId', () => fs.rm(assertPathContained(moaRoot, safeRunId), { recursive: true, force: true }))
    await bestEffort('clean empty moaRoot', async () => {
      if ((await fs.readdir(moaRoot)).length === 0) await fs.rmdir(moaRoot)
    })
  } else {
    await bestEffort('cleanMoaWorkspaces', () => fs.rm(moaRoot, { recursive: true, force: true }))
  }
}

async function getFilesRecursively(dir) {
  const results = []
  try {
    const stat = await fs.stat(dir)
    if (!stat.isDirectory()) return []
  } catch {
    return []
  }

  let realDir
  try {
    realDir = await fs.realpath(dir)
  } catch {
    realDir = path.resolve(dir)
  }

  async function scan(current, relPrefix = '') {
    let list
    try {
      list = await fs.readdir(current, { withFileTypes: true })
      for (const item of list) {
        const rel = relPrefix ? `${relPrefix}/${item.name}` : item.name
        const full = path.join(current, item.name)

        if (item.isSymbolicLink()) {
          try {
            const realTarget = await fs.realpath(full)
            if (realTarget === realDir || realTarget.startsWith(realDir + path.sep)) {
              const st = await fs.stat(full)
              if (st.isFile()) results.push(rel)
            }
          } catch (err) { logger.debug?.('[dsh-moa] symlink inspect skipped', err) }
          continue
        }

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

export async function readCandidateFiles(baseDir, candidateTarget, options = {}) {
  if (!baseDir || candidateTarget === undefined || candidateTarget === null) return []
  let targetDir
  try {
    targetDir = resolveCandidateFolder(baseDir, candidateTarget, options).candidateDir
  } catch {
    return []
  }

  try {
    const relFiles = await getFilesRecursively(targetDir)
    const result = []
    const realTarget = await fs.realpath(targetDir).catch(() => targetDir)

    for (const rel of relFiles) {
      if (!isSafeRelativePath(rel)) continue
      try {
        const fullPath = assertPathContained(targetDir, rel)
        const st = await fs.lstat(fullPath)
        if (st.isSymbolicLink()) {
          const realFile = await fs.realpath(fullPath)
          if (realFile !== realTarget && !realFile.startsWith(realTarget + path.sep)) continue
        }
        const content = await fs.readFile(fullPath, 'utf8')
        result.push({ relativePath: rel, content, size: Buffer.byteLength(content, 'utf8') })
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
 */
