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


    function renderSlotEditorList({ items, badgePrefix, onUpdate, onAdd, onRemove, addLabel, emptyWarning, availableModels, t }) {
      return React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 } },
        (Array.isArray(items) ? items : []).map((item, idx) =>
          React.createElement(
            'div',
            { key: idx, style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('span', { className: 'moa-cand-badge' }, `${badgePrefix} #${idx + 1}`),
            React.createElement(
              'div',
              { style: { flex: 1 } },
              React.createElement(SearchableModelPicker, {
                provider: (item && item.provider) || '',
                model: (item && item.model) || '',
                onChange: (prov, mod) => onUpdate(idx, prov, mod),
                availableModels,
                t,
              })
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'moa-btn moa-btn-danger moa-btn-sub',
                onClick: () => onRemove(idx),
              },
              '✕'
            )
          )
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'moa-btn moa-btn-sub',
            style: { marginTop: 4, alignSelf: 'flex-start' },
            onClick: onAdd,
          },
          addLabel
        ),
        emptyWarning ? React.createElement(
          'div',
          { style: { fontSize: 11, color: 'var(--dsw-alias-state-warning-primary, #e6a23c)', marginTop: 2 } },
          emptyWarning
        ) : null
      )
    }
