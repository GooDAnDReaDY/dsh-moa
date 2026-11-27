export const SCHEMA_FIELDS = new Set([
  'enabled', 'default_preset', 'smart_routing_enabled', 'smart_routing_model',
  'prices', 'presets', 'pr_review_bot_enabled', 'pr_review_gitea_token',
  'pr_review_webhook_secret', 'pr_review_strict_blocking', 'pr_review_allowed_repos',
  'enable_ecosystem_context', 'sync_with_memory_brain',
])

export function sanitizeToSchemaKeys(plain) {
  if (!plain || typeof plain !== 'object' || Array.isArray(plain)) return plain
  return Object.fromEntries(Object.entries(plain).filter(([key]) => SCHEMA_FIELDS.has(key)))
}
