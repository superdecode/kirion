-- Migration 011: backfill FEP permissions for existing roles
--
-- `gestion` is the module level that grants view, update, export, detail
-- access and delete for `fep.folios`; `total` stays reserved for super admin.

UPDATE roles
SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"total"}'::jsonb, true)
WHERE nombre = 'Administrador';

UPDATE roles
SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"gestion"}'::jsonb, true)
WHERE nombre = 'Jefe';

UPDATE roles
SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"lectura"}'::jsonb, true)
WHERE nombre = 'Operador';

UPDATE roles
SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"gestion"}'::jsonb, true)
WHERE nombre = 'Usuario';
