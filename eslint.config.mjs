/**
 * ESLint flat config for dsh-moa (#374).
 *
 * Scope: the no-undef axis from the family audit — `node --check` does not catch
 * undeclared identifiers, and tests may not exercise every path (family cases:
 * dsh-clinebot#34, dsh-time-machine#43). Generated client bundles are linted
 * directly because they are self-contained CJS factories; the concatenation
 * fragments in src/ share a single scope across files and cannot be linted
 * standalone.
 */

// Server (Node 20+, ESM) and build/test tooling globals. Only platform builtins
// that the code actually uses are listed; anything else is a genuine no-undef.
const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  queueMicrotask: 'readonly',
  structuredClone: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  performance: 'readonly',
  crypto: 'readonly',
  fetch: 'readonly',
  globalThis: 'writable',
  Promise: 'readonly',
  __filename: 'readonly',
  __dirname: 'readonly',
  require: 'writable',
  module: 'writable',
  exports: 'writable',
}

// Browser half: the generated bundles run inside the DSH web app. `__ModuleLoader__`
// is the DSH combo-loader global; everything else is a standard platform global.
const browserGlobals = {
  window: 'writable',
  document: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  localStorage: 'writable',
  sessionStorage: 'writable',
  history: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  getComputedStyle: 'readonly',
  URLSearchParams: 'readonly',
  URL: 'readonly',
  AbortController: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  queueMicrotask: 'readonly',
  structuredClone: 'readonly',
  performance: 'readonly',
  crypto: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  Buffer: 'readonly',
  process: 'readonly',
  URLSearchParams: 'readonly',
  __ModuleLoader__: 'writable',
  globalThis: 'writable',
}

export default [
  {
    ignores: [
      'node_modules/**',
      'media/**',
      '.worktrees/**',
      '.moa/**',
      // Concatenation fragments share one module scope across files (top-level
      // `return`, symbols declared by 00-runtime.js) and cannot be parsed
      // standalone. The no-undef axis for the client half is covered by linting
      // the generated self-contained bundles below; build parity is enforced by
      // `scripts/build-client.mjs --check` in npm test.
      'src/**',
    ],
  },
  {
    // Server half: ESM runtime modules and the plugin entrypoint.
    files: ['lib/**/*.js'],
    ignores: ['lib/client.js', 'lib/client.panels.js', 'lib/client.zh.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    // Client half: generated self-contained bundles loaded by the DSH combo-loader.
    files: ['lib/client.js', 'lib/client.panels.js', 'lib/client.zh.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: browserGlobals,
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    // Test suite: node:test driven, ESM.
    files: ['test/**/*.js', 'test/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    // Build, release and ablation tooling.
    files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    // The config file itself runs under Node ESM.
    files: ['eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      'no-undef': 'error',
    },
  },
]
