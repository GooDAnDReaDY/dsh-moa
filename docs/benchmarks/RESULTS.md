# MoA Ablation Results (#367)

Measured pass-rate / cost / latency of MoA pipeline configurations against the
objectively validated task set (`scripts/ablation/tasks.mjs`). Validators are
fixed `node --test` harnesses written before any model runs — never substring
checks. A candidate passes a task only when the harness exits 0 against the
generated `impl.js`.

## Method

1. **Task set** — `scripts/ablation/tasks.mjs`. Each task = precise prompt +
   fixed behavior-test harness. Current seed set: 12 tasks. The issue targets
   30–50; extend by adding modules with the same `{ id, title, prompt, harness }`
   shape — the guard tests in `test/ablation-tasks.test.mjs` automatically cover
   new tasks (canonical-impl satisfiability + empty-impl rejection).
2. **Configurations** (`scripts/ablation/run-ablation.mjs`):
   - `baseline-single` — one model answers directly;
   - `moa-2-judge` — 2 candidates + judge synthesis;
   - `moa-2-critique` — 2 candidates + peer critique round + judge;
   - `moa-gates-syntax` — 2 candidates + discipline/syntax gate directives + judge.
3. **Metrics** — pass-rate, total tokens, cost USD (from provider usage or
   `--price-in/--price-out` per million), latency p50/p95.
4. **Validator discriminability guard** — `npm test` runs both directions for
   every task: canonical correct implementations (scripts/ablation/canonical-impls.mjs)
   must pass, empty implementations must fail. Harness drift blocks CI instead of
   skewing a measurement.

## How to run (requires owner-provided model key — paid operation)

```bash
export OPENROUTER_API_KEY=...
node scripts/ablation/run-ablation.mjs --model <provider>/<model> \
  [--configs baseline-single,moa-2-judge,moa-2-critique,moa-gates-syntax] \
  [--price-in 0.15 --price-out 0.60] \
  [--notes "cycle 2 run 1"]
```

Each run appends a section below and writes raw measurements to
`docs/benchmarks/results/<timestamp>.json`.

## Decision rule (from the issue)

A gate that shows no measurable pass-rate gain at acceptable cost is switched
off by default or removed; the surviving composition feeds profile `fast` /
`balanced` / `deep` in #368.

## Results

_Pending: no measurement has been run yet — the runner requires a paid model
API key and budget (owner inputs, see Gitea issue #367). The infrastructure,
validators and discriminability guards are in place and proven._
