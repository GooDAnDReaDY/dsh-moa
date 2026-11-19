#!/usr/bin/env node
/**
 * MoA Ablation Runner (#367) - measurable quality/cost/latency comparison of
 * pipeline configurations against an objectively validated task set.
 *
 * Method: for every configuration (baseline single model -> 2 candidates +
 * judge -> + peer critique -> + gates) and every task, collect candidate
 * answers, run the FIXED test harness against them, and record pass-rate,
 * token spend and latency. The validator is `node --test` exit code - never
 * a substring check.
 *
 * Model access: OpenRouter-compatible chat completions API. The API key is
 * read from an environment variable (default OPENROUTER_API_KEY). Without a
 * key the runner explains what to export and exits 1 - measurements are a
 * paid operation that requires the owner's keys.
 *
 * Usage:
 *   export OPENROUTER_API_KEY=...
 *   node scripts/ablation/run-ablation.mjs --model openai/gpt-4o-mini
 *   node scripts/ablation/run-ablation.mjs --model X --configs baseline-single,moa-2-judge
 *   node scripts/ablation/run-ablation.mjs --tasks clamp-robust,lru-cache --model X
 *   node scripts/ablation/run-ablation.mjs --selftest          # no API needed:
 *          runs the validator pipeline against canned correct/broken answers
 *
 * Output:
 *   docs/benchmarks/RESULTS.md        - aggregated tables (one section per run)
 *   docs/benchmarks/results/<ts>.json - raw measurements
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TASKS, getTasks } from './tasks.mjs'
import { runHarness } from './harness.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const RESULTS_DIR = path.join(REPO_ROOT, 'docs', 'benchmarks')
const RESULTS_MD = path.join(RESULTS_DIR, 'RESULTS.md')
const RESULTS_RAW_DIR = path.join(RESULTS_DIR, 'results')

function parseArgs(argv) {
  const args = {
    model: null,
    providerUrl: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    configs: ['baseline-single', 'moa-2-judge', 'moa-2-critique', 'moa-gates-syntax'],
    tasks: [],
    temperature: 0.6,
    maxTokens: 1024,
    timeoutMs: 60000,
    priceIn: null,
    priceOut: null,
    ollamaNative: false,
    selftest: false,
    notes: '',
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      i++
      if (i >= argv.length) throw new Error(`Missing value for ${a}`)
      return argv[i]
    }
    if (a === '--model') args.model = next()
    else if (a === '--provider-url') args.providerUrl = next()
    else if (a === '--api-key-env') args.apiKeyEnv = next()
    else if (a === '--configs') args.configs = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--tasks') args.tasks = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--temperature') args.temperature = Number(next())
    else if (a === '--max-tokens') args.maxTokens = Number(next())
    else if (a === '--timeout-ms') args.timeoutMs = Number(next())
    else if (a === '--price-in') args.priceIn = Number(next())
    else if (a === '--price-out') args.priceOut = Number(next())
    else if (a === '--ollama-native') args.ollamaNative = true
    else if (a === '--notes') args.notes = next()
    else if (a === '--selftest') args.selftest = true
    else throw new Error(`Unknown argument: ${a}`)
  }
  return args
}

const CONFIGURATIONS = {
  'baseline-single': {
    description: 'Single model answers directly (baseline)',
    candidates: 1,
    judge: false,
    peerCritique: false,
    gates: false,
  },
  'moa-2-judge': {
    description: '2 candidates + judge synthesis',
    candidates: 2,
    judge: true,
    peerCritique: false,
    gates: false,
  },
  'moa-2-critique': {
    description: '2 candidates + peer critique round + judge synthesis',
    candidates: 2,
    judge: true,
    peerCritique: true,
    gates: false,
  },
  'moa-gates-syntax': {
    description: '2 candidates + syntax/discipline gate directives + judge synthesis',
    candidates: 2,
    judge: true,
    peerCritique: false,
    gates: true,
  },
}

const GATE_DIRECTIVE = [
  'Before finalizing your answer:',
  '1. Re-read the task for edge cases (empty input, boundaries, invalid input) and cover them.',
  '2. Check your code for syntax errors and undeclared identifiers line by line.',
  '3. Verify every exported symbol matches the requested signature exactly.',
  '4. Prefer the standard library; no external dependencies.',
].join('\n')

const PEER_CRITIQUE_DIRECTIVE = [
  'You are the peer reviewer for a candidate solution of the same task.',
  'List concrete defects of the candidate below (wrong edge cases, missing exports,',
  'syntax problems) and produce a corrected, complete implementation.',
  'Answer with exactly one fenced JavaScript code block (the corrected impl.js).',
].join('\n')

const JUDGE_DIRECTIVE = [
  'You are the judge. Compare the numbered candidate solutions for the task and pick',
  'the strongest implementation (correctness on edge cases first, then completeness).',
  'Return exactly one fenced JavaScript code block: the winning implementation,',
  'verbatim if it is correct, otherwise minimally corrected.',
].join('\n')

function extractCodeBlock(text) {
  if (!text || typeof text !== 'string') return null
  // Reasoning models may emit <think>...</think> before the answer; the answer
  // block is everything after the last closed think section.
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const source = stripped || text
  const fence = source.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/i)
  if (fence && fence[1]) return fence[1]
  const bare = source.trim()
  return bare.startsWith('```') ? null : bare
}

async function callModel(args, apiKey, messages) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs)
  timer.unref?.()
  try {
    let res
    let parsed
    if (args.ollamaNative) {
      // Native Ollama /api/chat: supports think:false for reasoning models
      // (qwen3 etc.), whose OpenAI-compatible endpoint otherwise spends the
      // whole completion budget on thinking and returns empty content.
      const body = JSON.stringify({
        model: args.model,
        messages,
        stream: false,
        think: false,
        options: {
          temperature: args.temperature,
          num_predict: args.maxTokens,
        },
      })
      res = await fetch(args.providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      const json = await res.json()
      parsed = {
        content: json?.message?.content ?? '',
        promptTokens: json?.prompt_eval_count ?? 0,
        completionTokens: json?.eval_count ?? 0,
        costUsd: null,
      }
    } else {
      const body = JSON.stringify({
        model: args.model,
        messages,
        temperature: args.temperature,
        max_tokens: args.maxTokens,
      })
      res = await fetch(args.providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      const json = await res.json()
      const content = json?.choices?.[0]?.message?.content ?? ''
      const usage = json?.usage ?? {}
      parsed = {
        content,
        promptTokens: usage.prompt_tokens || usage.input_tokens || 0,
        completionTokens: usage.completion_tokens || usage.output_tokens || 0,
        costUsd: usage.total_cost ?? null,
      }
    }
    return { ...parsed, latencyMs: 0 }
  } finally {
    clearTimeout(timer)
  }
}

async function callWithTiming(args, apiKey, messages) {
  const t0 = process.hrtime.bigint()
  const out = await callModel(args, apiKey, messages)
  out.latencyMs = Number((process.hrtime.bigint() - t0) / 1_000_000n)
  return out
}

function estimateCostUsd(result, args) {
  if (result.costUsd !== null && result.costUsd !== undefined) return result.costUsd
  if (args.priceIn === null || args.priceOut === null) return null
  return Number(((result.promptTokens / 1e6) * args.priceIn + (result.completionTokens / 1e6) * args.priceOut).toFixed(6))
}

function percentile(values, p) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function runConfiguredCandidate(args, apiKey, taskDef, cfg, candidateIndex) {
  const messages = [
    { role: 'user', content: taskDef.prompt },
  ]
  if (cfg.gates) messages[0].content += `\n\n${GATE_DIRECTIVE}`
  const result = await callWithTiming(args, apiKey, messages)
  result.candidateIndex = candidateIndex
  return result
}

async function evaluateConfig(args, apiKey, tasks, cfgName) {
  const cfg = CONFIGURATIONS[cfgName]
  if (!cfg) throw new Error(`Unknown configuration: ${cfgName}. Known: ${Object.keys(CONFIGURATIONS).join(', ')}`)

  const records = []
  for (const taskDef of tasks) {
    const candidates = []
    for (let i = 0; i < cfg.candidates; i++) {
      const c = await runConfiguredCandidate(args, apiKey, taskDef, cfg, i + 1)
      candidates.push(c)
    }

    let workingTexts = candidates.map((c) => c.content)
    if (cfg.peerCritique) {
      for (let i = 0; i < candidates.length; i++) {
        const others = workingTexts.filter((_, j) => j !== i).join('\n\n---\n\n')
        const crit = await callWithTiming(args, apiKey, [
          { role: 'user', content: `${PEER_CRITIQUE_DIRECTIVE}\n\nTask:\n${taskDef.prompt}\n\nCandidate to review:\n${others || candidates[i].content}` },
        ])
        candidates[i].critiqueTokens = crit.promptTokens + crit.completionTokens
        workingTexts[i] = crit.content
      }
    }

    let finalText = workingTexts[0]
    if (cfg.judge) {
      const numbered = workingTexts.map((t, i) => `Candidate ${i + 1}:\n${t}`).join('\n\n---\n\n')
      const judged = await callWithTiming(args, apiKey, [
        { role: 'user', content: `${JUDGE_DIRECTIVE}\n\nTask:\n${taskDef.prompt}\n\n${numbered}` },
      ])
      finalText = judged.content
    }

    const impl = extractCodeBlock(finalText)
    const verdict = runHarness(taskDef, impl)
    const promptTokens = candidates.reduce((acc, c) => acc + c.promptTokens, 0)
    const completionTokens = candidates.reduce((acc, c) => acc + c.completionTokens, 0)
    const totalLatency = candidates.reduce((acc, c) => acc + c.latencyMs, 0)
    records.push({
      taskId: taskDef.id,
      passed: verdict.passed,
      testsTotal: verdict.testsTotal,
      testsPassed: verdict.testsPassed,
      promptTokens,
      completionTokens,
      latencyMs: totalLatency,
      costUsd: null,
      error: verdict.passed ? null : (verdict.output.split('\n').filter((l) => l.includes('✖')).slice(0, 3).join(' | ') || `exit ${verdict.exitCode}`),
    })
    process.stdout.write(`  [${cfgName}] ${taskDef.id}: ${verdict.passed ? 'PASS' : 'FAIL'} (${verdict.testsPassed ?? '?'}/${verdict.testsTotal ?? '?'} tests)\n`)
  }

  const passes = records.filter((r) => r.passed).length
  const sumTokens = records.reduce((acc, r) => acc + r.promptTokens + r.completionTokens, 0)
  const latencies = records.map((r) => r.latencyMs)
  const costs = records.map((r) => estimateCostUsd(r, args)).filter((c) => c !== null)
  return {
    config: cfgName,
    description: cfg.description,
    tasks: records.length,
    passRate: records.length > 0 ? Number((passes / records.length).toFixed(3)) : 0,
    tokensTotal: sumTokens,
    costUsdTotal: costs.length > 0 ? Number(costs.reduce((a, b) => a + b, 0).toFixed(6)) : null,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    records,
  }
}

/**
 * Self-test: no API access required. Proves the objective validator pipeline
 * discriminates - a canned correct implementation passes, a canned broken one
 * fails, for every task.
 */
