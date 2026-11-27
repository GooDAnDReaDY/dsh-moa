export function buildMutableCodeMask(source) {
  const text = String(source ?? '')
  const out = text.split('')
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i++) out[i] = ' '
  }
  let i = 0
  while (i < out.length) {
    const c = text[i]
    const next = text[i + 1]
    if (c === '/' && next === '/') {
      const nl = text.indexOf('\n', i)
      const stop = nl === -1 ? text.length : nl
      blank(i, stop)
      i = stop
      continue
    }
    if (c === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2)
      const stop = close === -1 ? text.length : close + 2
      blank(i, stop)
      i = stop
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      out[i] = ' '
      let j = i + 1
      while (j < out.length) {
        if (text[j] === '\\') {
          out[j] = ' '
          if (j + 1 < out.length) out[j + 1] = ' '
          j += 2
          continue
        }
        if (text[j] === c) {
          out[j] = ' '
          j++
          break
        }
        if (c === '`' && text[j] === '$' && text[j + 1] === '{') {
          const close = text.indexOf('}', j + 2)
          const stop = close === -1 ? text.length : close + 1
          for (let k = j; k < stop; k++) out[k] = ' '
          j = stop
          continue
        }
        out[j] = ' '
        j++
      }
      i = j
      continue
    }
    i++
  }
  return out.join('')
}
