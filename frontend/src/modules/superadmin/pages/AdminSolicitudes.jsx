import { useEffect, useState } from 'react'
import adminApi from '../services/adminApi'

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }
const STATUS_COLORS = {
  pending: 'bg-yellow-900/40 text-yellow-300',
  approved: 'bg-green-900/40 text-green-300',
  rejected: 'bg-red-900/40 text-red-300',
}

function RejectModal({ request, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReject() {
    if (!reason.trim()) return setError('El motivo es requerido')
    setLoading(true)
    try {
      await adminApi.post(`/signup-requests/${request.id}/reject`, { reason })
      onDone()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al rechazar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-white font-medium mb-1">Rechazar solicitud</h3>
        <p className="text-gray-400 text-sm mb-4">{request.organization_name} — {request.contact_email}</p>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Motivo del rechazo..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-red-500 mb-4"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {loading ? 'Rechazando...' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminSolicitudes() {
  const [requests, setRequests] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function load() {
    setLoading(true)
    try {
      const res = await adminApi.get(`/signup-requests?status=${statusFilter}`)
      setRequests(res.data.data)
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  async function handleApprove(req) {
    if (!confirm(`Aprobar solicitud de ${req.organization_name}?`)) return
    setApprovingId(req.id)
    try {
      await adminApi.post(`/signup-requests/${req.id}/approve`)
      showToast(`${req.organization_name} aprobada y provisionada`)
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al aprobar')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 rounded-lg z-50">
          {toast}
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); load() }}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Solicitudes</h1>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin solicitudes con estado {STATUS_LABELS[statusFilter].toLowerCase()}</p>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-white font-medium truncate">{r.organization_name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">{r.contact_name} — {r.contact_email}</p>
                  {r.contact_phone && <p className="text-gray-500 text-xs mt-0.5">{r.contact_phone} {r.country ? `/ ${r.country}` : ''}</p>}
                  {r.rejected_reason && <p className="text-red-400 text-xs mt-1">Motivo: {r.rejected_reason}</p>}
                  <p className="text-gray-600 text-xs mt-1">{new Date(r.created_at).toLocaleString('es-MX')}</p>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setRejectTarget(r)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => handleApprove(r)}
                      disabled={approvingId === r.id}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                    >
                      {approvingId === r.id ? 'Procesando...' : 'Aprobar'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
