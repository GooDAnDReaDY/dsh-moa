    function MoACard(props) {
      ensureStyles()
      const state = useMoASettings(props)
      const page = !!(props && props.view === 'page')
      const [open, setOpen] = React.useState(!!page)

      // Row seat (plugins.row.config): the host page draws title/icon/crumb and the
      // padding, so the summary is a one-liner and the page drops our card chrome.
      if (props && props.view === 'summary') {
        return React.createElement('div', { className: 'moa-sub' }, state.t('description') || SUBTITLE)
      }

      return React.createElement(
        page ? 'div' : 'li',
        { className: page ? 'moa-page' : 'moa-card' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'moa-head',
            style: page ? { display: 'none' } : undefined,
            'aria-expanded': open,
            onClick: () => setOpen(!open),
          },
          React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'moa-title' }, '🧠 ' + (state.t('title') || TITLE)),
            React.createElement('div', { className: 'moa-sub' }, state.t('description') || SUBTITLE)
          ),
          React.createElement(Chevron, {
            className: open ? 'moa-chev moa-chev-open' : 'moa-chev',
          })
        ),
        open &&
          React.createElement(
            'div',
            { className: 'moa-body' },
            state.status === 'loading'
              ? React.createElement('div', { style: { padding: '16px 0', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, 'Loading MoA settings…')
              : state.status === 'unavailable'
                ? React.createElement(
                    'div',
                    { style: { padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 } },
                    React.createElement('div', { className: 'moa-alert-err' }, 'MoA service temporarily unavailable'),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'moa-btn',
                        style: { width: 'fit-content' },
                        onClick: state.reload,
                      },
                      state.t('actions.retry')
                    )
                  )
                : React.createElement(MoAEditor, state)
          )
      )
    }
