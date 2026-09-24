/**
 * Automated Benchmark & Post-Mortem PR Reports
 * Feature 9 (Automated Benchmark & Post-Mortem PR Reports)
 */

export function generateMoABenchmarkReport({
  runId = '',
  timestamp = new Date().toISOString(),
  preset = 'default',
  prompt = '',
  durationMs = 0,
  usage = {},
  costUsd = 0,
  candidates = [],
  winningIndex = 1,
  winningLabel = '',
  consensus = null,
  testGate = null,
  isComposite = false,
}) {
  const durationSec = (durationMs / 1000).toFixed(2)
  const totalCost = typeof costUsd === 'number' ? costUsd.toFixed(4) : '0.0000'
  const inTokens = usage?.inputTokens || 0
  const outTokens = usage?.outputTokens || 0
  const totalTokens = usage?.totalTokens || (inTokens + outTokens)

  const candidateRows = (candidates || []).map((c) => {
    const idx = c.index || '?'
    const label = c.label || `${c.slot?.provider}:${c.slot?.model}`
    const role = c.role_persona || 'general'
    const status = c.ok ? '✅ OK' : '❌ Failed'
    const candTokens = c.usage?.totalTokens || (c.usage?.inputTokens || 0) + (c.usage?.outputTokens || 0)
    const candCost = c.costUsd ? `$${c.costUsd.toFixed(4)}` : '$0.0000'
    const score = consensus?.averageScores?.[c.index] !== undefined
      ? `${consensus.averageScores[c.index]}/10`
      : 'N/A'
    const isWin = c.index === winningIndex ? ' 🏆' : ''
    return `| ${idx}${isWin} | \`${label}\` | ${role} | ${status} | ${candTokens} | ${candCost} | ${score} |`
  }).join('\n')

  let testGateSection = '### 🧪 Automated Test Gate\n- **Status**: Not Configured / Skipped'
  if (testGate && testGate.enabled) {
    const tgStatus = testGate.passed ? '✅ PASSED' : '❌ FAILED'
    testGateSection = `### 🧪 Automated Test Gate
- **Status**: ${tgStatus}
- **Test Command**: \`${testGate.command || 'N/A'}\`
- **Exit Code**: \`${testGate.exitCode ?? 0}\`
- **Output Snippet**:
\`\`\`
${(testGate.output || 'No output recorded').slice(0, 500)}
\`\`\``
  }

  let consensusSection = '### ⚖️ Multi-Judge Consensus\n- **Status**: Standard single-aggregator synthesis'
  if (consensus && consensus.consensus) {
    consensusSection = `### ⚖️ Multi-Judge Consensus
- **Winning Candidate**: Candidate ${winningIndex} (${winningLabel})
- **Strategy**: \`${consensus.strategy || 'majority'}\`
- **Unanimous**: ${consensus.isUnanimous ? 'Yes ✅' : 'No (Majority)'}
- **Summary**: ${consensus.consensusReport || 'Consensus reached'}
`
  }

  const markdown = `# 🏆 Mixture of Agents (MoA) Benchmark & Post-Mortem Report

> **Run ID**: \`${runId}\`  
> **Timestamp**: \`${timestamp}\`  
> **Preset**: \`${preset}\`  
> **Total Latency**: \`${durationSec}s\` | **Total Cost**: \`$${totalCost}\` | **Tokens**: \`${totalTokens}\` (In: ${inTokens}, Out: ${outTokens})

---

## 🎯 Task Prompt
\`\`\`text
${prompt.slice(0, 500)}${prompt.length > 500 ? '...' : ''}
\`\`\`

---

## 📊 Candidate Models Benchmark Matrix
| # | Model / Provider | Role | Status | Tokens | Cost | Judge Score |
|---|------------------|------|--------|--------|------|-------------|
${candidateRows || '| - | No candidate data | - | - | - | - | - |'}

---

${consensusSection}

---

${testGateSection}

---

### 🧬 Synthesis Mode
- **Mode**: ${isComposite ? 'Composite Hybrid AST/Block Merge (Multi-Candidate Synthesis)' : `Candidate Selection (Winning model: ${winningLabel || 'Aggregator'})`}
`

  const json = {
    runId,
    timestamp,
    preset,
    prompt,
    durationMs,
    usage: { inputTokens: inTokens, outputTokens: outTokens, totalTokens },
    costUsd,
    candidates: (candidates || []).map((c) => ({
      index: c.index,
      label: c.label,
      role: c.role_persona,
      ok: c.ok,
      costUsd: c.costUsd || 0,
      usage: c.usage,
      score: consensus?.averageScores?.[c.index] ?? null,
    })),
    winningIndex,
    winningLabel,
    consensus,
    testGate,
    isComposite,
  }

  return { markdown, json }
}
