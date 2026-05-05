-- Migration 022: Row Level Security policies for all tenant-scoped tables
-- PREREQ: Migration 021 must be applied.
-- Uses current_setting('app.tenant_id', true) — the second arg (true) returns NULL
-- instead of throwing if the setting is not set (allows super_admin queries to bypass).
-- Backend sets this via SET LOCAL inside every tenant transaction.

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON roles;
CREATE POLICY tenant_isolation ON roles
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON usuarios;
CREATE POLICY tenant_isolation ON usuarios
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE configuraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON configuraciones;
CREATE POLICY tenant_isolation ON configuraciones
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE tarimas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarimas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tarimas;
CREATE POLICY tenant_isolation ON tarimas
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE guias ENABLE ROW LEVEL SECURITY;
ALTER TABLE guias FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON guias;
CREATE POLICY tenant_isolation ON guias
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE sesiones_escaneo ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_escaneo FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sesiones_escaneo;
CREATE POLICY tenant_isolation ON sesiones_escaneo
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE alertas_duplicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_duplicados FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON alertas_duplicados;
CREATE POLICY tenant_isolation ON alertas_duplicados
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE usuarios_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_internos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON usuarios_internos;
CREATE POLICY tenant_isolation ON usuarios_internos
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE logs_usuarios_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_usuarios_internos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON logs_usuarios_internos;
CREATE POLICY tenant_isolation ON logs_usuarios_internos
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE wms_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_credentials FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON wms_credentials;
CREATE POLICY tenant_isolation ON wms_credentials
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE wms_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_cache FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON wms_cache;
CREATE POLICY tenant_isolation ON wms_cache
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON inventory_sessions;
CREATE POLICY tenant_isolation ON inventory_sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE inventory_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_scans FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON inventory_scans;
CREATE POLICY tenant_isolation ON inventory_scans
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE folios_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE folios_entrega FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON folios_entrega;
CREATE POLICY tenant_isolation ON folios_entrega
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE folios_entrega_tarimas ENABLE ROW LEVEL SECURITY;
ALTER TABLE folios_entrega_tarimas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON folios_entrega_tarimas;
CREATE POLICY tenant_isolation ON folios_entrega_tarimas
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE folios_entrega_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE folios_entrega_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON folios_entrega_log;
CREATE POLICY tenant_isolation ON folios_entrega_log
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Global tables — no RLS (accessible by backend without tenant context)
-- tenants, tenant_signup_requests, plans, subscriptions, super_admins,
-- provisioning_log, notifications_outbox, system_audit_log, token_blacklist, audit_log
-- These are accessed only from authenticated admin routes or system services.
