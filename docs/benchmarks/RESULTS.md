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
## Run 2026-11-19T19:45:36.924Z — model `deepseek-chat`

> cycle 2: DeepSeek V3 (deepseek-chat), cost ~$0.10-0.15 approved

| Configuration | Tasks | Pass-rate | Tokens | Cost USD | Latency p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `baseline-single` — Single model answers directly (baseline) | 12 | 100.0% | 4068 | n/a | 1144 | 1764 |

_Raw measurements: docs/benchmarks/results/run-2026-11-19T19-45-20.json_

## Run 2026-11-19T19:46:27.741Z — model `deepseek-chat`

> cycle 2: DeepSeek V3 (deepseek-chat), cost ~$0.10-0.15 approved

| Configuration | Tasks | Pass-rate | Tokens | Cost USD | Latency p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `moa-2-judge` — 2 candidates + judge synthesis | 12 | 100.0% | 7916 | n/a | 2511 | 3378 |

_Raw measurements: docs/benchmarks/results/run-2026-11-19T19-45-41.json_

## Run 2026-11-19T19:47:49.784Z — model `deepseek-chat`

> cycle 2: DeepSeek V3 (deepseek-chat), cost ~$0.10-0.15 approved

| Configuration | Tasks | Pass-rate | Tokens | Cost USD | Latency p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `moa-2-critique` — 2 candidates + peer critique round + judge synthesis | 12 | 91.7% | 8066 | n/a | 2385 | 4186 |

_Raw measurements: docs/benchmarks/results/run-2026-11-19T19-46-32.json_

## Run 2026-11-19T19:48:44.239Z — model `deepseek-chat`

> cycle 2: DeepSeek V3 (deepseek-chat), cost ~$0.10-0.15 approved

| Configuration | Tasks | Pass-rate | Tokens | Cost USD | Latency p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `moa-gates-syntax` — 2 candidates + syntax/discipline gate directives + judge synthesis | 12 | 100.0% | 10567 | n/a | 2532 | 4648 |

_Raw measurements: docs/benchmarks/results/run-2026-11-19T19-47-54.json_


### Cycle 2 measurement (2026-11-19, DeepSeek V3 `deepseek-chat`, 12/12 tasks × 4 configs, 144 calls, ~$0.14)

| Configuration | Pass-rate | Tokens/task | Latency p50 | p95 | Вывод |
|---|---:|---:|---:|---:|---|
| `baseline-single` | **100.0%** | 339 | 1.1 s | 1.8 s | сильная модель решает seed-набор сама |
| `moa-2-judge` | **100.0%** | 660 | 2.5 s | 3.4 s | +94% токенов, +130% латентности, pass-rate тот же |
| `moa-2-critique` | **91.7%** | 672 | 2.4 s | 4.2 s | **регрессия**: критик сломал корректный `csv-line-parse` |
| `moa-gates-syntax` | **100.0%** | 880 | 2.5 s | 4.6 s | гейт-директивы безвредны, но дорого за тот же результат |

**Принятые решения (по правилу «гейт без прироста выключается по умолчанию»):**
1. Peer critique по умолчанию **выключен** в профиле `balanced` — на сильных моделях для компактных задач он снижает pass-rate (критик-индуцированная регрессия `csv-line-parse`).
2. Профиль `fast` = 1 кандидат + судья, без критики и гейтов — для сильных моделей pass-rate не хуже, цена минимальна.
3. Профиль `balanced` = 2 кандидата + судья (+100% токенов за рост устойчивости на слабых/средних моделях и диверсификацию подходов; на seed-наборе не хуже baseline).
4. Профиль `deep` = полный набор гейтов + multi-judge — для сложных многофайловых задач, где baseline недостаточен (вне покрытия seed-набора); критика и тяжёлые гейты — opt-in флагами.
5. Ограничение замера честно зафиксировано: seed-набор — компактные одиночные задачи; вывод «MoA не добавляет pass-rate» применим к этому классу, для многофайловых реальных задач (#367 план) нужен расширенный набор.
## Run 2026-11-27T10:49:21.208Z — model `deepseek-chat`

> issue #387 AC: guarded critique on the seed set (compare: unguarded critique regressed to 91.7% in cycle 2)

| Configuration | Tasks | Pass-rate | Tokens | Cost USD | Latency p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `moa-2-critique-guarded` — 2 candidates + guarded critique (#387): refined variants compete, originals preserved | 12 | 100.0% | 8301 | n/a | 2398 | 3166 |

_Raw measurements: docs/benchmarks/results/run-2026-11-27T10-48-05.json_


### Guarded critique verification (#387, 2026-11-27, DeepSeek V3, 12 tasks)

| Configuration | Pass-rate | Tokens/task | Вывод |
|---|---:|---:|---|
| `moa-2-critique` (unguarded, cycle 2) | 91.7% | 672 | критик сломал корректное решение |
| `moa-2-critique-guarded` (#387: refined variants compete) | **100.0%** | 692 | **регрессия устранена**, цена почти та же |

Вывод: предохранитель «оригинал никогда не теряется, исправление конкурирует» возвращает pass-rate критики к baseline при сопоставимой цене. Критику можно включать безопасно.
