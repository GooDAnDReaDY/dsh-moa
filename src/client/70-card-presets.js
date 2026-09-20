        /* ── SECTION 1: PRESET MANAGEMENT ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { className: 'moa-section-title' },
            React.createElement('span', null, t('presets.title')),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              !isDefault &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-btn moa-btn-sub',
                    onClick: () => setDefaultPreset(currentPreset.name),
                  },
                  '★ ' + t('presets.set_default')
                ),
              isDefault &&
                React.createElement('span', { className: 'moa-badge moa-badge-ok' }, '✓ ' + t('presets.active_badge')),
              !isCreating &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-btn moa-btn-sub',
                    onClick: () => setIsCreating(true),
                  },
                  t('presets.new_btn')
                )
            )
          ),
          React.createElement('div', { className: 'moa-section-desc' }, t('presets.desc')),
          React.createElement(
            'div',
            { className: 'moa-seg-group' },
            presets.map((p) => {
              const isCur = p.name === selectedPresetName
              return React.createElement(
                'button',
                {
                  key: p.name,
                  type: 'button',
                  className: isCur ? 'moa-seg-btn moa-seg-btn-active' : 'moa-seg-btn',
                  onClick: () => setSelectedPresetName(p.name),
                },
                p.name === defaultPreset ? `★ ${p.name}` : p.name
              )
            }),
            presets.length > 1 &&
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn moa-btn-danger moa-btn-sub',
                  onClick: () => handleDeletePreset(currentPreset.name),
                  title: t('presets.del_btn'),
                },
                '🗑 ' + t('presets.del_btn')
              )
          ),
          isCreating &&
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 } },
              React.createElement('input', {
                type: 'text',
                className: 'moa-input',
                style: { maxWidth: 320 },
                placeholder: t('presets.name_placeholder'),
                value: newPresetName,
                onChange: (e) => setNewPresetName(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') handleCreatePreset()
                  if (e.key === 'Escape') setIsCreating(false)
                },
              }),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn moa-btn-primary',
                  onClick: handleCreatePreset,
                },
                t('presets.create')
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn',
                  onClick: () => setIsCreating(false),
                },
                t('presets.cancel')
              )
            )
        ),

        /* ── SECTION 2: AGGREGATOR / JUDGE ── */
