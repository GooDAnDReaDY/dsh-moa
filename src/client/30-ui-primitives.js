    function makeT(dict, fallback) {
      return function t(key, vars) {
        let val = (dict && dict[key]) || (fallback && fallback[key]) || key
        if (vars && typeof val === 'string') {
          for (const k of Object.keys(vars)) {
            val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]))
          }
        }
        return val
      }
    }

    function FallbackChevron({ className, style }) {
      return React.createElement(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 14 14',
          fill: 'none',
          'aria-hidden': true,
          className,
          style,
        },
        React.createElement('path', {
          d: 'M3.5 5.25L7 8.75L10.5 5.25',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      )
    }
    let Chevron = FallbackChevron
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
      if (primitives && typeof primitives.IconChevronDownOutline14 === 'function') {
        Chevron = primitives.IconChevronDownOutline14
      }
    } catch (noPrimitives) {
      Chevron = FallbackChevron
    }

