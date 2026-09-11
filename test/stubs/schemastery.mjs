/**
 * Minimal schemastery-compatible stub for harness-free tests.
 *
 * Implements only the surface dsh-moa uses (object/string/number/boolean/
 * array/dict with .default chaining and call-time validation with default
 * filling) so lib/index.js can be imported without the DSH runtime.
 */

function validate(schema, value) {
  if (typeof schema === 'function') schema = schema.__schema
  if (value === undefined || value === null) {
    return schema.default !== undefined ? structuredClone(schema.default) : undefined
  }
  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`expected object but got ${typeof value}`)
      }
      const out = { ...value }
      for (const [key, inner] of Object.entries(schema.fields || {})) {
        out[key] = validate(inner, value?.[key])
      }
      return out
    }
    case 'array': {
      if (!Array.isArray(value)) throw new Error('expected array')
      return schema.inner ? value.map((v) => validate(schema.inner, v)) : [...value]
    }
    case 'dict': {
      if (typeof value !== 'object' || Array.isArray(value)) throw new Error('expected dict')
      const out = {}
      for (const [k, v] of Object.entries(value)) {
        out[k] = schema.inner ? validate(schema.inner, v) : v
      }
      return out
    }
    case 'string':
      if (typeof value !== 'string') throw new Error(`expected string but got ${typeof value}`)
      return value
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`expected number but got ${typeof value}`)
      return value
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error(`expected boolean but got ${typeof value}`)
      return value
    default:
      return value
  }
}

function node(schema) {
  const fn = (value) => validate(schema, value)
  fn.__schema = schema
  fn.default = (d) => {
    schema.default = d
    return fn
  }
  fn.required = () => fn
  return fn
}

const z = {
  object: (fields) => node({ type: 'object', fields }),
  string: (o = {}) => node({ type: 'string', ...o }),
  number: (o = {}) => node({ type: 'number', ...o }),
  boolean: (o = {}) => node({ type: 'boolean', ...o }),
  array: (inner) => node({ type: 'array', inner }),
  dict: (inner) => node({ type: 'dict', inner }),
  any: () => node({ type: 'any' }),
}

export default z
export { z, validate }
