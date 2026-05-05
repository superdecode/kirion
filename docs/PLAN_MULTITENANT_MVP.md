# KERION WMS — Plan de Implementacion Multi-Tenant MVP

Documento operativo para Claude Code. Sin formato decorativo. Foco MVP comercializable.

---

## ALCANCE MVP

- Modulo a comercializar: Drop Scan unicamente. Inventory y FEP quedan fuera del MVP (no se exponen a tenants nuevos, pero el codigo permanece).
- Onboarding: solicitud publica + aprobacion manual del Super Admin + provisioning automatico.
- Pagos: registro manual de suscripciones por el Super Admin. Sin pasarela en MVP.
- Landing: pagina minima funcional (hero + formulario). Diseno detallado se itera luego.
- Trial: 7 dias automaticos al aprobar.

---

## FASE 0 — PREPARACION DEL SISTEMA SINGLE-TENANT (BLOQUEANTE)

Antes de tocar multi-tenancy, dejar el sistema actual en estado de produccion estable. Si arrastramos bugs ahora, se multiplican por N tenants.

### 0.1 Auditoria de estado actual

- Inventariar todas las tablas en Supabase y mapear cuales son globales vs cuales seran tenant-scoped.
- Listar todos los endpoints en `backend/src/core/routes/*` y `backend/src/modules/dropscan/routes/*` y marcar cuales requeriran filtrado por tenant.
- Revisar el frontend (`frontend/src/modules/dropscan/`) para identificar puntos donde se asume tenant unico (URLs hardcoded, llamadas API, storage local).
- Revisar `backend/migrations/` y consolidar cualquier divergencia entre migraciones aplicadas y schema real en Supabase.

### 0.2 Estabilidad y bugs criticos pendientes

- Cerrar el bug de rate limiting + conflicto de sesion en Drop Scan (sesion previa abierta en la rama main).
- Revisar manejo de errores: ningun endpoint debe retornar 500 sin log estructurado.
- Verificar que JWT no expira de forma inconsistente entre frontend y backend.
- Confirmar que `helmet`, CORS y rate limit globales en `server.js` estan configurados correctamente para produccion (no localhost).

### 0.3 Higiene de base de datos

- Crear backup completo antes de cualquier migracion de FASE 1.
- Anadir columnas `created_at`, `updated_at` a toda tabla que aun no las tenga (necesario para auditoria multi-tenant).
- Verificar foreign keys consistentes y `ON DELETE` definidos explicitamente.
- Revisar indices: cualquier query que filtre por usuario o entidad de negocio debe tener indice. Multi-tenant anadira indice por `tenant_id` encima.

### 0.4 Configuracion y secretos

- Mover cualquier credencial hardcoded a variables de entorno.
- Verificar `env.js` valida la presencia de variables criticas al arrancar (fail-fast).
- Confirmar que existe `.env.example` actualizado.
- Configurar logs estructurados (JSON) para poder filtrar luego por `tenant_id`.

### 0.5 Despliegue base

- Confirmar pipeline de deploy actual (Vercel para frontend, Supabase para DB, host del backend).
- Definir entornos: `dev`, `staging`, `production`. El multi-tenant se valida primero en staging.
- Healthcheck `/api/health` debe responder con version, uptime y conexion a DB.

### 0.6 Tests minimos antes de FASE 1

- Test de login + flujo Drop Scan basico (E2E o manual checklist documentado).
- Test de creacion/lectura/actualizacion/borrado en cada tabla principal.
- Smoke test de los endpoints listados en 0.1.

Criterio de salida FASE 0: sistema en produccion sin bugs criticos abiertos, schema documentado, backups verificados, deploy reproducible.

---

## FASE 1 — ARQUITECTURA MULTI-TENANT

### 1.1 Modelo de aislamiento

Recomendacion para MVP: **base de datos compartida con `tenant_id` en cada tabla** (shared database, shared schema).

Razones:
- Migracion mas simple desde single-tenant actual: anadir columna y backfill.
- Operacion mas barata: una sola DB, un solo backup, un solo set de migraciones.
- Supabase favorece este modelo (RLS aplica naturalmente).
- Permite crecer a 100+ tenants sin reorquestar infra.

Riesgos y mitigacion:
- Riesgo de fuga cruzada: mitigado con Row Level Security (RLS) en Supabase + middleware backend que inyecta `tenant_id` en todo query.
- Noisy neighbor: aceptable en MVP. Si un tenant crece, se migra a schema dedicado.

