-- Stores the internal product SKU directly on the box's own scan record instead of
-- a separate cascaded scan row. Older rows created via the es_sku=true cascade
-- pattern keep working (still excluded from box counts) but new SKU scans write
-- here instead, so a single box only ever produces one scan record.
ALTER TABLE dispatch_order_scans
  ADD COLUMN IF NOT EXISTS sku_valor TEXT;

INSERT INTO schema_migrations (version, description)
VALUES ('113', 'despacho_scan_sku_valor')
ON CONFLICT (version) DO NOTHING;
