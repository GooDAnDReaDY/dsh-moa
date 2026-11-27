/**
 * Multi-file ablation tasks from REAL dsh-moa project history (#388).
 *
 * Each task reproduces a real defect fixed in this repository (issues
 * #363/#364/#365/#369/#370/#387/#389): the candidate receives the buggy
 * context files and must submit fixed file blocks; the harness validates the
 * fixed behavior with node --test. The validator is behavior, never prose.
 *
 * Task shape: { id, origin, title, contextFiles: {path: content},
 * prompt, harness } - the candidate answers with fenced file blocks
 * (`file="path"`); missing files fail the harness.
 */

const OUTPUT_CONTRACT = [
  'Answer with fenced JavaScript code blocks, one per changed file, each tagged file="path".',
  'Only files that must change need to be submitted; their content must be complete and runnable.',
  'No commentary outside the code blocks.',
].join(' ')

function task(id, origin, title, contextFiles, prompt, harness) {
  return { id, origin, title, contextFiles, prompt: `${prompt}\n\n${OUTPUT_CONTRACT}`, harness }
}

export const TASKS_MULTIFILE = [
  task(
    'mf-posix-path-normalize',
    'issue #363: parseFileScores broke on Windows (path.normalize produced backslashes)',
    'Issue #363: candidate file paths from the judge are POSIX (src/auth.ts); the normalize function below used the platform-specific path module.',
    {
      'lib/paths.js': `import path from 'node:path'

export function normalizeRelativePath(relPath) {
  if (!relPath || typeof relPath !== 'string') return ''
  return path.normalize(relPath.trim()).replace(/^(\\\\.\\/)+/, '').replace(/^\\/+/, '')
}`,
    },
    `Fix normalizeRelativePath in lib/paths.js: it must return the canonical POSIX form of a workspace-relative path on ANY platform:
- backslashes become forward slashes;
- redundant segments are removed (./, duplicate slashes);
- leading ./ and / are stripped;
- invalid input returns ''.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRelativePath } from './lib/paths.js'

test('windows separators collapse to posix', () => {
  assert.equal(normalizeRelativePath('src\\\\auth.ts'), 'src/auth.ts')
})
test('redundant segments and leading slashes are stripped', () => {
  assert.equal(normalizeRelativePath('./src//auth.ts'), 'src/auth.ts')
  assert.equal(normalizeRelativePath('/src/auth.ts'), 'src/auth.ts')
})
test('invalid input', () => {
  assert.equal(normalizeRelativePath(''), '')
  assert.equal(normalizeRelativePath(null), '')
})`,
  ),

  task(
    'mf-route-literal-classify',
    'issue #364: POSIX route literals were treated as host path leaks on Windows',
    'Issue #364: the scanner below treats any path.isAbsolute(token) as a host filesystem path, so HTTP route literals like /health were flagged as leaks on Windows.',
    {
      'lib/hostpath.js': `import path from 'node:path'

export const UNIX_ROOT_PREFIX = /^\\/(?:home|root|etc|var|tmp|opt|mnt|srv|media|proc|sys|dev|usr|bin|lib|lib64|sbin|boot)(?:\\/|$)/

export function isHostAbsolutePath(token) {
  if (!token || typeof token !== 'string') return false
  return path.isAbsolute(token)
}`,
    },
    `Fix isHostAbsolutePath in lib/hostpath.js: a token is a host filesystem path only when
- it is a Windows drive path (^[a-zA-Z]:[\\\\/]), or
- it is a POSIX path rooted at a known system directory (UNIX_ROOT_PREFIX).
A bare leading slash (an HTTP route literal like /health or /users/me) is NOT a host filesystem path.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { isHostAbsolutePath } from './lib/hostpath.js'

test('windows drive paths are host paths', () => {
  assert.equal(isHostAbsolutePath('C:\\\\Users\\\\v\\\\x.txt'), true)
})
test('posix system roots are host paths', () => {
  assert.equal(isHostAbsolutePath('/etc/passwd'), true)
  assert.equal(isHostAbsolutePath('/home/user/.ssh/id_rsa'), true)
})
test('route literals are not host paths', () => {
  assert.equal(isHostAbsolutePath('/health'), false)
  assert.equal(isHostAbsolutePath('/users/me'), false)
  assert.equal(isHostAbsolutePath('/api/v1/runs'), false)
})
test('relative paths are not host paths', () => {
  assert.equal(isHostAbsolutePath('src/auth.ts'), false)
  assert.equal(isHostAbsolutePath(''), false)
})`,
  ),

  task(
    'mf-account-files-guard',
    'issue #364 (AC gap): /etc/passwd passed the SAFE_SYS_DIRS whitelist',
    'Issue #364 acceptance gap: the scanner below whitelists safe system directories unconditionally, so account files like /etc/passwd and /etc/shadow passed without scrutiny.',
    {
      'lib/scanner.js': `export const SAFE_SYS_DIRS = /^\\/(?:usr\\/(?:bin|lib|include)|bin|lib|lib64|etc|dev)(?:\\/|$)/
export const SENSITIVE_EXTS = /\\.(?:txt|json|env|npmrc|key|ssh|md)/i

export function isAllowedSystemPath(raw) {
  if (SAFE_SYS_DIRS.test(raw) && !SENSITIVE_EXTS.test(raw)) return true
  return false
}`,
    },
    `Fix isAllowedSystemPath in lib/scanner.js: well-known Unix account and credential files (/etc/passwd, /etc/shadow, /etc/group, /etc/gshadow, /etc/sudoers) must NOT pass the safe-dirs whitelist even without a sensitive extension. Non-sensitive safe system dirs (e.g. /usr/bin/node) remain allowed.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedSystemPath } from './lib/scanner.js'

test('account files never pass the whitelist', () => {
  for (const p of ['/etc/passwd', '/etc/shadow', '/etc/group', '/etc/gshadow', '/etc/sudoers']) {
    assert.equal(isAllowedSystemPath(p), false, p)
  }
})
test('non-sensitive safe system dirs remain allowed', () => {
  assert.equal(isAllowedSystemPath('/usr/bin/node'), true)
  assert.equal(isAllowedSystemPath('/bin/sh'), true)
})
test('sensitive extensions still blocked', () => {
  assert.equal(isAllowedSystemPath('/etc/nginx/nginx.conf.txt'), false)
})`,
  ),

  task(
    'mf-schema-key-strip',
    'issue #365: legacy top-level config keys broke settings persistence',
    'Issue #365: the host rejects a settings replace when the payload contains keys that are not declared by the current schema. Legacy profiles still store old top-level flags that must be stripped.',
    {
      'lib/config-keys.js': `export const SCHEMA_FIELDS = new Set([
  'enabled', 'default_preset', 'smart_routing_enabled', 'smart_routing_model',
  'prices', 'presets', 'pr_review_bot_enabled', 'pr_review_gitea_token',
  'pr_review_webhook_secret', 'pr_review_strict_blocking', 'pr_review_allowed_repos',
  'enable_ecosystem_context', 'sync_with_memory_brain',
])

export function sanitizeToSchemaKeys(plain) {
  if (!plain || typeof plain !== 'object' || Array.isArray(plain)) return plain
  return { ...plain }
}`,
    },
    `Fix sanitizeToSchemaKeys in lib/config-keys.js: it must return a new object containing ONLY the keys declared in SCHEMA_FIELDS (drop everything else, e.g. legacy test_gate_enabled or interactive_workbench_enabled). Invalid input passes through unchanged.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeToSchemaKeys } from './lib/config-keys.js'

test('strips legacy undeclared keys', () => {
  const clean = sanitizeToSchemaKeys({
    enabled: true,
    default_preset: 'default',
    test_gate_enabled: true,
    interactive_workbench_enabled: true,
    presets: [{ name: 'default' }],
  })
  assert.deepEqual(Object.keys(clean).sort(), ['default_preset', 'enabled', 'presets'])
  assert.equal(clean.enabled, true)
})
test('invalid input passes through', () => {
  assert.equal(sanitizeToSchemaKeys(null), null)
  assert.deepEqual(sanitizeToSchemaKeys(['a']), ['a'])
})`,
  ),

  task(
    'mf-entrypoint-resolution',
    'issue #369: the profiler guessed the entrypoint as the last declared function',
    'Issue #369: the profiler below picks the last user-defined function as the benchmark entrypoint - measurement depended on declaration order, not quality.',
    {
      'lib/entrypoint.js': `export const ENTRY_NAMES = ['main', 'solve', 'run', 'handler', 'benchmark']

export function resolveEntrypoint(declaredNames, options = {}) {
  // BUG: guesses the last declared function
  return declaredNames.length > 0 ? declaredNames[declaredNames.length - 1] : null
}`,
    },
    `Fix resolveEntrypoint in lib/entrypoint.js: resolution is explicit, never guessed. Order:
1. options.entrypointName if it is among declaredNames;
2. the first declared name from ENTRY_NAMES;
3. if exactly one declared name exists, that one;
4. otherwise null (ambiguous or none).`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveEntrypoint } from './lib/entrypoint.js'

test('explicit entrypoint wins', () => {
  assert.equal(resolveEntrypoint(['a1', 'b2'], { entrypointName: 'b2' }), 'b2')
  // explicit name missing among declarations falls through to the single-declaration step
  assert.equal(resolveEntrypoint(['a1'], { entrypointName: 'missing' }), 'a1')
})
test('canonical names outrank order', () => {
  assert.equal(resolveEntrypoint(['alphaSort', 'solve', 'betaScale']), 'solve')
})
test('single declaration is used without canonical name', () => {
  assert.equal(resolveEntrypoint(['fibonacci']), 'fibonacci')
})
test('ambiguous declarations return null', () => {
  assert.equal(resolveEntrypoint(['alphaSort', 'betaScale']), null)
  assert.equal(resolveEntrypoint([]), null)
})`,
  ),

  task(
    'mf-literal-mask',
    'issue #369: mutation testing corrupted string literals and comments',
    'Issue #369: the mutation gate below applies regex replacements to the raw source, so words like true inside string literals or comments were corrupted.',
    {
      'lib/mask.js': `// BUG: returns the source unchanged - mutations hit string literals and comments
export function buildMutableCodeMask(source) {
  return source
}`,
    },
    `Implement buildMutableCodeMask in lib/mask.js: return a copy of the source where the contents of line comments (// ... to end of line), block comments (/* ... */), and string/template literals ('...', "...", \`...\` including \${...} interpolations) are REPLACED BY SPACES of the same total length, so position-based mutation operators outside those regions are unaffected. Escape sequences (\\x) stay inside the masked region. Unterminated literals mask to the end of the source.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMutableCodeMask } from './lib/mask.js'

test('string literals are masked at exact positions', () => {
  const src = 'const label = "true story";\\nconst flag = true;'
  const out = buildMutableCodeMask(src)
  assert.equal(out.length, src.length, 'length preserved')
  assert.equal(out.slice(14, 26), '            ', 'literal body masked')
  assert.ok(out.includes('const flag = true;'), 'code outside literals intact')
})
test('comments are masked', () => {
  const src = '// true story\\nconst ok = true; /* flag === true */'
  const out = buildMutableCodeMask(src)
  assert.ok(!out.includes('true story'), 'line comment masked')
  assert.ok(out.includes('const ok = true;'), 'code intact')
  assert.ok(!out.slice(out.indexOf('/*')).includes('flag === true'), 'block comment masked')
})
test('template literal interpolation masked', () => {
  const src = 'const t = \`a \${x} true branch\`;\\nconst ok = true;'
  const out = buildMutableCodeMask(src)
  assert.ok(out.includes('const ok = true;'))
  assert.ok(!out.includes('true branch'))
})`,
  ),

  task(
    'mf-directive-budget',
    'issue #370: gate directives accumulated without any budget cap',
    'Issue #370: the judge prompt accumulated gate directives without limit. Implement the budget policy that shipped.',
    {
      'lib/budget.js': `export function computeDirectiveBudget(referenceTexts = [], options = {}) {
  // BUG: uncapped - directives accumulated without any limit
  let total = 0
  for (const ref of referenceTexts) total += (typeof ref === 'string' ? ref : ref?.text || '').length
  return Math.round(total * 0.15)
}`,
    },
    `Fix computeDirectiveBudget in lib/budget.js: budget = round(totalChars * fraction), clamped to [minChars, maxChars] (options.fraction = 0.15, minChars = 4000, maxChars = 24000 by default).`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { computeDirectiveBudget } from './lib/budget.js'

test('scales with candidate size and clamps to min', () => {
  assert.equal(computeDirectiveBudget([{ text: 'x'.repeat(10_000) }]), 4000)
})
test('mid-size scales by fraction', () => {
  assert.equal(computeDirectiveBudget([{ text: 'x'.repeat(50_000) }, { text: 'x'.repeat(50_000) }]), 15_000)
})
test('clamps to max', () => {
  assert.equal(computeDirectiveBudget([{ text: 'x'.repeat(1_000_000) }]), 24_000)
})`,
  ),

  task(
    'mf-auto-thresholds',
    'issue #389: profile escalation thresholds',
    'Issue #389: implement the measured escalation thresholds for the auto profile.',
    {
      'lib/autoprofile.js': `// BUG: always escalates to deep
export function profileFromScore(score) {
  return 'deep'
}`,
    },
    `Fix profileFromScore in lib/autoprofile.js: score < 0.35 -> 'fast'; 0.35 <= score <= 0.7 -> 'balanced'; score > 0.7 -> 'deep'. Non-numeric score -> 'balanced'.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { profileFromScore } from './lib/autoprofile.js'

test('threshold table', () => {
  for (const [score, expected] of [[0, 'fast'], [0.34, 'fast'], [0.35, 'balanced'], [0.7, 'balanced'], [0.71, 'deep'], [1, 'deep']]) {
    assert.equal(profileFromScore(score), expected, 'score ' + score)
  }
})
test('non-numeric falls back to balanced', () => {
  assert.equal(profileFromScore(NaN), 'balanced')
})`,
  ),
]

export function getMultifileTasks(ids) {
  if (!ids || ids.length === 0) return TASKS_MULTIFILE
  const known = new Map(TASKS_MULTIFILE.map((t) => [t.id, t]))
  return ids.map((id) => {
    const t = known.get(id)
    if (!t) throw new Error(`Unknown multi-file task id: ${id}. Known: ${TASKS_MULTIFILE.map((x) => x.id).join(', ')}`)
    return t
  })
}
