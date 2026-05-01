import api from './api'
import { useOfflineStore } from '../stores/offlineStore'

let syncInProgress = false

/**
 * Replays all queued offline scans in FIFO order.
 * Called automatically when the browser comes back online.
 * Returns { synced: number, failed: number, errors: string[] }
 */
export async function syncOfflineQueue() {
  const store = useOfflineStore.getState()
  if (syncInProgress || store.queue.length === 0) return { synced: 0, failed: 0, errors: [] }

  syncInProgress = true
  store.setSyncing(true)
  store.setSyncError(null)

  let synced = 0
  let failed = 0
  const errors = []

  // Process in order — each scan depends on server state from the previous one
  for (const item of [...store.queue]) {
    try {
      await api.post(`/dropscan/sessions/${item.sessionId}/scan`, {
        codigo_guia: item.codigo_guia,
        tarima_id: item.tarimaId,
      })
      store.dequeue(item.id)
      synced++
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      // DUPLICADO is not a real failure — the scan was already registered
      if (msg === 'DUPLICADO') {
        store.dequeue(item.id)
        synced++
      } else {
        failed++
        errors.push(`${item.codigo_guia}: ${msg}`)
        // Stop on first real failure to preserve order
        break
      }
    }
  }

  store.setSyncing(false)
  if (errors.length > 0) store.setSyncError(errors.join('; '))
  syncInProgress = false

  return { synced, failed, errors }
}
