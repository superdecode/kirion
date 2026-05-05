import { useEffect, useState } from 'react'
import adminApi from '../services/adminApi'

const STATUS_COLORS = {
  pending: 'text-yellow-400',
  sent: 'text-green-400',
  failed: 'text-red-400',
}

export default function AdminNotificaciones() {
  const [notifs, setNotifs] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const url = statusFilter ? `/notifications?status=${statusFilter}` : '/notifications'
      const res = await adminApi.get(url)
      setNotifs(res.data.data)
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  async function handleRetry(id) {
    setRetryingId(id)
    try {
      await adminApi.post(`/notifications/${id}/retry`)
      load()
    } catch {
      /* noop */
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Notificaciones</h1>
        <div className="flex gap-2">
          {['', 'pending', 'sent', 'failed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {s || 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : notifs.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin notificaciones</p>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div key={n.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${STATUS_COLORS[n.status]}`}>{n.status}</span>
                  <span className="text-gray-500 text-xs font-mono">{n.template_code}</span>
                </div>
                <p className="text-white text-sm mt-0.5 truncate">{n.recipient_email}</p>
                {n.last_error && <p className="text-red-400 text-xs mt-0.5 truncate">{n.last_error}</p>}
                <p className="text-gray-600 text-xs mt-1">
                  Intentos: {n.attempts} · {new Date(n.created_at).toLocaleString('es-MX')}
                </p>
              </div>
              {n.status === 'failed' && (
                <button
                  onClick={() => handleRetry(n.id)}
                  disabled={retryingId === n.id}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs rounded-lg transition-colors flex-shrink-0"
                >
                  {retryingId === n.id ? '...' : 'Reintentar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
