/**
 * Module customization hooks: redirect the harness-only peer dependencies of
 * lib/index.js to test stubs so the interceptor tests run without the DSH
 * runtime and without network.
 */
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const schemasteryStub = pathToFileURL(path.join(here, 'stubs', 'schemastery.mjs')).href
const pricingStub = pathToFileURL(path.join(here, 'stubs', 'pricing-noop.mjs')).href

export async function resolve(specifier, context, next) {
  if (specifier === '@deepseek-ai/schemastery') {
    return { url: schemasteryStub, shortCircuit: true }
  }
  if (specifier === './pricing.js' && context.parentURL && context.parentURL.includes('/lib/index.js')) {
    return { url: pricingStub, shortCircuit: true }
  }
  return next(specifier, context)
}
