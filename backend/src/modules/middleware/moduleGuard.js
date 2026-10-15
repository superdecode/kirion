import { isDatabaseUnavailableError, query } from '../../config/database.js'
import { createTtlCache } from '../../shared/utils/ttlCache.js'

// A module toggle or plan change can take up to this long to reach a warm instance.
const ttlFromEnv = parseInt(process.env.MODULE_ACCESS_CACHE_TTL_MS, 10)
const ACCESS_CACHE_TTL_MS = Number.isFinite(ttlFromEnv) && ttlFromEnv >= 0 ? ttlFromEnv : 30000
const accessCache = createTtlCache(ACCESS_CACHE_TTL_MS)

export function clearModuleAccessCache() {
  accessCache.clear()
}

const ALLOWED = { allowed: true }

async function resolveModuleAccess(tenantId, moduleCode) {
  const tmRes = await query(
    'SELECT enabled FROM tenant_modules WHERE tenant_id = $1 AND module_code = $2 LIMIT 1',
    [tenantId, moduleCode]
  )

  if (tmRes.rows.length > 0) {
    if (!tmRes.rows[0].enabled) {
      return {
        status: 403,
        body: { error: `Modulo '${moduleCode}' no habilitado para este tenant.`, code: 'MODULE_DISABLED' },
      }
    }
    return ALLOWED
  }

  // Fallback: check plan modules (for tenants not yet in tenant_modules)
  const subRes = await query(
    `SELECT p.modules FROM subscriptions s
     JOIN plans p ON s.plan_id = p.id
     WHERE s.tenant_id = $1 AND s.status = 'active'
     ORDER BY s.started_at DESC LIMIT 1`,
    [tenantId]
  )

  if (subRes.rows.length === 0) {
    return { status: 402, body: { error: 'Sin suscripcion activa.', code: 'NO_ACTIVE_SUBSCRIPTION' } }
  }

  const modules = subRes.rows[0].modules
  if (!Array.isArray(modules) || !modules.includes(moduleCode)) {
    return {
      status: 403,
      body: { error: `Modulo '${moduleCode}' no incluido en tu plan.`, code: 'MODULE_NOT_INCLUDED' },
    }
  }

  return ALLOWED
}

// Returns middleware that verifies the tenant has access to the given module.
// Requires tenantContext middleware to have run first (sets req.tenantId + req.tenant).
// Primary check: tenant_modules table (migration 043).
// Fallback: plans.modules JSONB (legacy, for tenants not yet backfilled).
// The decision is cached per instance so every request doesn't spend a pool
// connection re-checking an almost-static value; DB errors are never cached.
export function moduleGuard(moduleCode) {
  return async (req, res, next) => {
    if (!req.tenantId) {
      return res.status(401).json({ error: 'Tenant no identificado' })
    }

    if (req.tenantReadOnly && req.method !== 'GET') {
      return res.status(402).json({
        error: 'Suscripcion vencida. Renueva para continuar.',
        code: 'SUBSCRIPTION_EXPIRED',
      })
    }

    try {
      const cacheKey = `${req.tenantId}:${moduleCode}`
      let access = accessCache.get(cacheKey)
      if (!access) {
        access = await resolveModuleAccess(req.tenantId, moduleCode)
        accessCache.set(cacheKey, access)
      }

      if (!access.allowed) {
        return res.status(access.status).json(access.body)
      }
      next()
    } catch (err) {
      console.error('[moduleGuard]', err.message)
      if (isDatabaseUnavailableError(err)) {
        return res.status(503).json({ error: 'Servicio no disponible, intenta de nuevo' })
      }
      return res.status(500).json({ error: 'Error interno' })
    }
  }
}
