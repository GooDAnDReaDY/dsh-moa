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
})

export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  default_preset: z.string().default('default').volatile(),
  smart_routing_enabled: z.boolean().default(false).volatile(),
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
