import fsSync from 'node:fs'
import path from 'node:path'

export function isSafeRelativePath(relPath) {
  if (!relPath || typeof relPath !== 'string') return false
  const trimmed = relPath.trim()
  if (!trimmed || path.isAbsolute(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\')) return false
  const normalized = path.normalize(trimmed)
  return !(!normalized || normalized === '.' || normalized.startsWith('..') || path.isAbsolute(normalized))
}

/**
 * Asserts that a resolved path is strictly contained within baseDir, verifying
 * both lexical boundaries and physical canonical symlink resolution.
 */
export function assertPathContained(baseDir, subPath) {
  const resolvedBase = path.resolve(baseDir)
  const resolvedTarget = path.resolve(resolvedBase, subPath)
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Path traversal violation: "${subPath}" escapes base directory "${baseDir}"`)
  }

  try {
    const realBase = fsSync.realpathSync(resolvedBase)
    try {
      const realTarget = fsSync.realpathSync(resolvedTarget)
      if (realTarget !== realBase && !realTarget.startsWith(realBase + path.sep)) {
        throw new Error(`Path traversal violation: symlink "${subPath}" resolves outside "${baseDir}"`)
      }
    } catch (targetErr) {
      if (targetErr?.code === 'ENOENT') {
        let curr = path.dirname(resolvedTarget)
        while (curr === resolvedBase || curr.startsWith(resolvedBase + path.sep)) {
          try {
            const realCurr = fsSync.realpathSync(curr)
            if (realCurr !== realBase && !realCurr.startsWith(realBase + path.sep)) {
              throw new Error(`Path traversal violation: symlink ancestor in "${subPath}" resolves outside "${baseDir}"`)
            }
            break
          } catch (ancestorErr) {
            if (ancestorErr?.code === 'ENOENT') {
              const parent = path.dirname(curr)
              if (parent === curr) break
              curr = parent
              continue
            }
            throw ancestorErr
          }
        }
      } else {
        throw targetErr
      }
    }
  } catch (baseErr) {
    if (baseErr?.message?.startsWith('Path traversal violation')) throw baseErr
  }

  return resolvedTarget
}

/**
 * Resolves directory paths for candidate sandboxes with optional runId scoping.
 */

export function isLoopbackUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const h = u.hostname.replace(/^\[|\]$/g, '')
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || /^127\.\d+\.\d+\.\d+$/.test(h)
  } catch {
    return false
  }
}

/**
 * Best-effort integration with dsh-time-machine to create a shadow Git checkpoint
 * before candidate promotion overwrites files in the project workspace.
 */
