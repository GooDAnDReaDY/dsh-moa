import z from '@deepseek-ai/schemastery'

// Ensure .volatile() helper exists on Schemastery schema prototype
try {
  const schemaProto = Object.getPrototypeOf(z.boolean())
  if (schemaProto && typeof schemaProto.volatile !== 'function') {
    schemaProto.volatile = function () {
      return typeof this.extra === 'function' ? this.extra('volatile', true) : this
    }
  }
} catch {
  // safe fallback
}

export const PriceRow = z.object({
  input: z.number().default(0),
  output: z.number().default(0),
  cacheHit: z.number().default(0),
})

export const ModelSlotSchema = z.object({
  provider: z.string().default(''),
  model: z.string().default(''),
  role_persona: z.string().default(''),
  temperature: z.number().default(-1),
})

export const PresetSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  ask_clarifying_questions: z.boolean().default(true),
  curator_synthesis: z.boolean().default(false),
  stream_aggregator: z.boolean().default(true),
  quorum_enabled: z.boolean().default(false),
  grace_period_sec: z.number().default(10),
  reference_models: z.array(ModelSlotSchema).default([]),
  aggregator: ModelSlotSchema.default({ provider: '', model: '' }),
  aggregator_fallbacks: z.array(ModelSlotSchema).default([]),
  reference_temperature: z.number().default(0.6),
  aggregator_temperature: z.number().default(0.4),
  reference_timeout_sec: z.number().default(60),
  aggregator_timeout_sec: z.number().default(180),
  blind_evaluation: z.boolean().default(false),
  peer_critique_enabled: z.boolean().default(false),
  allow_candidate_override: z.boolean().default(false),
  max_tokens: z.number().default(4096),
  judge_criteria: z.string().default(''),
  test_gate_enabled: z.boolean().default(false),
  test_command: z.string().default(''),
  test_gate_timeout_sec: z.number().default(15),
  multi_judge_enabled: z.boolean().default(false),
  judge_models: z.array(ModelSlotSchema).default([]),
  judge_voting_strategy: z.string().default('majority'),
  composite_merge_enabled: z.boolean().default(false),
  smart_routing_enabled: z.boolean().default(false),
  smart_routing_model: ModelSlotSchema.default({ provider: '', model: '' }),
  budget_guard_enabled: z.boolean().default(false),
  max_budget_usd: z.number().default(0),
  budget_action: z.string().default('trim'),
  temperature_gradient_enabled: z.boolean().default(false),
  multi_turn_enabled: z.boolean().default(true),
  report_generation_enabled: z.boolean().default(false),
  local_fallback_enabled: z.boolean().default(false),
  local_fallback_models: z.array(ModelSlotSchema).default([]),
  interactive_workbench_enabled: z.boolean().default(false),
  uncertainty_scoring_enabled: z.boolean().default(false),
  subagent_swarm_enabled: z.boolean().default(false),
  adaptive_personas_enabled: z.boolean().default(false),
  quota_aware_balancing_enabled: z.boolean().default(false),
  self_healing_enabled: z.boolean().default(false),
  self_healing_max_retries: z.number().default(2),
  self_healing_command: z.string().default("npm test"),
  visual_moa_enabled: z.boolean().default(false),
  elo_ranking_enabled: z.boolean().default(true),
  ast_composite_merge_enabled: z.boolean().default(false),
  speculative_moa_enabled: z.boolean().default(false),
  speculative_draft_model: ModelSlotSchema.default({ provider: "", model: "" }),
  adversarial_tdd_enabled: z.boolean().default(false),
  local_preflight_check: z.boolean().default(true),
  early_exit_consensus_enabled: z.boolean().default(false),
  early_exit_threshold: z.number().default(0.95),
  context_pruning_enabled: z.boolean().default(true),
  context_pruning_diff_lines: z.number().default(5),
  semantic_cache_enabled: z.boolean().default(false),
  semantic_cache_ttl_hours: z.number().default(168),
  self_consistency_enabled: z.boolean().default(false),
  self_consistency_samples: z.number().default(3),
  self_consistency_temperatures: z.array(z.number()).default([0.2, 0.6, 0.9]),
  escalation_policy: z.string().default('single'),
  escalation_disagreement_threshold: z.number().default(0.40),
  escalation_judge: ModelSlotSchema.default({ provider: '', model: '' }),
  stack_aware_personas_enabled: z.boolean().default(false),
  developer_preferences_enabled: z.boolean().default(false),
})

