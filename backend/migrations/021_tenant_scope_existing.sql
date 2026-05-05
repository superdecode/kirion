-- Migration 021: Add tenant_id to all existing tenant-scoped tables
-- PREREQ: Migration 020 must be applied and LEGACY_TENANT_UUID must be known.
-- Replace all occurrences of 'REPLACE_WITH_LEGACY_UUID' with the actual UUID
-- before running (or use a migration runner that supports variable substitution).
--
-- Safe to run multiple times (idempotent via IF NOT EXISTS / IF EXISTS checks).

-- ── 1. roles ──────────────────────────────────────────────────────────────────
ALTER TABLE roles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE roles SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE roles ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

-- Drop old unique constraint on nombre, replace with tenant-scoped one
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_nombre_key;
DROP INDEX IF EXISTS roles_nombre_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_tenant_nombre ON roles(tenant_id, nombre);

-- ── 2. usuarios ───────────────────────────────────────────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
UPDATE usuarios SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE usuarios ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);

-- Replace global unique indexes with tenant-scoped ones
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_codigo_key;
DROP INDEX IF EXISTS usuarios_email_key;
DROP INDEX IF EXISTS usuarios_codigo_key;
DROP INDEX IF EXISTS idx_usuarios_email;
DROP INDEX IF EXISTS idx_usuarios_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_tenant_email  ON usuarios(tenant_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_tenant_codigo ON usuarios(tenant_id, codigo);

-- ── 3. configuraciones ────────────────────────────────────────────────────────
ALTER TABLE configuraciones ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE configuraciones SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE configuraciones ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_config_tenant ON configuraciones(tenant_id);

ALTER TABLE configuraciones DROP CONSTRAINT IF EXISTS configuraciones_modulo_tipo_codigo_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_config_tenant_unique
  ON configuraciones(tenant_id, modulo, tipo, codigo);

-- ── 4. tarimas ────────────────────────────────────────────────────────────────
ALTER TABLE tarimas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE tarimas SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE tarimas ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tarimas_tenant ON tarimas(tenant_id);

ALTER TABLE tarimas DROP CONSTRAINT IF EXISTS tarimas_codigo_key;
DROP INDEX IF EXISTS tarimas_codigo_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tarimas_tenant_codigo ON tarimas(tenant_id, codigo);

-- ── 5. guias ──────────────────────────────────────────────────────────────────
ALTER TABLE guias ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE guias SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE guias ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guias_tenant ON guias(tenant_id);

-- ── 6. sesiones_escaneo ───────────────────────────────────────────────────────
ALTER TABLE sesiones_escaneo ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE sesiones_escaneo SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE sesiones_escaneo ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sesiones_tenant ON sesiones_escaneo(tenant_id);

-- ── 7. alertas_duplicados ─────────────────────────────────────────────────────
ALTER TABLE alertas_duplicados ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE alertas_duplicados SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE alertas_duplicados ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alertas_tenant ON alertas_duplicados(tenant_id);

-- ── 8. canales_escaneo ────────────────────────────────────────────────────────
ALTER TABLE canales_escaneo ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE canales_escaneo SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE canales_escaneo ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_canales_tenant ON canales_escaneo(tenant_id);

-- Rebuild partial unique index with tenant scope
DROP INDEX IF EXISTS idx_canales_escaneo_unique_default;
CREATE UNIQUE INDEX IF NOT EXISTS idx_canales_tenant_unique_default
  ON canales_escaneo(tenant_id) WHERE es_default = true;
ALTER TABLE canales_escaneo DROP CONSTRAINT IF EXISTS canales_escaneo_nombre_key;
DROP INDEX IF EXISTS canales_escaneo_nombre_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_canales_tenant_nombre
  ON canales_escaneo(tenant_id, nombre);

-- ── 9. empresas_paqueteria ────────────────────────────────────────────────────
ALTER TABLE empresas_paqueteria ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE empresas_paqueteria SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE empresas_paqueteria ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_empresas_tenant ON empresas_paqueteria(tenant_id);

ALTER TABLE empresas_paqueteria DROP CONSTRAINT IF EXISTS empresas_paqueteria_nombre_key;
ALTER TABLE empresas_paqueteria DROP CONSTRAINT IF EXISTS empresas_paqueteria_codigo_key;
DROP INDEX IF EXISTS empresas_paqueteria_nombre_key;
DROP INDEX IF EXISTS empresas_paqueteria_codigo_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_tenant_nombre ON empresas_paqueteria(tenant_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_tenant_codigo ON empresas_paqueteria(tenant_id, codigo);

-- ── 10. usuarios_internos ──────────────────────────────────────────────────────
ALTER TABLE usuarios_internos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE usuarios_internos SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE usuarios_internos ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ui_tenant ON usuarios_internos(tenant_id);

DROP INDEX IF EXISTS idx_usuarios_internos_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ui_tenant_nombre
  ON usuarios_internos(tenant_id, nombre) WHERE eliminado = false;

-- ── 11. logs_usuarios_internos ────────────────────────────────────────────────
ALTER TABLE logs_usuarios_internos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE logs_usuarios_internos SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE logs_usuarios_internos ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logs_ui_tenant ON logs_usuarios_internos(tenant_id);

-- ── 12. token_blacklist — add optional tenant_id (global table, no RLS) ────────
ALTER TABLE token_blacklist ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE token_blacklist SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;

-- ── 13. audit_log — add optional tenant_id ────────────────────────────────────
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE audit_log SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);

-- ── 14. wms_credentials ───────────────────────────────────────────────────────
ALTER TABLE wms_credentials ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE wms_credentials SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE wms_credentials ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wms_creds_tenant ON wms_credentials(tenant_id);

-- ── 15. wms_cache ─────────────────────────────────────────────────────────────
-- wms_cache uses TEXT primary key; add tenant_id prefix to key or add column
ALTER TABLE wms_cache ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE wms_cache SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE wms_cache ALTER COLUMN tenant_id SET NOT NULL;

-- ── 16. inventory_sessions ────────────────────────────────────────────────────
ALTER TABLE inventory_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE inventory_sessions SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE inventory_sessions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_sessions_tenant ON inventory_sessions(tenant_id);

-- ── 17. inventory_scans ───────────────────────────────────────────────────────
ALTER TABLE inventory_scans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE inventory_scans SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE inventory_scans ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_scans_tenant ON inventory_scans(tenant_id);

-- ── 18. folios_fep ────────────────────────────────────────────────────────────
ALTER TABLE folios_fep ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE folios_fep SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE folios_fep ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folios_fep_tenant ON folios_fep(tenant_id);

-- Folio number uniqueness is now per-tenant
ALTER TABLE folios_fep DROP CONSTRAINT IF EXISTS folios_fep_folio_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_folios_fep_tenant_folio ON folios_fep(tenant_id, folio);

-- ── 19. folios_fep_tarimas ────────────────────────────────────────────────────
ALTER TABLE folios_fep_tarimas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE folios_fep_tarimas SET tenant_id = 'REPLACE_WITH_LEGACY_UUID' WHERE tenant_id IS NULL;
ALTER TABLE folios_fep_tarimas ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folios_fep_tarimas_tenant ON folios_fep_tarimas(tenant_id);

-- ── 20. Update views to include tenant context ─────────────────────────────────
-- Views are recreated without tenant filter — the RLS policy on underlying tables
-- will filter rows automatically when app.tenant_id is set.
-- No view changes required.
