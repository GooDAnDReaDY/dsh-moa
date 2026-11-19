/**
 * Ablation task set for dsh-moa quality measurement (#367).
 *
 * Every task is a self-contained specification: the model receives `prompt`
 * and must answer with a single JavaScript code block implementing
 * `impl.js`. The `harness` field is a FIXED node:test file written before
 * any model runs - it is the objective validator. A candidate passes only
 * when `node --test` exits 0 against its generated `impl.js`.
 *
 * Validators are behavior tests, never substring checks: an answer that
 * merely mentions the right words without implementing the behavior fails.
 *
 * Task contract:
 *   { id, title, prompt, harness }
 *
 * Extend this set towards 30-50 tasks by adding modules with the same shape;
 * each addition only needs a precise prompt and a strict harness.
 */

const OUTPUT_CONTRACT = [
  'Answer with exactly one fenced JavaScript code block.',
  'The block must be a complete CommonJS module for a file named impl.js.',
  'Export every function the task asks for via module.exports.',
  'No commentary outside the code block.',
].join(' ')

function task(id, title, prompt, harness) {
  return { id, title, prompt: `${prompt}\n\n${OUTPUT_CONTRACT}`, harness }
}

export const TASKS = [
  task(
    'clamp-robust',
    'Implement clamp(value, min, max)',
    `Implement a function clamp(value, min, max):
- returns value limited to the [min, max] range;
- if min is greater than max, the bounds are swapped before clamping;
- non-numeric input returns 0;
- NaN bounds are treated as absent (no bound on that side).`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { clamp } from './impl.js'

test('clamps within range', () => {
  assert.equal(clamp(5, 1, 10), 5)
  assert.equal(clamp(-3, 1, 10), 1)
  assert.equal(clamp(42, 1, 10), 10)
})
test('swaps inverted bounds', () => {
  assert.equal(clamp(5, 10, 1), 5)
  assert.equal(clamp(0, 10, 1), 1)
  assert.equal(clamp(11, 10, 1), 10)
})
test('non-numeric input returns 0', () => {
  assert.equal(clamp('x', 1, 10), 0)
  assert.equal(clamp(null, 1, 10), 0)
})
test('NaN bound means unbounded side', () => {
  assert.equal(clamp(50, NaN, 10), 10)
  assert.equal(clamp(-50, 1, NaN), 1)
})`
  ),

  task(
    'deep-get',
    'Implement deepGet(obj, path)',
    `Implement deepGet(obj, path):
- path is a string with dot-separated keys, e.g. 'a.b.0.c' (array indexes as numeric segments);
- returns the value at the path, or the provided fallback (third argument, default undefined) when any segment is missing;
- null/undefined obj returns the fallback;
- a path segment must NOT match inherited properties (use own properties only).`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { deepGet } from './impl.js'

const obj = { a: { b: [{ c: 7 }] }, x: 1 }

test('resolves nested paths including array indexes', () => {
  assert.equal(deepGet(obj, 'a.b.0.c'), 7)
  assert.equal(deepGet(obj, 'x'), 1)
  assert.equal(deepGet(obj, 'a.b'), obj.a.b)
})
test('missing segments return fallback', () => {
  assert.equal(deepGet(obj, 'a.z'), undefined)
  assert.equal(deepGet(obj, 'a.z', 'FALLBACK'), 'FALLBACK')
  assert.equal(deepGet(obj, 'a.b.5', 'FALLBACK'), 'FALLBACK')
})
test('null/undefined obj returns fallback', () => {
  assert.equal(deepGet(null, 'a.b', 'FALLBACK'), 'FALLBACK')
  assert.equal(deepGet(undefined, 'a', 'FALLBACK'), 'FALLBACK')
})
test('does not match inherited properties', () => {
  const child = Object.create({ inherited: 'yes' })
  assert.equal(deepGet(child, 'inherited', 'FALLBACK'), 'FALLBACK')
})`
  ),

  task(
    'roman-numerals',
    'Implement toRoman(n) and fromRoman(s)',
    `Implement Roman numeral conversion:
- toRoman(n): 1..3999 to a Roman numeral string (subtractive notation: IV, IX, XL, XC, CD, CM);
- fromRoman(s): parse a Roman numeral (case-insensitive) back to a number; invalid input returns 0;
- round trip must hold for the whole range.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { toRoman, fromRoman } from './impl.js'

test('basic values', () => {
  assert.equal(toRoman(1), 'I')
  assert.equal(toRoman(4), 'IV')
  assert.equal(toRoman(9), 'IX')
  assert.equal(toRoman(14), 'XIV')
  assert.equal(toRoman(40), 'XL')
  assert.equal(toRoman(90), 'XC')
  assert.equal(toRoman(400), 'CD')
  assert.equal(toRoman(900), 'CM')
  assert.equal(toRoman(1994), 'MCMXCIV')
  assert.equal(toRoman(3999), 'MMMCMXCIX')
})
test('parse back', () => {
  assert.equal(fromRoman('mcmxciv'), 1994)
  assert.equal(fromRoman('MMMCMXCIX'), 3999)
  assert.equal(fromRoman('ix'), 9)
})
test('invalid input returns 0', () => {
  assert.equal(fromRoman('IVX'), 0)
  assert.equal(fromRoman('abc'), 0)
  assert.equal(fromRoman(''), 0)
})
test('round trip for a sample sweep', () => {
  for (let n = 1; n <= 400; n++) {
    assert.equal(fromRoman(toRoman(n)), n, 'round trip failed at ' + n)
  }
})`
  ),

  task(
    'balanced-brackets',
    'Implement isBalanced(s)',
    `Implement isBalanced(s) for bracket pairs (), [], {}:
- returns true when every opened bracket is closed in the correct order;
- other characters are ignored;
- empty string is balanced.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { isBalanced } from './impl.js'

test('balanced inputs', () => {
  assert.equal(isBalanced(''), true)
  assert.equal(isBalanced('()'), true)
  assert.equal(isBalanced('([{}])'), true)
  assert.equal(isBalanced('a(b)c[d]e{f}g'), true)
  assert.equal(isBalanced('fun(x => (y[0] + {z: 1}))'), true)
})
test('unbalanced inputs', () => {
  assert.equal(isBalanced('('), false)
  assert.equal(isBalanced(')('), false)
  assert.equal(isBalanced('([)]'), false)
  assert.equal(isBalanced('{[}]'), false)
  assert.equal(isBalanced('(()'), false)
})`
  ),

  task(
    'group-by',
    'Implement groupBy(items, keyFn)',
    `Implement groupBy(items, keyFn):
- returns a plain object mapping each keyFn result to the array of items producing it;
- preserves the original order inside each group;
- never returns a prototype-polluted object: keys like 'constructor', '__proto__', 'toString' must be own properties of a null-prototype-free plain object created safely (e.g. via Object.create(null) is NOT acceptable if a caller does {...spread} — use Object.defineProperty or a Map->object conversion that still yields a plain object with safe own keys).`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { groupBy } from './impl.js'

test('groups by key with preserved order', () => {
  const items = [
    { t: 'a', n: 1 }, { t: 'b', n: 2 }, { t: 'a', n: 3 },
  ]
  const g = groupBy(items, (x) => x.t)
  assert.deepEqual(g.a.map((x) => x.n), [1, 3])
  assert.deepEqual(g.b.map((x) => x.n), [2])
})
test('empty input yields empty object', () => {
  assert.deepEqual(groupBy([], (x) => x), {})
})
test('no prototype pollution via keys', () => {
  const g = groupBy([1, 2], (x) => (x === 1 ? '__proto__' : 'constructor'))
  assert.equal(Object.keys(g).length, 2)
  assert.deepEqual(g['__proto__'], [1])
  assert.deepEqual(g['constructor'], [2])
})`
  ),

  task(
    'merge-intervals',
    'Implement mergeIntervals(intervals)',
    `Implement mergeIntervals(intervals):
- input is an array of [start, end] pairs (integers, start <= end);
- returns a new array where all overlapping or touching intervals are merged, sorted by start;
- must not mutate the input;
- empty input returns [].`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeIntervals } from './impl.js'

test('merges overlaps and sorts', () => {
  assert.deepEqual(mergeIntervals([[5, 7], [1, 3], [2, 4]]), [[1, 4], [5, 7]])
  assert.deepEqual(mergeIntervals([[1, 2], [3, 4]]), [[1, 2], [3, 4]])
  assert.deepEqual(mergeIntervals([[1, 10], [2, 3], [4, 5]]), [[1, 10]])
})
test('touching intervals merge', () => {
  assert.deepEqual(mergeIntervals([[1, 2], [2, 3]]), [[1, 3]])
})
test('input is not mutated; empty returns []', () => {
  const input = [[2, 3], [1, 2]]
  const copy = JSON.parse(JSON.stringify(input))
  const out = mergeIntervals(input)
  assert.deepEqual(input, copy)
  assert.deepEqual(out, [[1, 3]])
  assert.deepEqual(mergeIntervals([]), [])
})`
  ),

  task(
    'word-frequency',
    'Implement topWords(text, n)',
    `Implement topWords(text, n):
- tokenizes text into lowercase words (letters, digits and apostrophes inside words count; everything else separates);
- returns the top n [word, count] pairs sorted by count desc, ties in first-appearance order;
- n <= 0 returns [];
- words shorter than 2 characters are ignored.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { topWords } from './impl.js'

test('counts and orders by frequency', () => {
  const out = topWords('The cat and the DOG and the cat', 2)
  assert.deepEqual(out, [['the', 3], ['cat', 2]])
})
test('ties keep first-appearance order', () => {
  const out = topWords('bb aa cc aa bb', 3)
  assert.deepEqual(out.map(([w]) => w), ['bb', 'aa', 'cc'])
})
test('short words and punctuation', () => {
  const out = topWords("don't a I it is don't", 5)
  assert.deepEqual(out, [["don't", 2], ["it", 1], ["is", 1]])
})
test('edge cases', () => {
  assert.deepEqual(topWords('', 3), [])
  assert.deepEqual(topWords('word', 0), [])
})`
  ),

  task(
    'async-debounce',
    'Implement debounce(fn, waitMs)',
    `Implement debounce(fn, waitMs) using setTimeout/clearTimeout (no external deps):
- returns a wrapped function; calls are delayed by waitMs and coalesced: only the last call in a burst executes;
- the wrapped function has .cancel() to drop a pending call;
- arguments of the LAST call are used;
- inside fn, 'this' must be the receiver of the wrapped call.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { debounce } from './impl.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('coalesces a burst into one execution with the last args', async () => {
  let calls = []
  const d = debounce((a, b) => calls.push([a, b]), 40)
  d(1, 'x'); d(2, 'y'); d(3, 'z')
  await sleep(90)
  assert.deepEqual(calls, [[3, 'z']])
})
test('cancel drops pending call', async () => {
  let n = 0
  const d = debounce(() => n++, 30)
  d(); d.cancel(); d()
  await sleep(70)
  assert.equal(n, 1)
})
test('preserves this binding', async () => {
  let seen = null
  const obj = { tag: 'ctx-tag', mark: debounce(function () { seen = this.tag }, 20) }
  obj.mark()
  await sleep(60)
  assert.equal(seen, 'ctx-tag')
})`
  ),

  task(
    'lru-cache',
    'Implement LRUCache class (capacity)',
    `Implement class LRUCache with constructor(capacity) and methods:
- get(key): value or null; marks the key as most-recently-used;
- set(key, value): inserts/updates; marks as MRU; evicts the least-recently-used entry when over capacity;
- has(key): boolean without changing recency;
- capacity >= 1; evicting on a cache of capacity 1 keeps only the latest key.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { LRUCache } from './impl.js'

test('basic get/set and eviction', () => {
  const c = new LRUCache(2)
  c.set('a', 1); c.set('b', 2)
  assert.equal(c.get('a'), 1)
  c.set('c', 3) // evicts b (a was refreshed)
  assert.equal(c.get('b'), null)
  assert.equal(c.get('a'), 1)
  assert.equal(c.get('c'), 3)
})
test('has does not change recency', () => {
  const c = new LRUCache(2)
  c.set('a', 1); c.set('b', 2)
  assert.equal(c.has('a'), true) // a touched only via has
  c.set('c', 3) // evicts a
  assert.equal(c.has('a'), false)
  assert.equal(c.get('b'), 2)
})
test('capacity 1 keeps latest only', () => {
  const c = new LRUCache(1)
  c.set('a', 1); c.set('b', 2)
  assert.equal(c.get('a'), null)
  assert.equal(c.get('b'), 2)
})`
  ),

  task(
    'csv-line-parse',
    'Implement parseCsvLine(line)',
    `Implement parseCsvLine(line) for RFC-4180-style single lines:
- splits on commas; quoted fields ("...") may contain commas and escaped double quotes ("");
- trims spaces around unquoted fields; does NOT trim inside quoted fields;
- unterminated quote: parse until end of line;
- empty line returns [''].`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsvLine } from './impl.js'

test('plain fields with trimming', () => {
  assert.deepEqual(parseCsvLine('a, b ,c'), ['a', 'b', 'c'])
})
test('quoted fields keep commas and inner quotes', () => {
  assert.deepEqual(parseCsvLine('x,"a,b ""q""",z'), ['x', 'a,b "q"', 'z'])
  assert.deepEqual(parseCsvLine('" leading space"'), [' leading space'])
})
test('unterminated quote parses to EOL', () => {
  assert.deepEqual(parseCsvLine('a,"bc'), ['a', 'bc'])
})
test('empty line', () => {
  assert.deepEqual(parseCsvLine(''), [''])
})`
  ),

  task(
    'binary-search-insert',
    'Implement bisectIndex(sortedArr, target)',
    `Implement bisectIndex(sortedArr, target):
- sortedArr is an ascending array of numbers;
- returns the index where target should be inserted to keep the order (leftmost position among equals);
- must run in O(log n) (binary search, not linear scan);
- empty array returns 0.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { bisectIndex } from './impl.js'

test('insert positions', () => {
  assert.equal(bisectIndex([1, 3, 5], 0), 0)
  assert.equal(bisectIndex([1, 3, 5], 2), 1)
  assert.equal(bisectIndex([1, 3, 5], 4), 2)
  assert.equal(bisectIndex([1, 3, 5], 6), 3)
})
test('leftmost among equals', () => {
  assert.equal(bisectIndex([1, 3, 3, 3, 5], 3), 1)
})
test('empty array and O(log n) spot check', () => {
  assert.equal(bisectIndex([], 7), 0)
  const big = Array.from({ length: 300000 }, (_, i) => i * 2)
  assert.equal(bisectIndex(big, 500001), 250001)
})`
  ),

  task(
    'retry-with-backoff',
    'Implement retry(fn, attempts, baseDelayMs)',
    `Implement async retry(fn, attempts, baseDelayMs):
- fn is an async function; retry calls it up to 'attempts' times;
- resolves with the first successful result;
- delay before retry i (0-based) is baseDelayMs * 2^i;
- when all attempts fail, rejects with the LAST error;
- attempts < 1 rejects immediately without calling fn.`,
    `import test from 'node:test'
import assert from 'node:assert/strict'
import { retry } from './impl.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('resolves on first success', async () => {
  let n = 0
  const out = await retry(async () => { n++; return 'ok' }, 3, 1)
  assert.equal(out, 'ok'); assert.equal(n, 1)
})
test('retries with exponential backoff then succeeds', async () => {
  let n = 0
  const t0 = Date.now()
  const out = await retry(async () => { n++; if (n < 3) throw new Error('fail ' + n); return 'done' }, 5, 10)
  const elapsed = Date.now() - t0
  assert.equal(out, 'done'); assert.equal(n, 3)
  assert.ok(elapsed >= 25, 'expected backoff delays (>=25ms), got ' + elapsed)
})
test('rejects with last error after all attempts', async () => {
  let n = 0
  await assert.rejects(
    retry(async () => { n++; throw new Error('boom ' + n) }, 3, 1),
    (e) => e.message === 'boom 3' && n === 3,
  )
})
test('attempts < 1 rejects without calling fn', async () => {
  let n = 0
  await assert.rejects(retry(async () => { n++ }, 0, 1))
  assert.equal(n, 0)
})`
  ),
]

export function getTasks(ids) {
  if (!ids || ids.length === 0) return TASKS
  const known = new Map(TASKS.map((t) => [t.id, t]))
  const picked = ids.map((id) => {
    const t = known.get(id)
    if (!t) throw new Error(`Unknown task id: ${id}. Known: ${TASKS.map((x) => x.id).join(', ')}`)
    return t
  })
  return picked
}
