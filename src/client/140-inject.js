
    exports.inject = ['slots', 'locale', 'inputTriggers', 'configForms']
    exports.apply = function apply(ctx) {
      rootCtx = ctx

      const addLocale = (locale, dictionary) => {
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            return ctx.locale.register(NS, locale, dictionary)
          }
        } catch {
          return () => {}
        }
        return () => {}
      }

      if (typeof ctx.effect === 'function') {
        ctx.effect(() => {
          const undo = [addLocale('en', en), addLocale('zh', zh)]
          return () => {
            for (const off of undo) {
              if (typeof off === 'function') {
                try { off() } catch (offErr) { /* unsubscribe best-effort */ }
              }
            }
          }
        }, 'dsh-moa: dictionaries')
      } else {
        addLocale('en', en)
      }

      if (ctx.slots) {
        const registerCard = (slotName, key) => () => {
          try {
            ctx.slots.register(
              {
                name: slotName,
                key,
                order: 35,
                locale: NS,
                inject: () => ({ ctx }),
              },
              (props) => React.createElement(MoAErrorBoundary, null, React.createElement(MoACard, props))
            )
          } catch (err) {
            console.warn('[dsh-moa] Failed to register ' + slotName + ':', err)
          }
        }

        // Plugin-list seat (plugins.item): the seat the current core (0.1.6-alpha.2)
        // renders as the plugin's own page with its configuration. It needs an id and a
        // static label, so it is registered on its own rather than through the keyed
        // helper above. The label must not read the locale: it is resolved while the
        // page renders, and a lookup there would take the whole client batch down.
        const registerItemSeat = () => {
          try {
            ctx.slots.register(
              {
                name: 'plugins.item',
                id: ROW_ID,
                order: 35,
                label: () => 'Mixture of Agents (MoA)',
                locale: NS,
                inject: () => ({ ctx }),
              },
              (props) => React.createElement(MoAErrorBoundary, null, React.createElement(MoACard, props))
            )
          } catch (err) {
            console.warn('[dsh-moa] Failed to register plugins.item:', err)
          }
        }

        if (typeof ctx.slots.inject === 'function') {
          // Plugin-list seat first, then the row seat and the legacy seat as fallbacks.
          ctx.slots.inject('plugins.item', registerItemSeat)
          ctx.slots.inject('plugins.row.config', registerCard('plugins.row.config', ROW_CONFIG_KEY))
          ctx.slots.inject('settings.plugin.item', registerCard('settings.plugin.item', NS))
        } else {
          registerItemSeat()
          registerCard('plugins.row.config', ROW_CONFIG_KEY)()
          registerCard('settings.plugin.item', NS)()
        }
      }

      // Register slash command in composer
      ctx.effect(() => {
        const triggers = ctx.get ? ctx.get('inputTriggers') : ctx.inputTriggers
        if (!triggers || typeof triggers.registerSource !== 'function') return () => {}

        const dispose = triggers.registerSource({
          trigger: '/',
          name: 'moa',
          order: 35,
          description: en['slash.desc'],
          candidates: (_session, req) => {
            if (req.position !== 'leading') return Promise.resolve([])
            const q = req.query.trim().toLowerCase()
            if (q !== '' && !'moa'.startsWith(q)) return Promise.resolve([])
            return Promise.resolve([
              {
                name: 'moa',
                description: en['slash.desc'],
              },
            ])
          },
          onPick: ({ candidate }) => ({
            text: '/' + candidate.name + ' ',
          }),
          matchSpace: (_session, token) => {
            if (token === '/moa') return { text: '/moa ' }
            return undefined
          },
          matchEnter: (_session, _line) => {
            return Promise.resolve(undefined)
          },
        })

        return () => {
          if (typeof dispose === 'function') dispose()
        }
      }, 'dsh-moa: slash command trigger')
    }

    return module.exports
  },
})

