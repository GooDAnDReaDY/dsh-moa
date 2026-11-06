/**
 * Cordis Event Bus Definitions and Helpers for dsh-moa
 */

export const MOA_EVENTS = {
  RUN_START: 'moa/run-start',
  CANDIDATE_COMPLETE: 'moa/candidate-complete',
  SYNTAX_VALIDATION: 'moa/syntax-validation',
  EARLY_CONSENSUS: 'moa/early-consensus',
  JUDGE_ESCALATION: 'moa/judge-escalation',
  SELF_CONSISTENCY_EXPAND: 'moa/self-consistency-expand',
  STACK_DETECTED: 'moa/stack-detected',
  PREFERENCES_APPLIED: 'moa/preferences-applied',
  SECURITY_AUDIT: 'moa/security-audit',
  COVE_VERIFIED: 'moa/cove-verified',
  PROFILER_COMPLETE: 'moa/profiler-complete',
  MUTATION_COMPLETE: 'moa/mutation-complete',
  CRITIQUE_COMPLETE: 'moa/critique-complete',
  JUDGE_VERDICT: 'moa/judge-verdict',
  CONTEXT_PRUNING: 'moa/context-pruning',
  CACHE_HIT: 'moa/cache-hit',
  RUN_FINISH: 'moa/run-finish',
}

/**
 * Dispatches an event onto the Cordis event bus with best-effort error isolation.
 * If ctx or ctx.emit is not available, or an event listener throws, the pipeline is not interrupted.
 *
 * @param {object} [ctx] - Cordis context or mock context
 * @param {string} eventName - One of MOA_EVENTS
 * @param {object} payload - Event data payload
 */
export function emitEvent(ctx, eventName, payload) {
  if (!ctx || !eventName) return
  try {
    if (typeof ctx.emit === 'function') {
      ctx.emit(eventName, payload)
    }
  } catch (_err) {
    /* best-effort event dispatch: listener exceptions must never abort pipeline */
  }
}