Descartado en MVP:
- Schema-per-tenant: complica migraciones (N esquemas que actualizar). Considerar en V2 para tenants enterprise.
- DB-per-tenant: sobrecosto operativo no justificado en MVP.

### 1.2 Tablas globales vs tenant-scoped

Globales (sin `tenant_id`):
- `tenants`
- `tenant_signup_requests`
- `plans`
- `super_admins`
- `provisioning_log`
- `system_audit_log`

Tenant-scoped (anadir `tenant_id NOT NULL` + index + RLS):
- `users` (todos los usuarios de aplicacion)
- `roles`, `permissions`
- Todas las tablas de Drop Scan: `guias`, `tarimas`, `escaneos`, `operadores`, `dropscan_config`, etc.
- Todas las tablas de Inventory y FEP (aunque no se vendan, deben quedar aisladas).
- Audit log de tenant.

### 1.3 Identificacion del tenant en cada request

Opciones evaluadas:
- Subdominio (`acme.kerion.app`): mejor UX, requiere DNS wildcard.
- Path prefix (`kerion.app/t/acme`): mas simple, sin DNS especial.
- Header / token claim: el JWT del usuario lleva `tenant_id` como claim.

Decision MVP: **JWT claim `tenant_id`**. URL puede ser unica para todos. Subdominio se anade en V2 cuando branding por cliente sea relevante.

Login: el endpoint `/api/auth/login` acepta `email + password`. El backend resuelve `tenant_id` via la tabla `users` (email es unico globalmente o unico por tenant — decidir: **unico por tenant** para evitar colisiones entre clientes; el form de login pide tambien slug del tenant o el email es resuelto por dominio del email).

Recomendacion concreta MVP: en el login el usuario ingresa `slug_tenant + email + password`. Slug se obtiene del email de bienvenida. Mas simple que multi-step y permite tenants con mismos emails.

---

## FASE 2 — MODELO DE DATOS

Migracion `020_multitenant_base.sql`:

### 2.1 Tablas nuevas

```
tenants
  id uuid pk
  slug text unique not null            -- usado en URL/login
  legal_name text
  contact_name text
  contact_email text not null
  contact_phone text
  country text
  status text not null                 -- pending|rejected|trial|trial_expired|active|expired|suspended
  trial_started_at timestamptz
  trial_expires_at timestamptz
  current_plan_id uuid fk -> plans
  subscription_expires_at timestamptz
  created_at, updated_at, approved_at, rejected_at, rejected_reason

tenant_signup_requests
  id uuid pk
  organization_name, contact_name, contact_email, contact_phone, country
  raw_payload jsonb
  status text                          -- pending|approved|rejected
  reviewed_by uuid fk -> super_admins
  reviewed_at, rejected_reason
  resulting_tenant_id uuid fk -> tenants
  created_at

plans
  id uuid pk
  code text unique                     -- trial_7d, basic, pro
  name, description
  modules jsonb                        -- ["dropscan"] en MVP
  duration_days int                    -- null = recurrente
  price_amount, price_currency
  is_active bool
  created_at, updated_at

subscriptions
  id uuid pk
  tenant_id uuid fk -> tenants
  plan_id uuid fk -> plans
  status text                          -- active|expired|cancelled
  started_at, expires_at
  payment_reference text               -- nota manual del super admin
  recorded_by uuid fk -> super_admins
  created_at

super_admins
  id uuid pk
  email unique, password_hash
  name, is_active
  created_at, last_login_at

provisioning_log
  id uuid pk
  tenant_id uuid fk -> tenants
  step text                            -- create_tenant_record|create_admin_user|seed_config|send_welcome_email
  status text                          -- ok|failed
  error_message text
  payload jsonb
  created_at

notifications_outbox
  id uuid pk
  tenant_id uuid nullable
  recipient_email text
  template_code text                   -- request_received|request_rejected|welcome|trial_5d_warning|trial_expired|subscription_active
  payload jsonb
  status text                          -- pending|sent|failed
  attempts int default 0
  sent_at, last_error
  created_at
```

### 2.2 Modificacion de tablas existentes

Para cada tabla tenant-scoped (script generado leyendo `information_schema`):

