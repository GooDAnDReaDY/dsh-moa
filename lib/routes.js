/**
 * DeepSeek Harness Mixture of Agents (MoA) — HTTP Route Dispatcher
 * Subroutes are modularized in lib/routes/ for line budget compliance.
 */

import { registerPresetRoutes } from './routes/presets.js'
import { registerHistoryRoutes } from './routes/history.js'
import { registerWorkbenchRoutes } from './routes/workbench.js'
import { registerPipelineRoutes } from './routes/pipeline.js'
import { registerCacheRoutes } from './routes/cache.js'
import { registerPreferencesRoutes } from './routes/preferences.js'
import { registerBenchmarkRoutes } from './routes/benchmark.js'

export { registerPresetRoutes } from './routes/presets.js'
export { registerHistoryRoutes } from './routes/history.js'
export { registerWorkbenchRoutes } from './routes/workbench.js'
export { registerPipelineRoutes } from './routes/pipeline.js'
export { registerCacheRoutes } from './routes/cache.js'
export { registerPreferencesRoutes } from './routes/preferences.js'
export { registerBenchmarkRoutes } from './routes/benchmark.js'

export function registerMoaRoutes(ctx, deps) {
  registerPresetRoutes(ctx, deps)
  registerHistoryRoutes(ctx, deps)
  registerWorkbenchRoutes(ctx, deps)
  registerPipelineRoutes(ctx, deps)
  registerCacheRoutes(ctx, deps)
  registerPreferencesRoutes(ctx, deps)
  registerBenchmarkRoutes(ctx, deps)
}
