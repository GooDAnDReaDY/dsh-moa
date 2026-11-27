export const ENTRY_NAMES = ['main', 'solve', 'run', 'handler', 'benchmark']

export function resolveEntrypoint(declaredNames, options = {}) {
  const declared = Array.isArray(declaredNames) ? declaredNames : []
  if (options.entrypointName && declared.includes(options.entrypointName)) return options.entrypointName
  const canonical = declared.find((n) => ENTRY_NAMES.includes(n))
  if (canonical) return canonical
  if (declared.length === 1) return declared[0]
  return null
}