```
ALTER TABLE <t> ADD COLUMN tenant_id uuid;
-- Backfill: asignar todas las filas existentes al tenant "legacy" (ver 2.3)
UPDATE <t> SET tenant_id = '<legacy_uuid>';
ALTER TABLE <t> ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE <t> ADD CONSTRAINT fk_<t>_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
CREATE INDEX idx_<t>_tenant ON <t>(tenant_id);
```

Reescribir indices existentes: cualquier indice unico que asuma globalidad debe pasar a `(tenant_id, ...)`. Ejemplo: `users.email` debe ser unique sobre `(tenant_id, email)`.

### 2.3 Tenant legacy

- Crear un tenant `legacy` con todos los datos actuales para no romper produccion.
- Status: `active`, plan custom, sin expiracion.
- Migrar la cuenta actual del cliente real (si existe) a este tenant.

### 2.4 Row Level Security (Supabase)

- Activar RLS en cada tabla tenant-scoped.
- Policy estandar: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
- Backend hace `SET LOCAL app.tenant_id = '<tid>'` al inicio de cada transaccion (o al obtener conexion del pool).
- Tablas globales: RLS desactivado o policies que permiten solo a super admin.

### 2.5 Estados del tenant (maquina)

```
pending --(approve)--> trial --(7d)--> trial_expired
pending --(reject)---> rejected
trial --(subscription)--> active
active --(expire)--> expired
* --(admin)--> suspended
```

---

## FASE 3 — MOTOR DE PROVISIONING

Servicio backend `provisioningService.js`. Idempotente, transaccional por paso, rollback si paso critico falla.

### 3.1 Pasos del provisioning (ejecucion en orden)

1. `create_tenant_record`: insert en `tenants`, status=`trial`, slug autogenerado desde org name (validar unicidad).
2. `create_admin_user`: usuario con rol `tenant_admin`, password aleatorio fuerte, flag `must_change_password=true`.
3. `seed_default_config`: insertar registros minimos en `dropscan_config` y permisos para que el modulo funcione al primer login.
4. `assign_trial_plan`: insert en `subscriptions` con plan `trial_7d`, fechas calculadas.
5. `enqueue_welcome_email`: insertar en `notifications_outbox` template `welcome` con credenciales.
6. `mark_request_approved`: actualizar `tenant_signup_requests`.

Cada paso registra en `provisioning_log`. Si un paso falla:
- Reintentos: 3 con backoff (solo pasos idempotentes).
- Si tras reintentos falla: marcar tenant `status=pending` + alerta al super admin. NO dejar tenant en estado inconsistente.

### 3.2 Idempotencia

- `create_tenant_record`: si ya existe tenant con ese signup_request_id, saltar.
- `create_admin_user`: lookup por email + tenant_id antes de insertar.
- `seed_default_config`: `INSERT ... ON CONFLICT DO NOTHING`.
- `enqueue_welcome_email`: chequear `notifications_outbox` por `tenant_id + template_code` antes.

### 3.3 Endpoint de aprobacion

`POST /api/admin/signup-requests/:id/approve`
- Auth: super admin only.
- Validacion: request en status `pending`.
- Ejecuta motor de provisioning sincrono (debe completar en <5s).
- Devuelve `tenant_id` y resumen del log.

`POST /api/admin/signup-requests/:id/reject`
- Recibe `reason`.
- Encola email `request_rejected`.

---

## FASE 4 — SISTEMA DE NOTIFICACIONES

### 4.1 Outbox pattern

- Toda notificacion se inserta en `notifications_outbox` desde la transaccion del evento de negocio.
- Worker separado (cron job o setInterval) procesa pending cada 30s.
- Reintentos con backoff exponencial. Tras 5 fallos: status `failed`, alerta al super admin.

### 4.2 Templates necesarios MVP

- `request_received` -> al solicitante tras envio del form.
- `request_rejected` -> al solicitante con motivo.
- `welcome` -> al solicitante con `slug_tenant`, email admin, password temporal, URL de login.
- `trial_5d_warning` -> al admin del tenant (dia 5 del trial).
- `trial_expired` -> al admin del tenant.
- `subscription_activated` -> al admin del tenant cuando super admin registra pago.

Notificaciones internas (super admin, tabla `notifications_outbox` con `recipient_email = SUPER_ADMIN_EMAIL`):
- `new_signup_request`
- `tenant_provisioning_failed`
- `tenant_trial_expired_no_conversion`

