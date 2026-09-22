        /* ── SECTION 4: TELEMETRY & STATS SUMMARY ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement('div', { className: 'moa-section-title' }, t('stats.title')),
          React.createElement('div', { className: 'moa-section-desc' }, t('stats.desc')),
          React.createElement(
            'div',
            { className: 'moa-grid-2' },
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, String(presets.length)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.preset_count'))
            ),
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, (stats.totalRuns === null || stats.totalRuns === undefined) ? '—' : String(stats.totalRuns)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.total_runs'))
            ),
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, (stats.avgCostUsd === null || stats.avgCostUsd === undefined) ? '—' : `~\$${stats.avgCostUsd.toFixed(4)}`),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.avg_cost'))
            ),
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, String(currentRefs.length)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.active_models'))
            )
          ),
          Array.isArray(leaderboard) && leaderboard.length > 0 && React.createElement(
            'div',
            { style: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 } },
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' } },
              React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, t('leaderboard.title')),
              React.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                React.createElement(
                  'select',
                  {
                    className: 'moa-select',
                    style: { height: 26, fontSize: 11, padding: '0 6px' },
                    value: leaderboardPresetFilter,
                    onChange: (e) => setLeaderboardPresetFilter(e.target.value),
                  },
                  React.createElement('option', { value: 'all' }, t('leaderboard.filter_all')),
                  presets.map((p) => React.createElement('option', { key: p.name, value: p.name }, p.name))
                ),
                React.createElement(
                  'a',
                  {
                    href: `/dsh-moa/history/export?format=csv${leaderboardPresetFilter !== 'all' ? '&preset=' + encodeURIComponent(leaderboardPresetFilter) : ''}`,
                    download: 'moa-history.csv',
                    className: 'moa-btn',
                    style: { height: 26, fontSize: 11, padding: '0 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
                  },
                  t('leaderboard.export_csv') || 'CSV'
                ),
                React.createElement(
                  'a',
                  {
                    href: `/dsh-moa/history/export?format=json${leaderboardPresetFilter !== 'all' ? '&preset=' + encodeURIComponent(leaderboardPresetFilter) : ''}`,
                    download: 'moa-history.json',
                    className: 'moa-btn',
                    style: { height: 26, fontSize: 11, padding: '0 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
                  },
                  t('leaderboard.export_json') || 'JSON'
                )
              )
            ),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginTop: -4 } }, t('leaderboard.desc')),
            React.createElement(
              'div',
              { style: { overflowX: 'auto', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8 } },
              React.createElement(
                'table',
                { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' } },
                React.createElement(
                  'thead',
                  { style: { background: 'var(--dsw-alias-bg-layer-2)', borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
                  React.createElement(
                    'tr',
                    null,
                    React.createElement('th', { style: { padding: '6px 10px' } }, t('leaderboard.model')),
                    React.createElement('th', { style: { padding: '6px 8px' } }, t('leaderboard.runs')),
                    React.createElement('th', { style: { padding: '6px 8px' } }, t('leaderboard.wins')),
                    React.createElement('th', { style: { padding: '6px 8px' } }, t('leaderboard.winrate')),
                    React.createElement('th', { style: { padding: '6px 10px' } }, t('leaderboard.cost'))
                  )
                ),
                React.createElement(
                  'tbody',
                  null,
                  leaderboard.map((m, mIdx) =>
                    React.createElement(
                      'tr',
                      { key: mIdx, style: { borderBottom: mIdx < leaderboard.length - 1 ? '1px solid var(--dsw-alias-border-l2)' : 'none' } },
                      React.createElement('td', { style: { padding: '6px 10px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, m.modelKey || m.model),
                      React.createElement('td', { style: { padding: '6px 8px', color: 'var(--dsw-alias-label-secondary)' } }, String(m.runs)),
                      React.createElement('td', { style: { padding: '6px 8px', color: 'var(--dsw-alias-state-success-primary)' } }, String(m.wins)),
                      React.createElement('td', { style: { padding: '6px 8px', fontWeight: 600 } }, (m.winRate ?? 0) + '%'),
                      React.createElement('td', { style: { padding: '6px 10px', color: 'var(--dsw-alias-label-secondary)' } }, (m.avgCostUsd > 0) ? ('$' + m.avgCostUsd.toFixed(4)) : 'Free')
                    )
                  )
                )
              )
            )
          )
        ),

