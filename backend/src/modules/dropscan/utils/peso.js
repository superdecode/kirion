import { isDatabaseUnavailableError } from '../../../config/database.js'

const PESO_MIN = 0.001
const PESO_MAX = 9999.999

/** Returns the weight as a number, or null when missing/invalid/out of range. */
export function parsePeso(value) {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n) || n < PESO_MIN || n > PESO_MAX) return null
  return n
}

/**
 * Persists a guia weight with ONE statement (one pool checkout). The session
 * ownership check is part of the UPDATE, and an already-ended session does not
 * block it (the weight belongs to the guia). Idempotent, so clients can retry.
 * Returns the updated row or null when no guia/session matched.
 */
export async function saveGuiaPeso(tQuery, { sessionId, guiaId, operadorId, tenantId, peso }) {
  const result = await tQuery(
    `UPDATE guias g SET peso_kg = $1
       FROM sesiones_escaneo s
      WHERE g.id = $2 AND g.tenant_id = $3
        AND s.id = $4 AND s.operador_id = $5 AND s.tenant_id = $3
      RETURNING g.id, g.peso_kg`,
    [peso, guiaId, tenantId, sessionId, operadorId]
  )
  return result.rows[0] || null
}

/** Transient DB failures become a retryable 503 instead of a generic 500. */
export function pesoErrorResponse(error) {
  if (isDatabaseUnavailableError(error)) {
    return {
      status: 503,
      retryAfterSeconds: 2,
      body: { error: 'Servidor ocupado, el peso se reintentara', code: 'DB_BUSY', retryable: true },
    }
  }
  return { status: 500, body: { error: 'Error guardando peso' } }
}
