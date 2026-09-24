        /* ── PLUGIN UPDATES ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
            React.createElement('div', { className: 'moa-sec-title' }, '✨ ' + (t('updater.title') || 'Plugin Updates')),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8 } },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn moa-btn-sub',
                  disabled: updateState?.checking || updateState?.updating,
                  onClick: checkUpdates,
                },
                updateState?.checking ? (t('updater.checking') || 'Checking...') : (t('updater.btnCheck') || 'Check Updates')
              ),
              updateState?.updateAvailable
                ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'moa-btn moa-btn-sub moa-btn-primary',
                      disabled: updateState?.updating,
                      onClick: runUpdate,
                    },
                    updateState?.updating
                      ? (t('updater.updating') || 'Updating...')
                      : (t('updater.btnUpdate') || 'Update to v{version}').replace('{version}', updateState.latestVersion || '')
                  )
                : null
            )
          ),
          React.createElement(
            'div',
            { className: 'moa-sec-desc', style: { marginBottom: 8 } },
            t('updater.desc') || 'Check npm registry for new versions and update with one click.'
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 } },
            React.createElement(
              'span',
              { style: { color: 'var(--dsw-alias-label-secondary)' } },
              (t('updater.current') || 'Current version: v{version}').replace('{version}', updateState?.currentVersion || '0.2.16')
            ),
            updateState?.checking
              ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))' } }, t('updater.checking'))
              : updateState?.updateAvailable
                ? React.createElement(
                    'span',
                    { style: { color: 'var(--dsw-alias-state-error-primary)', fontWeight: 600 } },
                    (t('updater.available') || 'Update available: v{version}').replace('{version}', updateState?.latestVersion || '')
                  )
                : updateState?.currentVersion && !updateState?.error
                  ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-success-primary)' } }, '✓ ' + (t('updater.upToDate') || 'Up to date'))
                  : null
          ),
          updateState?.notice
            ? React.createElement(
                'div',
                { className: 'moa-alert-ok', style: { marginTop: 8 } },
                updateState.notice
              )
            : null,
          updateState?.error
            ? React.createElement(
                'div',
                { className: 'moa-alert-err', style: { marginTop: 8 } },
                updateState.error
              )
            : null
        ),

        /* ── ENABLED TOGGLE ── */
        React.createElement(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, alignSelf: 'flex-start' } },
          React.createElement('input', {
            type: 'checkbox',
            checked: enabled !== false,
            onChange: (e) => setEnabled(e.target.checked),
            style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
          }),
          t('config.enabled_label')
        ),

        /* ── FOOTER ACTIONS & SAVE ── */
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 } },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn moa-btn-primary',
              style: { padding: '10px 24px', fontSize: 14, fontWeight: 600 },
              onClick: handleSave,
            },
            saveStatus === t('actions.saving') ? t('actions.saving') : t('actions.save')
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn',
              onClick: reload,
            },
            t('actions.retry')
          ),
          saveStatus &&
            React.createElement(
              'span',
              {
                className: saveStatus.startsWith('Error') ? 'moa-alert-err' : 'moa-alert-ok',
              },
              saveStatus
            )
        )
      )
    }

