-- Migration 114: Trigram indexes for Rastreo free-text search (GET /api/rastreo/buscar)
-- and the ubicación lookup search.
--
-- Both queries OR together several match tiers, including a %...% ILIKE
-- ("partial") tier that no plain btree index can serve — Postgres falls
-- back to a full sequential scan for the whole predicate. Confirmed in
-- production Postgres logs: the pick_events search (168k+ rows) was taking
-- 10-24 SECONDS per call, holding a pool connection open the whole time.
-- Under a couple of concurrent Rastreo searches, that alone was enough to
-- exhaust the connection pool and surface as 503s across unrelated modules
-- (DropScan, Despacho, auth/me, etc.) — raising the pool size/compute tier
-- in Supabase raises the ceiling, but this query is what was generating
-- the pressure in the first place.
--
-- pg_trgm GIN indexes accelerate ILIKE '%...%' directly, without needing to
-- rewrite the existing query's match-tier logic.
--
-- Plain CREATE INDEX (not CONCURRENTLY) is used because this repo's
-- migration runner (scripts/run-migration.js) wraps every file in a single
-- transaction, and CONCURRENTLY cannot run inside one. These tables are
-- modest in size (pick_events ~170k rows at time of writing), so the brief
-- SHARE lock this takes (blocks writes to the table, not reads) should
-- complete in low single-digit seconds — still, prefer applying during a
-- quiet moment.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pick_events_scanned_code_trgm
  ON pick_events USING gin (scanned_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pick_events_normalized_code_trgm
  ON pick_events USING gin (normalized_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pick_events_matched_box_type_trgm
  ON pick_events USING gin (matched_box_type gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pick_sessions_outbound_order_no_trgm
  ON pick_sessions USING gin (outbound_order_no gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_dev_ubicaciones_codigo_trgm
  ON dev_ubicaciones USING gin (codigo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dev_ubicaciones_nombre_trgm
  ON dev_ubicaciones USING gin (nombre gin_trgm_ops);
