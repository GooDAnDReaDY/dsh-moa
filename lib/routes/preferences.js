import { getWebServer } from '../services.js'
/**
 * Developer Preferences Management Routes (#309)
 * Exposes endpoints to inspect, add, toggle, and delete developer coding preferences.
 */

import {
  loadDeveloperPreferences,
  addDeveloperPreference,
  updateDeveloperPreference,
  deleteDeveloperPreference,
} from '../pipeline/developer-preferences.js'
import { writeJson, readBody, assertAuthorizedRequest } from '../access.js'
import { isSafeWriteRequest } from '../updater.js'

export function registerPreferencesRoutes(ctx) {
  // 1. Exact route: /dsh-moa/preferences
  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'exact',
      path: '/dsh-moa/preferences',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        if (req.method === 'GET') {
          const preferences = loadDeveloperPreferences()
          return writeJson(res, 200, { ok: true, preferences })
        }

        if (req.method === 'POST') {
          if (!isSafeWriteRequest(req)) {
            return writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          }

          let body = {}
          try {
            const raw = await readBody(req)
            if (raw) body = JSON.parse(raw)
          } catch (_err) {
            return writeJson(res, 400, { ok: false, error: 'Malformed JSON payload' })
          }

          if (body.action === 'delete' && body.id) {
            const deleted = deleteDeveloperPreference(body.id)
            return writeJson(res, 200, { ok: true, deleted, id: body.id })
          }

          if (body.action === 'update' && body.id) {
            const updated = updateDeveloperPreference(body.id, body.updates || body)
            if (!updated) return writeJson(res, 404, { ok: false, error: 'Preference not found' })
            return writeJson(res, 200, { ok: true, preference: updated })
          }

          const created = addDeveloperPreference(body)
          if (!created) {
            return writeJson(res, 400, { ok: false, error: 'Missing required rule field' })
          }
          return writeJson(res, 201, { ok: true, preference: created })
        }

        return writeJson(res, 405, { ok: false, error: 'GET or POST required' })
      },
    })
  })

  // 2. Prefix route: /dsh-moa/preferences/ for REST ID operations
  ctx.effect(() => {
    return (getWebServer(ctx) || ctx.webServer)?.register({
      kind: 'prefix',
      path: '/dsh-moa/preferences/',
      handler: async (req, res) => {
        if (!assertAuthorizedRequest(req, res, ctx)) return

        const url = new URL(req.url, 'http://127.0.0.1')
        const id = url.pathname.replace(/^\/dsh-moa\/preferences\//, '').trim()

        if (!id) {
          return writeJson(res, 400, { ok: false, error: 'Missing preference ID in URL path' })
        }

        if (req.method === 'DELETE') {
          if (!isSafeWriteRequest(req)) {
            return writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          }
          const deleted = deleteDeveloperPreference(id)
          return writeJson(res, 200, { ok: true, deleted, id })
        }

        if (req.method === 'PATCH' || req.method === 'POST') {
          if (!isSafeWriteRequest(req)) {
            return writeJson(res, 403, { ok: false, error: 'Forbidden: cross-site request rejected' })
          }
          let body = {}
          try {
            const raw = await readBody(req)
            if (raw) body = JSON.parse(raw)
          } catch {
            return writeJson(res, 400, { ok: false, error: 'Malformed JSON payload' })
          }
          const updated = updateDeveloperPreference(id, body)
          if (!updated) return writeJson(res, 404, { ok: false, error: 'Preference not found' })
          return writeJson(res, 200, { ok: true, preference: updated })
        }

        return writeJson(res, 405, { ok: false, error: 'DELETE or PATCH required' })
      },
    })
  })
}
