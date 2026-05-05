# Multi-Tenant MVP — Handoff para siguiente agente

Branch: feat/multitenant-mvp
Worktree: /Users/quiron/CascadeProjects/kirion/.worktrees/multitenant
Commit: 78a7c2f

---

## Completado en esta sesion

### Backend
- env.js: nuevas variables MT (TENANT_BASE_DOMAIN, JWT_ADMIN_SECRET, RESEND_API_KEY, TURNSTILE_SECRET, CRON_SECRET, LEGACY_TENANT_ID), fail-fast en produccion
- database.js: tenantQuery() y tenantTransaction() para SET LOCAL app.tenant_id
- Migracion 020: tablas nuevas (tenants, tenant_signup_requests, plans, subscriptions, super_admins, provisioning_log, notifications_outbox, system_audit_log)
- Migracion 021: tenant_id en todas las tablas existentes, reescritura de unique indexes a scope (tenant_id, field), backfill con LEGACY_TENANT_ID
- Migracion 022: RLS policies en todas las tablas tenant-scoped
- tenantContext.js: resolucion de slug desde subdominio, query tenant, bloqueo por status
- moduleGuard.js: verificacion de plan.modules por modulo solicitado
- auth.routes.js: login refactorizado para subdominio + tenant_id en JWT + modules + must_change_password, bcrypt cost 12
- provisioningService.js: 6 pasos idempotentes con logging y alerta a super admin
- emailService.js: Resend SDK, todos los templates de ciclo de vida
- notificationWorker.js: procesa outbox, reintentos, batch de 10
- lifecycleScheduler.js: expira trials y suscripciones, encola notificaciones
- admin.routes.js: auth super_admin, signup queue (approve/reject), tenants CRUD, suscripciones manuales, dashboard, log notificaciones
- public.routes.js: POST /api/public/signup-requests con Turnstile + rate limit 5/h
- cron.routes.js: GET /api/cron/notifications y /api/cron/lifecycle con CRON_SECRET
- server.js: wired todos los nuevos routes, tenantContext + moduleGuard en rutas existentes

### Frontend
- Landing.jsx: hero, features, pricing ($188/mo), form de solicitud -> /api/public/signup-requests
- Super admin panel completo: AdminLogin, AdminLayout, AdminDashboard, AdminSolicitudes (aprobar/rechazar inline), AdminTenants, AdminTenantDetalle (suscripcion manual, provisioning log, suspend/reactivate), AdminNotificaciones
- App.jsx: routes /landing, /super-admin/*, proteccion con adminAuthStore

### Infra
- vercel.json: Vercel Cron jobs para notifications (*/5min) y lifecycle (hourly)

---

## Lo que falta completar antes de go-live

### CRITICO — bloquea produccion

1. APLICAR MIGRACIONES en orden en Supabase:
   - Crear tenant legacy en tenants table con UUID real (antes de 021)
   - Ejecutar 020_multitenant_base.sql
   - Reemplazar 'REPLACE_WITH_LEGACY_UUID' en 021 con UUID real y ejecutar
   - Ejecutar 022_rls_policies.sql
   - Verificar que RLS no rompe queries existentes probando con usuario legacy

2. CONFIGURAR VARIABLES DE ENTORNO en Vercel y local:
   - TENANT_BASE_DOMAIN=<dominio a comprar> (ej. kerion.app)
   - JWT_ADMIN_SECRET=<secret 32+ chars>
   - RESEND_API_KEY=<de resend.com>
   - EMAIL_FROM=noreply@<dominio>
   - SUPER_ADMIN_EMAIL=<email del dueno>
   - LEGACY_TENANT_ID=<UUID del tenant legacy>
   - TURNSTILE_SECRET=<de Cloudflare Turnstile dashboard>
   - CRON_SECRET=<secret 32+ chars>

3. CREAR PRIMER SUPER ADMIN en DB:
   INSERT INTO super_admins (email, password_hash, name)
   VALUES ('<email>', bcrypt.hash('<password>', 12), '<nombre>');

4. INSTALAR resend en backend:
   cd backend && npm install resend
   (emailService.js usa fetch nativo pero el SDK seria mejor — actualmente usa fetch)

### IMPORTANTE — funcionalidad incompleta

5. Refactorizar queries existentes en todos los route handlers (users.routes, roles.routes, config.routes, etc.) para:
   - Usar tenantQuery(req.tenantId, ...) en vez de query() cuando necesiten RLS
   - O pasar tenantId explicitamente en WHERE si no usan tenantTransaction
   El tenantContext ya setea req.tenantId pero los handlers existentes aun usan query() sin SET LOCAL.
   SIN ESTO LOS QUERIES IGNORAN RLS (RLS solo filtra cuando app.tenant_id esta seteado en la transaccion).

6. Frontend authStore: cuando el usuario hace login, el JWT ahora incluye must_change_password y modules. El frontend debe:
   - Redirigir a /change-password si must_change_password=true y bloquear navegacion
   - Usar modules del JWT para mostrar/ocultar modulos en el sidebar

7. Login page: actualmente no pide slug de tenant. Con subdominio esto es automatico. Para dev local necesita el header X-Tenant-Slug. Verificar que el flujo de login local funcione.

8. La landing page usa /landing route. Si quieres que sea la raiz (/), cambiar en App.jsx y ajustar el redirect de usuarios autenticados.

9. Dominio: comprar dominio, configurar DNS wildcard (*.kerion.app -> Vercel). Sin esto los subdominios no funcionan. En dev usar localhost con header X-Tenant-Slug.

10. Probar que el Vercel Cron secret llega correctamente. Vercel envía Authorization: Bearer <CRON_SECRET> en los cron requests - verificar que CRON_SECRET este en env de Vercel.

### MENOR — mejoras post-MVP

11. Test cruzado de isolation: crear 2 tenants en staging, verificar que tenant A no ve datos de tenant B en cada endpoint critico.
12. Frontend: mostrar mensaje de trial vencido (HTTP 402 -> UI de "renueva tu suscripcion").
13. Frontend: el sidebar debe ocultar modulos no incluidos en modules[] del JWT.
14. Email templates: personalizacion con logo, colores de marca.
15. Landing: Cloudflare Turnstile widget en el form (actualmente el backend valida el token pero el frontend no incluye el widget).
16. Comprar dominio. Sugerencia: kerion.app, kerionwms.com, o kerionscan.com.
17. Panel super admin: subdominio admin.kerion.app apunta al mismo Vercel deploy, el routing /super-admin/* ya existe en el frontend.

---

## Archivos clave creados

backend/migrations/020_multitenant_base.sql
backend/migrations/021_tenant_scope_existing.sql
backend/migrations/022_rls_policies.sql
backend/src/config/database.js (tenantQuery, tenantTransaction)
backend/src/config/env.js (nuevas vars)
backend/src/modules/middleware/tenantContext.js
backend/src/modules/middleware/moduleGuard.js
backend/src/core/routes/admin.routes.js
backend/src/core/routes/public.routes.js
backend/src/core/routes/cron.routes.js
backend/src/services/provisioningService.js
backend/src/services/emailService.js
backend/src/services/notificationWorker.js
backend/src/services/lifecycleScheduler.js
frontend/src/pages/Landing.jsx
frontend/src/modules/superadmin/* (7 archivos)
docs/AUDIT_FASE0.md