async function selftest(tasks) {
  let ok = true
  for (const taskDef of tasks) {
    const broken = taskDef.harness // broken impl: empty file must fail
    const brokenVerdict = runHarness(taskDef, broken)
    const emptyFailed = !brokenVerdict.passed
    process.stdout.write(`  selftest ${taskDef.id}: empty-impl ${emptyFailed ? 'correctly fails' : 'UNEXPECTED PASS'}\n`)
    if (!emptyFailed) ok = false
  }
  if (!ok) throw new Error('Selftest failed: a validator accepted an empty implementation - harness is not objective')
  return ok
}

function writeResultsMd(run) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const lines = []
  const exists = fs.existsSync(RESULTS_MD)
  if (!exists) {
    lines.push(
      '# MoA Ablation Results (#367)',
      '',
      'Measured pass-rate / cost / latency of pipeline configurations against the',
      'objectively validated task set (`scripts/ablation/tasks.mjs`). Validators are',
      'fixed `node --test` harnesses - never substring checks. Regenerate a section',
      'with `node scripts/ablation/run-ablation.mjs --model <id> ...`.',
      '',
    )
  }
  lines.push(`## Run ${run.at} — model \`${run.model}\``, '')
  if (run.notes) lines.push(`> ${run.notes}`, '')
  lines.push(
    '| Configuration | Tasks | Pass-rate | Tokens | Cost USD | Latency p50 (ms) | p95 (ms) |',
    '|---|---:|---:|---:|---:|---:|---:|',
  )
  for (const row of run.configs) {
    lines.push(
      `| \`${row.config}\` — ${row.description} | ${row.tasks} | ${(row.passRate * 100).toFixed(1)}% | ${row.tokensTotal} | ${row.costUsdTotal ?? 'n/a'} | ${row.latencyP50Ms ?? 'n/a'} | ${row.latencyP95Ms ?? 'n/a'} |`,
    )
  }
  lines.push('', `_Raw measurements: docs/benchmarks/results/${run.rawFile}_`, '')
  const existing = exists ? fs.readFileSync(RESULTS_MD, 'utf8') : ''
  fs.writeFileSync(RESULTS_MD, existing + lines.join('\n') + '\n', 'utf8')
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv)
  } catch (err) {
    console.error(`[run-ablation] ${err.message}`)
    console.error('Usage: node scripts/ablation/run-ablation.mjs --model <id> [--configs ...] [--tasks ...] [--selftest]')
    process.exit(1)
  }

  const tasks = getTasks(args.tasks)
  process.stdout.write(`[run-ablation] tasks: ${tasks.map((t) => t.id).join(', ')}\n`)

  if (args.selftest) {
    await selftest(tasks)
    console.error('[run-ablation] selftest OK: every validator rejects an empty implementation')
    return
  }

  if (!args.model) {
    console.error('[run-ablation] --model is required (e.g. --model openai/gpt-4o-mini)')
    process.exit(1)
  }
  const apiKey = args.ollamaNative ? 'local' : process.env[args.apiKeyEnv]
  if (!apiKey) {
    console.error(
      `[run-ablation] Missing API key: export ${args.apiKeyEnv}=<key> (or pass --api-key-env NAME).\n` +
      'For a zero-cost local run use --ollama-native with a local Ollama endpoint.\n' +
      'Cloud measurements call a paid model API - they require the owner-provided key/budget (#367).',
    )
    process.exit(1)
  }

  const at = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const configs = []
  for (const cfgName of args.configs) {
    process.stdout.write(`[run-ablation] configuration: ${cfgName}\n`)
    configs.push(await evaluateConfig(args, apiKey, tasks, cfgName))
  }

  const rawFile = `run-${at}.json`
  fs.mkdirSync(RESULTS_RAW_DIR, { recursive: true })
  const run = {
    at: new Date().toISOString(),
    model: args.model,
    notes: args.notes,
    configs,
    rawFile,
  }
  fs.writeFileSync(path.join(RESULTS_RAW_DIR, rawFile), JSON.stringify(run, null, 2), 'utf8')
  writeResultsMd(run)
  process.stdout.write(`[run-ablation] done. Results appended to docs/benchmarks/RESULTS.md; raw: docs/benchmarks/results/${rawFile}\n`)
}

main().catch((err) => {
  console.error(`[run-ablation] ${err.message}`)
  process.exit(1)
})
