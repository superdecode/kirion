import { useSurtidoStore } from '../stores/surtidoStore'
import { useOfflineStore } from '../../../core/stores/offlineStore'
import { createScanSession, updateScanSession, addScanEvent, addManualScanEvent } from './surtidoService'

/**
 * Replays Surtido's offline validation queue (scans, manual entries, ubicacion
 * updates, session closes, and offline-created sessions).
 *
 * This used to live only inside Validacion.jsx's own 30s interval, which meant
 * queued items stopped retrying the moment the operator navigated away from that
 * screen — the app-wide connection banner knew nothing about this queue (it only
 * drives the generic offline/module queues used by the other modules), so a scan
 * that failed once could sit unsynced indefinitely if the operator moved on to a
 * different order before it cleared. Both Validacion.jsx's interval and the
 * app-wide ConnectionBanner now call this single function, sharing one
 * module-level lock so they never run concurrently.
 *
 * onSessionRemap(tempId, realId) is called whenever an offline-created session's
 * temp id gets replaced by its real server id, so a mounted Validacion.jsx can
 * update its own local sessionId state to match.
 */

function replayPendingValidation(item) {
  if (item.kind === 'create_session') return createScanSession(item.payload.body)
  if (item.kind === 'manual') return addManualScanEvent(item.payload)
  if (item.kind === 'ubicacion' || item.kind === 'finalize') {
    return updateScanSession(item.payload.id, item.payload.body)
  }
  return addScanEvent(item.payload)
}

function isPermanentSyncError(error) {
  const status = error?.response?.status
  // 401/403 mean the request was rejected by auth/permission middleware, not that
  // the payload itself is invalid — treating them as permanent silently discarded
  // real scans from the offline replay queue whenever a token/tenant/permission
  // hiccup coincided with a sync attempt. Keep retrying those like network errors
  // instead of marking the box as "processed" when it was never actually saved.
  return status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 408 && status !== 429
}

export function isOfflineSessionId(value) {
  return String(value ?? '').startsWith('offline-')
}

// A queued item still carrying a temp session id means its create_session never
// succeeded (it failed permanently and was dropped). Replaying it can only ever
// produce an error, which would otherwise be retried forever while blocking the
// rest of the FIFO queue.
function isOrphanedPendingItem(item) {
  if (item.kind === 'create_session') return false
  const sessionRef = item.kind === 'ubicacion' || item.kind === 'finalize'
    ? item.payload?.id
    : item.payload?.session_id
  return isOfflineSessionId(sessionRef)
}

let syncInProgress = false

export async function syncSurtidoPendingQueue(onSessionRemap) {
  const queue = useSurtidoStore.getState().pendingSync
  if (queue.length === 0 || syncInProgress || useOfflineStore.getState().status === 'offline') {
    return { synced: 0, pending: queue.length }
  }

  syncInProgress = true
  try {
    const processed = []
    // A close can fail faster than the last scan and reach the persisted queue
    // first. Always replay closes last while preserving FIFO within each group.
    const orderedQueue = [...queue].sort((a, b) =>
      Number(a.kind === 'finalize') - Number(b.kind === 'finalize'))
    for (const item of orderedQueue) {
      // Drop instead of replaying: its session was never created, so this can
      // never succeed and would otherwise block the queue permanently.
      if (isOrphanedPendingItem(item)) {
        processed.push(item.key)
        continue
      }
      try {
        const replayed = await replayPendingValidation(item)
        if (item.kind === 'create_session' && replayed?.data?.id) {
          for (const queued of orderedQueue) {
            if (String(queued.payload?.session_id) === String(item.tempSessionId)) {
              queued.payload = { ...queued.payload, session_id: replayed.data.id }
            }
          }
          useSurtidoStore.setState((state) => ({
            pendingSync: state.pendingSync.map((queued) => (
              String(queued.payload?.session_id) === String(item.tempSessionId)
                ? { ...queued, payload: { ...queued.payload, session_id: replayed.data.id } }
                : queued
            )),
          }))
          onSessionRemap?.(item.tempSessionId, replayed.data.id)
        }
        processed.push(item.key)
      } catch (error) {
        if (isPermanentSyncError(error)) {
          // A rejected/expired item can never succeed on retry. Remove it so it
          // cannot block later orders forever.
          processed.push(item.key)
          continue
        }
        // Network/5xx/429: preserve this item and everything after it to keep FIFO.
        break
      }
    }
    if (processed.length) useSurtidoStore.getState().markSynced(processed)
    return { synced: processed.length, pending: useSurtidoStore.getState().pendingSync.length }
  } finally {
    syncInProgress = false
  }
}
