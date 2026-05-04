-- Migration 011: backfill FEP permissions for existing roles
--
-- `lectura` = ver, `escritura` = crear/imprimir, `gestion` = actualizar/exportar
-- and `total` = eliminar for `fep.folios`.

UPDATE roles
SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"total"}'::jsonb, true)
WHERE nombre = 'Administrador';

UPDATE roles
SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"gestion"}'::jsonb, true)
WHERE nombre IN ('Jefe', 'Supervisor');

UPDATE roles
SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"escritura"}'::jsonb, true)
WHERE nombre = 'Operador';

UPDATE roles
SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"lectura"}'::jsonb, true)
WHERE nombre = 'Usuario';
