# FASE 0 — Audit

## 1. Tables — tenant-scoped vs global

### Global (no tenant_id)
- tenants (NEW)
- tenant_signup_requests (NEW)
- plans (NEW)
- subscriptions (NEW)
- super_admins (NEW)
- provisioning_log (NEW)
- notifications_outbox (NEW)
- token_blacklist (JTIs globally unique, no scope needed)
- audit_log (add optional tenant_id col for filtering, not required for isolation)

### Tenant-scoped (need tenant_id column + RLS)
- roles
- usuarios
- configuraciones (empresa/canal config per tenant)
- tarimas
- guias
- sesiones_escaneo
- alertas_duplicados
- canales_escaneo
- empresas_paqueteria
- usuarios_internos
- logs_usuarios_internos
- wms_credentials
- wms_cache
- inventory_sessions
- inventory_scans
- folios_fep
- folios_fep_tarimas (derived via FK, still needs tenant_id for RLS)

## 2. Unique indexes requiring tenant scope change

- usuarios.email UNIQUE -> (tenant_id, email)
- usuarios.codigo UNIQUE -> (tenant_id, codigo)
- roles.nombre UNIQUE -> (tenant_id, nombre)
- configuraciones.(modulo, tipo, codigo) -> (tenant_id, modulo, tipo, codigo)
- tarimas.codigo UNIQUE -> (tenant_id, codigo)
- canales_escaneo.nombre (partial WHERE activo) -> (tenant_id, nombre)
- empresas_paqueteria.nombre UNIQUE -> (tenant_id, nombre)
- empresas_paqueteria.codigo UNIQUE -> (tenant_id, codigo)
- usuarios_internos.nombre (partial WHERE eliminado=false) -> (tenant_id, nombre)

## 3. Views requiring update after migration

- v_tarimas_completas — add tenant_id to SELECT and WHERE
- v_guias_completas — add tenant_id to SELECT and WHERE

## 4. All API endpoints and tenant filter requirement

### /api/auth/* — needs subdomain-based tenant resolution
- POST /api/auth/login — resolve tenant from Host header, filter usuarios by tenant_id
- GET /api/auth/me — filter by user.tenant_id from JWT
- POST /api/auth/change-password — filter by user.tenant_id
- PUT /api/auth/preferences — filter by user.tenant_id
- POST /api/auth/logout — no tenant filter needed (JTI lookup is global)

### /api/users/* — needs tenant filter
### /api/roles/* — needs tenant filter
### /api/config/* — needs tenant filter
### /api/setup/* — needs tenant filter (or disable in multi-tenant)
### /api/wms/* — needs tenant filter (wms_credentials per tenant)
### /api/dropscan/* — needs tenant filter (all dropscan tables)
### /api/inventory/* — needs tenant filter
### /api/fep/* — needs tenant filter

### New routes (no tenant filter — global):
- POST /api/public/signup-requests
- /api/admin/* (super admin only)

## 5. Frontend single-tenant assumptions

- frontend/src/core/services/api.js — baseURL is /api (OK, no change needed for same-origin)
- frontend/src/core/stores/authStore.js — stores token in localStorage, no tenant context
- frontend/src/core/components/auth/Login.jsx — no tenant slug field
- frontend/src/App.jsx — routing, needs Landing route at /
- frontend/src/core/services/api.js — needs to handle 402 (trial expired) and 403 (module access)

## 6. Vercel serverless constraint

api/index.js exports the Express app as serverless. setInterval does NOT work reliably.
Lifecycle scheduler and notification worker must use Vercel Cron Jobs (vercel.json crons section).
Cron endpoints: GET /api/cron/lifecycle and GET /api/cron/notifications — protected by CRON_SECRET.

## 7. bcrypt cost

Current auth.routes.js change-password uses cost 10. Plan requires cost 12.
initDb.js seed uses bcrypt (unknown cost, needs check).
Fix: update bcrypt.hash calls to cost 12.

## 8. Key architecture note — RLS via SET LOCAL

database.js exposes query() and getClient().
For RLS, all tenant requests must run inside a transaction with SET LOCAL app.tenant_id.
Solution: create tenantQuery(tenantId, text, params) helper that:
  1. Gets client from pool
  2. BEGIN
  3. SET LOCAL app.tenant_id = tenantId
  4. Executes query
  5. COMMIT
  6. Releases client
For tenantContext middleware: set req.tenantId and expose a req.tenantQuery() wrapper.
