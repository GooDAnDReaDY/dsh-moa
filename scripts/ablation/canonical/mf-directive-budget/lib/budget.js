export function computeDirectiveBudget(referenceTexts = [], options = {}) {
  const { fraction = 0.15, minChars = 4000, maxChars = 24000 } = options
  let total = 0
  for (const ref of referenceTexts) total += (typeof ref === 'string' ? ref : ref?.text || '').length
  return Math.max(minChars, Math.min(maxChars, Math.round(total * fraction)))
}
