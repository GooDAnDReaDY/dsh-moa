export function profileFromScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'balanced'
  if (score < 0.35) return 'fast'
  if (score <= 0.7) return 'balanced'
  return 'deep'
}
