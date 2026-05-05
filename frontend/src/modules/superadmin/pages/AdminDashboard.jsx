import { useEffect, useState } from 'react'
import adminApi from '../services/adminApi'
import { Link } from 'react-router-dom'

function StatCard({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value ?? '-'}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.get('/dashboard')
      .then(r => setData(r.data))
      .catch(() => setError('Error cargando dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400">Cargando...</p>
  if (error) return <p className="text-red-400">{error}</p>

  const { stats, pending_requests, last_30d_conversion } = data

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Trial activo" value={stats.trial} color="text-blue-400" />
        <StatCard label="Suscripcion activa" value={stats.active} color="text-green-400" />
        <StatCard label="Trial vencido" value={stats.trial_expired} color="text-yellow-400" />
        <StatCard label="Total tenants" value={stats.total} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-sm text-gray-400 mb-1">Conversion ultimos 30 dias</p>
        <p className="text-white text-sm">
          {last_30d_conversion.converted} convertidos / {Number(last_30d_conversion.converted) + Number(last_30d_conversion.not_converted)} totales
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-medium">Solicitudes pendientes</h2>
          <Link to="/super-admin/solicitudes" className="text-blue-400 text-sm hover:text-blue-300">
            Ver todas
          </Link>
        </div>
        {pending_requests.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin solicitudes pendientes</p>
        ) : (
          <div className="space-y-2">
            {pending_requests.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">{r.organization_name}</p>
                  <p className="text-gray-400 text-xs">{r.contact_email}</p>
                </div>
                <Link
                  to={`/super-admin/solicitudes?id=${r.id}`}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors"
                >
                  Revisar
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
