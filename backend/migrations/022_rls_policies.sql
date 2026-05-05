-- Migration 022: Row Level Security policies for all tenant-scoped tables
-- PREREQ: Migration 021 must be applied.
-- Uses current_setting('app.tenant_id', true) — the second arg (true) returns NULL
-- instead of throwing if the setting is not set (allows super_admin queries to bypass).
-- Backend sets this via SET LOCAL inside every tenant transaction.

-- Helper: enable RLS and create standard tenant policy for a table
-- Run this block for each tenant-scoped table.

-- ── roles ──────────────────────────────────────────────────────────────────────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON roles;
CREATE POLICY tenant_isolation ON roles
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── usuarios ───────────────────────────────────────────────────────────────────
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON usuarios;
CREATE POLICY tenant_isolation ON usuarios
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── configuraciones ───────────────────────────────────────────────────────────
ALTER TABLE configuraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON configuraciones;
CREATE POLICY tenant_isolation ON configuraciones
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── tarimas ───────────────────────────────────────────────────────────────────
ALTER TABLE tarimas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarimas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tarimas;
CREATE POLICY tenant_isolation ON tarimas
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── guias ─────────────────────────────────────────────────────────────────────
ALTER TABLE guias ENABLE ROW LEVEL SECURITY;
ALTER TABLE guias FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON guias;
CREATE POLICY tenant_isolation ON guias
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── sesiones_escaneo ──────────────────────────────────────────────────────────
ALTER TABLE sesiones_escaneo ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_escaneo FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON sesiones_escaneo;
CREATE POLICY tenant_isolation ON sesiones_escaneo
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── alertas_duplicados ────────────────────────────────────────────────────────
ALTER TABLE alertas_duplicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_duplicados FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON alertas_duplicados;
CREATE POLICY tenant_isolation ON alertas_duplicados
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── canales_escaneo ───────────────────────────────────────────────────────────
ALTER TABLE canales_escaneo ENABLE ROW LEVEL SECURITY;
ALTER TABLE canales_escaneo FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON canales_escaneo;
CREATE POLICY tenant_isolation ON canales_escaneo
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── empresas_paqueteria ───────────────────────────────────────────────────────
ALTER TABLE empresas_paqueteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas_paqueteria FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON empresas_paqueteria;
CREATE POLICY tenant_isolation ON empresas_paqueteria
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── usuarios_internos ─────────────────────────────────────────────────────────
ALTER TABLE usuarios_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_internos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON usuarios_internos;
CREATE POLICY tenant_isolation ON usuarios_internos
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── logs_usuarios_internos ────────────────────────────────────────────────────
ALTER TABLE logs_usuarios_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_usuarios_internos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON logs_usuarios_internos;
CREATE POLICY tenant_isolation ON logs_usuarios_internos
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── wms_credentials ───────────────────────────────────────────────────────────
ALTER TABLE wms_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON wms_credentials;
CREATE POLICY tenant_isolation ON wms_credentials
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── inventory_sessions ────────────────────────────────────────────────────────
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON inventory_sessions;
CREATE POLICY tenant_isolation ON inventory_sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── inventory_scans ───────────────────────────────────────────────────────────
ALTER TABLE inventory_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_scans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON inventory_scans;
CREATE POLICY tenant_isolation ON inventory_scans
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── folios_fep ────────────────────────────────────────────────────────────────
ALTER TABLE folios_fep ENABLE ROW LEVEL SECURITY;
ALTER TABLE folios_fep FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON folios_fep;
CREATE POLICY tenant_isolation ON folios_fep
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── folios_fep_tarimas ────────────────────────────────────────────────────────
ALTER TABLE folios_fep_tarimas ENABLE ROW LEVEL SECURITY;
ALTER TABLE folios_fep_tarimas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON folios_fep_tarimas;
CREATE POLICY tenant_isolation ON folios_fep_tarimas
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Global tables — no RLS (accessible by backend without tenant context) ──────
-- tenants, tenant_signup_requests, plans, subscriptions, super_admins,
-- provisioning_log, notifications_outbox, system_audit_log, token_blacklist, audit_log
-- These are accessed only from authenticated admin routes or system services.

-- ── ROLLBACK SCRIPT ───────────────────────────────────────────────────────────
-- To disable RLS on all tenant tables (emergency rollback):
-- ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE configuraciones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tarimas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE guias DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sesiones_escaneo DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE alertas_duplicados DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE canales_escaneo DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE empresas_paqueteria DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE usuarios_internos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE logs_usuarios_internos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE wms_credentials DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory_sessions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory_scans DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE folios_fep DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE folios_fep_tarimas DISABLE ROW LEVEL SECURITY;
