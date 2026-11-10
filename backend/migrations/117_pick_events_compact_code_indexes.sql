-- Migration 117: Expression indexes for exact Rastreo search over pick_events
--
-- GET /rastreo/buscar (mode=exact) matches pick_events by the "compact" code:
--   REGEXP_REPLACE(UPPER(COALESCE(col, '')), '[^A-Z0-9]', '', 'g') = $3
-- No index covered that expression (the trigram indexes from 114 only serve
-- ILIKE on the raw column), so every search was a parallel seq scan of
-- pick_events plus a sort, about 10.6s on the Micro instance. Concurrent searches
-- like that saturate CPU/IO and kill client connections ("could not send data to
-- client: Broken pipe").
--
-- The expressions below must stay textually identical to compactExpr() in
-- backend/src/modules/inventory/routes/rastreo.routes.js, or the planner won't use them.
--
-- Plain CREATE INDEX because scripts/run-migration.js wraps each file in a
-- transaction. To avoid blocking writes to pick_events while building, run the
-- CONCURRENTLY version by hand in the SQL Editor first. IF NOT EXISTS then turns
-- this into a no-op.

CREATE INDEX IF NOT EXISTS idx_pick_events_scanned_compact
  ON pick_events ((REGEXP_REPLACE(UPPER(COALESCE(scanned_code, '')), '[^A-Z0-9]', '', 'g')));

CREATE INDEX IF NOT EXISTS idx_pick_events_normalized_compact
  ON pick_events ((REGEXP_REPLACE(UPPER(COALESCE(normalized_code, '')), '[^A-Z0-9]', '', 'g')));

CREATE INDEX IF NOT EXISTS idx_pick_events_box_type_compact
  ON pick_events ((REGEXP_REPLACE(UPPER(COALESCE(matched_box_type, '')), '[^A-Z0-9]', '', 'g')));

CREATE INDEX IF NOT EXISTS idx_pick_sessions_order_compact
  ON pick_sessions (tenant_id, (REGEXP_REPLACE(UPPER(COALESCE(outbound_order_no, '')), '[^A-Z0-9]', '', 'g')));

ANALYZE pick_events;
ANALYZE pick_sessions;
