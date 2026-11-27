import path from 'node:path'

export function normalizeRelativePath(relPath) {
  if (!relPath || typeof relPath !== 'string') return ''
  const posix = relPath.trim().split('\\').join('/')
  let out = posix
  while (out.includes('//')) out = out.split('//').join('/')
  out = out.split('/./').join('/')
  if (out.startsWith('./')) out = out.slice(2)
  if (out.startsWith('/')) out = out.slice(1)
  return out
}
