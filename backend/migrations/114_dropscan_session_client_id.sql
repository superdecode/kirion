-- Migration 114: DropScan — idempotency key for session start (offline replay support)

-- Lets the frontend safely replay a queued offline "start session" action:
-- if a session was already created with this client_start_id (e.g. the
-- original response was lost but the write went through), the server
-- returns the existing session/tarima instead of creating a duplicate one.
ALTER TABLE sesiones_escaneo
  ADD COLUMN IF NOT EXISTS client_start_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sesiones_escaneo_client_start_id
  ON sesiones_escaneo(tenant_id, operador_id, client_start_id)
  WHERE client_start_id IS NOT NULL;

INSERT INTO schema_migrations (version, description)
VALUES ('114', 'dropscan_session_client_id')
ON CONFLICT (version) DO NOTHING;
