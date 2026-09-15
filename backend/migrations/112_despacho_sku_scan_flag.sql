-- Migration 112: Despacho — flag SKU-cascade scans so they don't count as boxes

-- A scan chained after the SKU gate (internal product-label validation) documents
-- the same physical box as the scan right before it — it's a reference record, not
-- an extra box. Flagged explicitly (same pattern as reetiquetado) so bultos/progress
-- counts can exclude it.
ALTER TABLE dispatch_order_scans
  ADD COLUMN IF NOT EXISTS es_sku BOOLEAN NOT NULL DEFAULT false;

INSERT INTO schema_migrations (version, description)
VALUES ('112', 'despacho_sku_scan_flag')
ON CONFLICT (version) DO NOTHING;
