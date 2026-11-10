// Pure logic (no app imports) so it is unit-testable. See pesoClient.js for wiring.

export const PESO_QUEUE_TYPE = 'dropscan_peso_update'
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [500, 1500]
const DRAIN_DELAYS_MS = [5000, 15000, 30000, 60000]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Network failures, timeouts, 429 and 5xx are transient; other 4xx are final. */
export function isRetryablePesoError(err) {
  const status = err?.response?.status
  if (!status) return true
  return status === 429 || status >= 500
}

/**
 * Saves a guia weight without ever dropping it:
 *   'saved'    stored on the server
 *   'queued'   kept in the persistent offline queue, replayed automatically
 *   'rejected' server definitively refused it (guia/session gone, invalid value)
 */
export async function saveGuiaPesoResilient(
  { sessionId, guiaId, pesoKg },
  deps = {}
) {
  const { send, enqueue, isOffline } = deps
  const wait = deps.sleep || sleep
  const queueItem = { type: PESO_QUEUE_TYPE, payload: { sessionId, guiaId, pesoKg } }

  if (isOffline()) {
    enqueue(queueItem)
    return 'queued'
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await send(sessionId, guiaId, pesoKg)
      return 'saved'
    } catch (err) {
      if (!isRetryablePesoError(err)) return 'rejected'
      if (attempt < MAX_ATTEMPTS - 1) await wait(RETRY_DELAYS_MS[attempt] ?? 1500)
    }
  }

  enqueue(queueItem)
  return 'queued'
}

/** True when a weight for this guia is already waiting in the persistent queue. */
export function hasQueuedPeso(getState, guiaId) {
  return getState().moduleQueue.some(
    (i) => i.type === PESO_QUEUE_TYPE && String(i.payload?.guiaId) === String(guiaId)
  )
}

let drainTimer = null
let drainAttempt = 0

/**
 * While queued weights exist and the app is online, keep retrying their sync
 * with growing delays (the connection banner only syncs on status changes,
 * which never fire for a transient 503 while status stays 'online').
 */
export function scheduleWeightDrain(getState, runSync) {
  if (drainTimer) return
  const pending = () => getState().moduleQueue.some((i) => i.type === PESO_QUEUE_TYPE)
  if (!pending()) { drainAttempt = 0; return }
  const delay = DRAIN_DELAYS_MS[Math.min(drainAttempt, DRAIN_DELAYS_MS.length - 1)]
  drainTimer = setTimeout(async () => {
    drainTimer = null
    drainAttempt += 1
    if (getState().status === 'online') {
      try { await runSync() } catch { /* retried on next tick */ }
    }
    scheduleWeightDrain(getState, runSync)
  }, delay)
}
