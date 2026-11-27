export const UNIX_ROOT_PREFIX = /^\/(?:home|root|etc|var|tmp|opt|mnt|srv|media|proc|sys|dev|usr|bin|lib|lib64|sbin|boot)(?:\/|$)/

export function isHostAbsolutePath(token) {
  if (!token || typeof token !== 'string') return false
  if (token.length >= 3 && token[1] === ':' && (token[2] === '/' || token[2] === '\\')) return true
  return UNIX_ROOT_PREFIX.test(token)
}
