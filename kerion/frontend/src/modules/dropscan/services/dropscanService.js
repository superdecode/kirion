import api from '../../../core/services/api'

// Sessions
export const startSession = (empresa_id, canal_id) =>
  api.post('/dropscan/sessions/start', { empresa_id, canal_id }).then(r => r.data)

export const getActiveSession = () =>
  api.get('/dropscan/sessions/active').then(r => r.data)

export const scanGuia = (sessionId, codigo_guia, tarima_id = null) =>
  api.post(`/dropscan/sessions/${sessionId}/scan`, { codigo_guia, tarima_id }).then(r => r.data)

export const endSession = (sessionId) =>
  api.post(`/dropscan/sessions/${sessionId}/end`).then(r => r.data)

// Multi-tarima support
export const addTarima = (sessionId) =>
  api.post(`/dropscan/sessions/${sessionId}/add-tarima`).then(r => r.data)

export const switchTarima = (sessionId, tarima_id) =>
  api.post(`/dropscan/sessions/${sessionId}/switch-tarima`, { tarima_id }).then(r => r.data)

export const deleteGuia = (sessionId, guiaId) =>
  api.delete(`/dropscan/sessions/${sessionId}/guia/${guiaId}`).then(r => r.data)

// Tarimas
export const getTarimas = (params) =>
  api.get('/dropscan/tarimas', { params }).then(r => r.data)

export const getTarimaDetail = (id) =>
  api.get(`/dropscan/tarimas/${id}`).then(r => r.data)

export const getTarimaDuplicados = (id) =>
  api.get(`/dropscan/tarimas/${id}/duplicados`).then(r => r.data)

export const finalizeTarima = (id) =>
  api.post(`/dropscan/tarimas/${id}/finalize`).then(r => r.data)

export const cancelTarima = (id, razon) =>
  api.post(`/dropscan/tarimas/${id}/cancel`, { razon }).then(r => r.data)

export const reopenTarima = (id) =>
  api.post(`/dropscan/tarimas/${id}/reopen`).then(r => r.data)

export const deleteTarima = (id) =>
  api.delete(`/dropscan/tarimas/${id}`).then(r => r.data)

// Dashboard & Metrics
export const getDashboard = () =>
  api.get('/dropscan/dashboard').then(r => r.data)

export const getMetrics = (fecha_inicio, fecha_fin, empresa_id, canal_id) => {
  const params = { fecha_inicio, fecha_fin }
  if (empresa_id) params.empresa_id = Array.isArray(empresa_id) ? empresa_id.join(',') : empresa_id
  if (canal_id) params.canal_id = Array.isArray(canal_id) ? canal_id.join(',') : canal_id
  return api.get('/dropscan/dashboard/metrics', { params }).then(r => r.data)
}

export const searchGuias = (q) =>
  api.get('/dropscan/dashboard/guias/search', { params: { q } }).then(r => r.data)

// Config (used by Escaneo for session start dropdowns)
export const getEmpresas = () =>
  api.get('/config/dropscan/empresa').then(r => r.data)

export const getCanales = () =>
  api.get('/config/dropscan/canal').then(r => r.data)
