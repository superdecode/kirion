-- Migration 116: Index inbound_scan_events.line_id (FK to inbound_lines)
--
-- inbound_scan_events.line_id REFERENCES inbound_lines(id), but no index leads with
-- line_id — the only one containing it is (tenant_id, order_id, line_id, scanned_at),
-- which Postgres can't use for the FK check's plain `WHERE line_id = $1`. Deleting
-- from inbound_lines makes Postgres verify, per deleted row, that no scan event still
-- references it; without this index each check is a full scan of inbound_scan_events
-- (190MB+). Deleting a large order (e.g. 1,717 lines) blew past the 12s statement
-- timeout, so DELETE /recepcion/orders/:id failed and the order couldn't be removed.
--
-- Plain CREATE INDEX because scripts/run-migration.js wraps each file in a
-- transaction (CONCURRENTLY can't run inside one). If this was already created
-- manually with CONCURRENTLY, IF NOT EXISTS makes this a no-op.

CREATE INDEX IF NOT EXISTS idx_inbound_scan_events_line_id
  ON inbound_scan_events(line_id)
  WHERE line_id IS NOT NULL;
