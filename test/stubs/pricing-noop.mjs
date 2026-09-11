/**
 * No-op pricing stub for the apply() interceptor tests: the real
 * refreshCatalogInBackground would try to fetch the OpenRouter catalog and
 * the tests must run without network.
 */
export function refreshCatalogInBackground() {}