### 4.3 Provider

MVP: SMTP via Resend, SendGrid o equivalente. Configurar via env. Plantillas HTML simples en `backend/src/services/email/templates/`.

### 4.4 Job de ciclo de vida

Cron `lifecycleScheduler.js` corre cada hora:
- Tenants en `trial` con `trial_expires_at - now <= 2d` y sin notificacion `trial_5d_warning` enviada -> encolar.
- Tenants en `trial` con `trial_expires_at <= now` -> mover a `trial_expired`, encolar email + alerta interna.
- Tenants en `active` con `subscription_expires_at <= now` -> mover a `expired`.

---

## FASE 5 — MIDDLEWARE Y AUTH

### 5.1 Login flow

`POST /api/auth/login` recibe `{ tenant_slug, email, password }`:
1. Resolver tenant por slug. Si no existe -> 404 generico.
2. Validar status: `trial`, `active` -> ok. `trial_expired`, `expired` -> permitir login pero con flag `read_only=true`. `suspended`, `rejected` -> 403 con mensaje claro.
3. Validar credenciales contra `users` filtrando por `tenant_id`.
4. Emitir JWT con claims: `user_id`, `tenant_id`, `role`, `must_change_password`, `tenant_status`.

### 5.2 Middleware tenant context

`tenantContext.js` (aplicado a todas las rutas /api/* excepto /api/auth, /api/public, /api/admin):
- Extrae `tenant_id` del JWT.
- Setea `req.tenantId`.
- Abre conexion DB y ejecuta `SET LOCAL app.tenant_id = '<tid>'`.
- Si falta o token invalido -> 401.

### 5.3 Auditoria de queries

- Validacion en CI: ningun `SELECT/INSERT/UPDATE/DELETE` en codigo backend a tabla tenant-scoped sin `tenant_id` en WHERE (lint custom o code review estricto).
- RLS actua como red de seguridad si se escapa.

### 5.4 Cambio de password forzado

- Si `must_change_password=true`, frontend redirige a `/change-password` y bloquea acceso al resto.
- Endpoint `/api/auth/change-password` limpia el flag.

---

## FASE 6 — PANEL SUPER ADMIN

Aplicacion separada o ruta protegida `/super-admin/*` con auth independiente (tabla `super_admins`, JWT separado).

### 6.1 Vistas MVP

- Login super admin.
- Cola de solicitudes pendientes: tabla con boton aprobar/rechazar inline. Modal de rechazo pide motivo.
- Listado de tenants: filtrable por status, con metricas basicas (usuarios, ultimo login).
- Detalle de tenant: datos, historico de suscripciones, log de provisioning, accion suspender/reactivar.
- Alta manual de suscripcion: form para registrar pago recibido (plan, fechas, referencia).
- Dashboard: contadores por estado + conversion trial->active de los ultimos 30 dias.
- Log de notificaciones (pendiente/enviado/fallado).

### 6.2 Seguridad

- Subdominio o path distinto (`/super-admin`) detras de auth dedicada.
- IP allowlist opcional (env).
- 2FA en V2; password fuerte + rotacion en MVP.
- Todo acceso queda en `system_audit_log`.

---

## FASE 7 — LANDING PAGE

MVP minimo:
- Pagina estatica o ruta publica `/` en frontend.
- Hero con propuesta de valor Drop Scan + CTA "Solicitar prueba 7 dias".
- Seccion breve de features (3-4 bullets).
- Form de solicitud: org name, contact name, email, phone, country.
- Footer con email de contacto.

`POST /api/public/signup-requests`:
- Rate limit estricto (5/h por IP).
- Validacion: email formato, dominio no en blacklist, no duplicado en `tenant_signup_requests` con status pending.
- Captcha (hCaptcha o Turnstile) — recomendado incluso en MVP para evitar spam.
- Crea registro pending + encola `request_received` + alerta super admin.

---

## FASE 8 — MODULOS Y SUSCRIPCION

### 8.1 Habilitacion por plan

- `plans.modules` lista codigos de modulos habilitados.
- Middleware `moduleGuard.js` valida que el modulo solicitado este en el plan activo del tenant. Si no, 403.
- Frontend lee modulos habilitados al login y oculta lo no contratado.

### 8.2 Trial expirado

- Tenants en `trial_expired` o `expired`: bloqueo de escritura (read_only). Permitir solo login + ver mensaje "renueva para continuar".

### 8.3 Estructura preparada para pasarela futura

- `subscriptions.payment_reference` ahora manual; en V2 sera ID de pasarela.
- Anadir tabla `payments` en V2 sin romper schema actual.

---

## FASE 9 — SEGURIDAD

- RLS en todas las tablas tenant-scoped.
- Lint/pre-commit que detecte queries sin `tenant_id`.
- Tests automatizados que crean 2 tenants y verifican que tenant A no ve datos de tenant B (en cada endpoint critico).
- Hash de passwords con bcrypt cost >= 12.
- Generacion de password inicial: 16 chars, alfanumericos + simbolos.
- Logs nunca incluyen passwords ni JWT completos.
- Backups encriptados.

---

## SECUENCIA DE IMPLEMENTACION POR DEPENDENCIA

1. FASE 0 completa (sistema estable, sin bugs criticos).
2. FASE 1: documentar decision arquitectura, validar con stakeholder.
3. FASE 2.1 + 2.2 + 2.3: migracion DB con tenant legacy. Sistema sigue operando como single-tenant pero ya esta multi-tenant-ready.
4. FASE 5: middleware tenant context + JWT con tenant_id. Refactor de queries para usar `req.tenantId`.
5. FASE 2.4: activar RLS. Tests cruzados.
6. FASE 4 outbox + email provider configurado.
7. FASE 3: motor de provisioning + endpoint aprobacion.
8. FASE 6: panel super admin (login + cola solicitudes + listado).
9. FASE 7: landing + form publico.
10. FASE 8: module guard + estados de trial/expired.
11. FASE 4.4: cron de ciclo de vida.
12. FASE 6 completa (suscripciones manuales + dashboard).
13. Hardening + tests E2E multi-tenant + go-live.

---

## RIESGOS Y MITIGACIONES

- Backfill mal hecho de `tenant_id`: hacer en staging primero, snapshot DB antes, validar conteos por tabla.
- RLS rompe queries existentes: activar RLS por tabla incrementalmente, no en bloque.
- Email no llega (welcome con credenciales): reintentos + alerta a super admin + UI para reenviar manualmente.
- Slug colisiona: generar con sufijo aleatorio si choque.
- Super admin se bloquea: dejar mecanismo de reset via CLI directo a DB.
- Provisioning falla a mitad: idempotencia + rollback + alerta.
- Tenant ve datos de otro: RLS + middleware + tests cruzados obligatorios antes de cada deploy.

---

## COMPLEJIDAD ESTIMADA POR COMPONENTE

- FASE 0 (estabilizacion): media. 2-4 dias.
- FASE 2 (schema + migracion + RLS): alta. 3-5 dias. Critico no equivocarse.
- FASE 5 (auth + middleware): media-alta. 2-3 dias.
- FASE 3 (provisioning): media. 2 dias.
- FASE 4 (notificaciones): media. 2 dias.
- FASE 6 (panel super admin): media. 3-4 dias.
- FASE 7 (landing): baja. 1 dia.
- FASE 8 (module guard + estados): baja-media. 1-2 dias.
- Hardening + tests cruzados + go-live: 2-3 dias.

Total MVP estimado: 18-26 dias de trabajo enfocado.

---

## DECISIONES PENDIENTES DE VALIDAR ANTES DE EMPEZAR

1. 
2. Confirmar identificacion por slug en login (vs subdominio o email global).  = rpta. subdominio
3. Confirmar provider de email (Resend, SendGrid, SES, Brevo). = rpta. el mejor sugerido del mercaod considernado costos y facilidad de implementacion
4. Confirmar URL del panel super admin (subdominio o path). = rpta. subdominio admin
5. Confirmar si en MVP se incluye captcha en form publico. = rpta. lo mas prudente o sugerido profesional
6. Confirmar nombre legal y dominio comercial del producto = rpta. aun no compro dominio principal sugerir si es necesairo para implementacion si lo es entocnes se procede compra
7. Confirmar planes y precios iniciales (aunque el cobro sea manual). = rpta. precio mensual 188 USD mes 
8. Confirmar plataforma de hosting del backend en produccion. = rpta. vercel o sugerir lo mejor 

---

FIN DEL PLAN
