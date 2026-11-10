import { useOfflineStore } from '../../../core/stores/offlineStore'
import { updateGuiaPeso } from './dropscanService'
import { saveGuiaPesoResilient, hasQueuedPeso, scheduleWeightDrain } from './pesoSync'

const getState = () => useOfflineStore.getState()

/** Saves a weight; falls back to the persistent queue and schedules replay. */
export async function saveGuiaPeso({ sessionId, guiaId, pesoKg }, runSync) {
  const result = await saveGuiaPesoResilient(
    { sessionId, guiaId, pesoKg },
    {
      send: updateGuiaPeso,
      enqueue: (item) => getState().enqueueModule(item),
      isOffline: () => getState().status === 'offline',
    }
  )
  if (result === 'queued' && runSync) scheduleWeightDrain(getState, runSync)
  return result
}

export const isPesoQueued = (guiaId) => hasQueuedPeso(getState, guiaId)
export const startWeightDrain = (runSync) => scheduleWeightDrain(getState, runSync)
