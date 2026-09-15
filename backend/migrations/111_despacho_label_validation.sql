-- Migration 111: Despacho — relabel (etiquetado) validation

-- Enable "new label required" validation mode on folios. Defaults to true
-- for every destination — operators opt out per folio, not per client.
ALTER TABLE dispatch_folios
  ADD COLUMN IF NOT EXISTS validar_etiquetado BOOLEAN NOT NULL DEFAULT true;

-- Traceability of the relabel: which old-label code was scanned first, and
-- whether this box actually went through the two-scan relabel flow (as
-- opposed to a box that matched the new label directly, or a forced entry
-- that bypassed the control entirely).
ALTER TABLE dispatch_order_scans
  ADD COLUMN IF NOT EXISTS codigo_caja_previo TEXT,
  ADD COLUMN IF NOT EXISTS reetiquetado BOOLEAN NOT NULL DEFAULT false;

INSERT INTO schema_migrations (version, description)
VALUES ('111', 'despacho_label_validation')
ON CONFLICT (version) DO NOTHING;
