export const SAFE_SYS_DIRS = /^\/(?:usr\/(?:bin|lib|include)|bin|lib|lib64|etc|dev)(?:\/|$)/
export const SENSITIVE_EXTS = /\.(?:txt|json|env|npmrc|key|ssh|md)/i
export const SENSITIVE_SYSTEM_FILES = /\/etc\/(?:passwd|shadow|group|gshadow|sudoers)(?:$|[^\w])/

export function isAllowedSystemPath(raw) {
  if (SENSITIVE_SYSTEM_FILES.test(raw)) return false
  if (SAFE_SYS_DIRS.test(raw) && !SENSITIVE_EXTS.test(raw)) return true
  return false
}