export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  default_preset: z.string().default('default').volatile(),
  smart_routing_enabled: z.boolean().default(false).volatile(),
  interactive_workbench_enabled: z.boolean().default(false).volatile(),
  ask_clarifying_questions: z.boolean().default(true).volatile(),
  test_gate_enabled: z.boolean().default(false).volatile(),
  uncertainty_scoring_enabled: z.boolean().default(false).volatile(),
  subagent_swarm_enabled: z.boolean().default(false).volatile(),
  adaptive_personas_enabled: z.boolean().default(false).volatile(),
  quota_aware_balancing_enabled: z.boolean().default(false).volatile(),
  self_healing_enabled: z.boolean().default(false).volatile(),
  self_healing_max_retries: z.number().default(2).volatile(),
  self_healing_command: z.string().default("npm test").volatile(),
  visual_moa_enabled: z.boolean().default(false).volatile(),
  elo_ranking_enabled: z.boolean().default(true).volatile(),
  ast_composite_merge_enabled: z.boolean().default(false).volatile(),
  speculative_moa_enabled: z.boolean().default(false).volatile(),
  speculative_draft_model: ModelSlotSchema.default({ provider: "", model: "" }).volatile(),
  adversarial_tdd_enabled: z.boolean().default(false).volatile(),
  local_preflight_check: z.boolean().default(true).volatile(),
  early_exit_consensus_enabled: z.boolean().default(false).volatile(),
  early_exit_threshold: z.number().default(0.95).volatile(),
  context_pruning_enabled: z.boolean().default(true).volatile(),
  context_pruning_diff_lines: z.number().default(5).volatile(),
  semantic_cache_enabled: z.boolean().default(false).volatile(),
  semantic_cache_ttl_hours: z.number().default(168).volatile(),
  self_consistency_enabled: z.boolean().default(false).volatile(),
  self_consistency_samples: z.number().default(3).volatile(),
  self_consistency_temperatures: z.array(z.number()).default([0.2, 0.6, 0.9]).volatile(),
  escalation_policy: z.string().default('single').volatile(),
  escalation_disagreement_threshold: z.number().default(0.40).volatile(),
  escalation_judge: ModelSlotSchema.default({ provider: '', model: '' }).volatile(),
  stack_aware_personas_enabled: z.boolean().default(false).volatile(),
  developer_preferences_enabled: z.boolean().default(false).volatile(),
  smart_routing_model: ModelSlotSchema.default({ provider: '', model: '' }).volatile(),
  prices: z.dict(PriceRow).default({}).volatile(),
  presets: z.array(PresetSchema).default([
    {
      name: 'default',
      enabled: true,
      ask_clarifying_questions: true,
      reference_models: [
        { provider: '', model: '', role_persona: 'proposer' },
        { provider: '', model: '', role_persona: 'challenger' },
      ],
      aggregator: { provider: '', model: '' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.4,
      max_tokens: 4096,
      judge_criteria: '',
      context_pruning_enabled: true,
      context_pruning_diff_lines: 5,
      semantic_cache_enabled: false,
      semantic_cache_ttl_hours: 168,
    },
    {
      name: 'fast',
      enabled: true,
      ask_clarifying_questions: false,
      reference_models: [
        { provider: '', model: '', role_persona: 'fast' },
      ],
      aggregator: { provider: '', model: '' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.2,
      max_tokens: 4096,
      judge_criteria: '',
      context_pruning_enabled: true,
      context_pruning_diff_lines: 5,
      semantic_cache_enabled: false,
      semantic_cache_ttl_hours: 168,
    },
    {
      name: 'deep-reasoning',
      enabled: true,
      ask_clarifying_questions: true,
      reference_models: [
        { provider: '', model: '', role_persona: 'architect' },
        { provider: '', model: '', role_persona: 'critic' },
      ],
      aggregator: { provider: '', model: '' },
      reference_temperature: 0.6,
      aggregator_temperature: 0.2,
      max_tokens: 8192,
      judge_criteria: '',
    },
  ]).volatile(),
})

export function plainConfig(value) {
  if (value && typeof value === 'object' && typeof value.get === 'function') {
    return plainConfig(value.get())
  }
  if (Array.isArray(value)) {
    return value.map(plainConfig)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, plainConfig(child)])
    )
  }
  return value
}

