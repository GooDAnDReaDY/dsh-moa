import path from 'node:path'
import vm from 'node:vm'

export function verifyFileSyntax(files = []) {
  if (!Array.isArray(files)) return []
  const warnings = []

  for (const file of files) {
    if (!file || typeof file.content !== 'string' || !file.relativePath) continue
    const ext = path.extname(file.relativePath).toLowerCase()

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      try {
        const transformed = file.content
          .replace(/^([ \t]*)export\s+default\s+/gm, '$1')
          .replace(/^([ \t]*)export\s*\{[^}]*\}\s*;?/gm, '$1')
          .replace(/^([ \t]*)export\s+(const|let|var|function|class|async\s+function)\s+/gm, '$1$2 ')
          .replace(/^([ \t]*)import\s+[^;\n]+;?/gm, '$1')
          .replace(/^([ \t]*)export\s+\*\s+from\s+[^;\n]+;?/gm, '$1')
        new vm.Script(transformed)
      } catch (err) {
        warnings.push({ file: file.relativePath, error: err?.message || String(err), line: err?.lineNumber || 1 })
      }
    } else if (ext === '.json') {
      try {
        JSON.parse(file.content)
      } catch (err) {
        warnings.push({
          file: file.relativePath,
          error: err?.message || String(err),
          line: 1,
        })
      }
    }
  }
  return warnings
}

/**
 * Reads all files from a candidate workspace (.moa/candidate-N, .moa/curator-synthesis, or scoped under runId).
 */

export function computeLineDiff(oldText = '', newText = '') {
  const oldLines = typeof oldText === 'string' ? oldText.split(/\r?\n/) : []
  const newLines = typeof newText === 'string' ? newText.split(/\r?\n/) : []
  const n = oldLines.length, m = newLines.length
  if (n === 0 && m === 0) return []
  if (oldText === newText) {
    return oldLines.map((line, idx) => ({ type: 'same', line, oldNum: idx + 1, newNum: idx + 1 }))
  }

  let start = 0
  while (start < n && start < m && oldLines[start] === newLines[start]) start++
  let oldEnd = n - 1, newEnd = m - 1
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--
    newEnd--
  }

  const prefixItems = oldLines.slice(0, start).map((line, k) => ({ type: 'same', line, oldNum: k + 1, newNum: k + 1 }))
  const suffixLen = (n - 1) - oldEnd
  const suffixItems = oldLines.slice(oldEnd + 1, oldEnd + 1 + suffixLen).map((line, k) => ({ type: 'same', line, oldNum: oldEnd + 2 + k, newNum: newEnd + 2 + k }))

  const subOld = oldLines.slice(start, oldEnd + 1)
  const subNew = newLines.slice(start, newEnd + 1)
  const subN = subOld.length, subM = subNew.length
  let middleItems
  if (subN === 0) {
    middleItems = subNew.map((line, j) => ({ type: 'added', line, newNum: start + j + 1 }))
  } else if (subM === 0) {
    middleItems = subOld.map((line, i) => ({ type: 'removed', line, oldNum: start + i + 1 }))
  } else if (subN > 2000 || subM > 2000) {
    middleItems = new Array(subN + subM)
    for (let i = 0; i < subN; i++) middleItems[i] = { type: 'removed', line: subOld[i], oldNum: start + i + 1 }
    for (let j = 0; j < subM; j++) middleItems[subN + j] = { type: 'added', line: subNew[j], newNum: start + j + 1 }
  } else {
    const dp = Array.from({ length: subN + 1 }, () => new Uint16Array(subM + 1))
    for (let i = 0; i < subN; i++) {
      for (let j = 0; j < subM; j++) dp[i + 1][j + 1] = subOld[i] === subNew[j] ? dp[i][j] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
    let i = subN, j = subM; const stack = []
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && subOld[i - 1] === subNew[j - 1]) {
        stack.push({ type: 'same', line: subOld[--i], oldNum: start + i + 1, newNum: start + j }); j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        stack.push({ type: 'added', line: subNew[--j], newNum: start + j + 1 })
      } else if (i > 0) {
        stack.push({ type: 'removed', line: subOld[--i], oldNum: start + i + 1 })
      }
    }
    middleItems = stack.reverse()
  }
  return prefixItems.concat(middleItems, suffixItems)
}
