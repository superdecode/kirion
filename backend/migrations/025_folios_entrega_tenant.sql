-- Add tenant_id to folios_entrega for multi-tenant isolation
ALTER TABLE folios_entrega ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Backfill: set tenant_id from the user who created the folio
UPDATE folios_entrega fe
SET tenant_id = u.tenant_id
FROM usuarios u
WHERE u.id = fe.creado_por
  AND fe.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fep_tenant ON folios_entrega(tenant_id);
