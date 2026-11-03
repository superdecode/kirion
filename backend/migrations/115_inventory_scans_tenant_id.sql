-- Migration 115: Add tenant_id to inventory_scans (backfilled from session)
--
-- Migration 021 (tenant_scope_existing) added tenant_id to wms_credentials,
-- inventory_sessions and wms_cache, but never reached the next block in that
-- same file — inventory_scans — confirmed in production: inventory_sessions
-- has tenant_id, inventory_scans does not. The query that surfaced this
-- (usage.routes.js's monthly Inventario count, `WHERE tenant_id = $1` on
-- inventory_scans) has been failing with 42703 "column does not exist" on
-- every call, silently swallowed by its own .catch() fallback — Inventario
-- usage has been showing as 0 on the usage dashboard.
--
-- Unlike 021's own backfill (a single hardcoded "legacy tenant" UUID, only
-- correct at the single-tenant-to-multi-tenant cutover), this backfills each
-- row from its actual session's tenant_id — the same pattern already used
-- successfully for pick_events/inv_scans in migration 041. inventory_scans
-- .session_id is NOT NULL with ON DELETE CASCADE to inventory_sessions, so
-- every row has a real session backing it and the backfill is expected to
-- leave no row NULL before the NOT NULL constraint is applied.

ALTER TABLE inventory_scans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

UPDATE inventory_scans s
SET tenant_id = sess.tenant_id
FROM inventory_sessions sess
WHERE s.session_id = sess.id
  AND s.tenant_id IS NULL;

ALTER TABLE inventory_scans ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inv_scans_legacy_tenant ON inventory_scans(tenant_id);
