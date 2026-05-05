import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import adminApi from '../services/adminApi'

const STATUS_COLORS = {
  trial: 'bg-blue-900/40 text-blue-300',
  active: 'bg-green-900/40 text-green-300',
  trial_expired: 'bg-yellow-900/40 text-yellow-300',
  expired: 'bg-orange-900/40 text-orange-300',
  suspended: 'bg-red-900/40 text-red-300',
  pending: 'bg-gray-700 text-gray-300',
  rejected: 'bg-gray-800 text-gray-500',
}

export default function AdminTenants() {
  const [tenants, setTenants] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url = statusFilter ? `/tenants?status=${statusFilter}` : '/tenants'
    adminApi.get(url)
      .then(r => setTenants(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter])

  const statuses = ['', 'trial', 'active', 'trial_expired', 'expired', 'suspended']
  const labels = { '': 'Todos', trial: 'Trial', active: 'Activo', trial_expired: 'Trial vencido', expired: 'Vencido', suspended: 'Suspendido' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Tenants</h1>
        <div className="flex flex-wrap gap-2">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {labels[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : tenants.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin tenants</p>
      ) : (
        <div className="space-y-3">
          {tenants.map(t => (
            <Link
              key={t.id}
              to={`/super-admin/tenants/${t.id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-medium truncate">{t.legal_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[t.status] || 'bg-gray-700 text-gray-300'}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">{t.contact_email}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {t.slug} · {t.user_count || 0} usuarios
                    {t.last_access ? ` · Ultimo acceso: ${new Date(t.last_access).toLocaleDateString('es-MX')}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {t.plan_name && <p className="text-gray-400 text-xs">{t.plan_name}</p>}
                  {t.subscription_expires_at && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      Vence: {new Date(t.subscription_expires_at).toLocaleDateString('es-MX')}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
