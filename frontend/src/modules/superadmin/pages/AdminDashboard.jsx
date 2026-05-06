import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, TrendingUp, AlertCircle, Clock, CheckCircle2, XCircle, ArrowRight, RefreshCw } from 'lucide-react'
import adminApi from '../services/adminApi'

const STAT_CFG = {
  trial:         { label: 'Trial activo',   color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: Clock },
  active:        { label: 'Suscripcion',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  trial_expired: { label: 'Trial vencido',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: XCircle },
  total:         { label: 'Total tenants',  color: 'text-white',       bg: 'bg-gray-800/60',    border: 'border-gray-700',       icon: Building2 },
}

function StatCard({ stat, value }) {
  const { label, color, bg, border, icon: Icon } = STAT_CFG[stat]
  return (
    <div className={`rounded-xl border p-5 ${bg} ${border}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${bg} border ${border} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value ?? '-'}</p>
    </div>
  )
}

function ConversionBar({ converted, total }) {
  const pct = total > 0 ? Math.round((converted / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">Ultimos 30 dias</span>
        <span className="text-white font-bold">{pct}%</span>
      </div>
      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-gray-500 text-xs mt-2">{converted} convertidos de {total} trials totales</p>
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    adminApi.get('/dashboard')
      .then(r => setData(r.data))
      .catch(() => setError('Error cargando dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-3 bg-red-950/30 border border-red-800/40 rounded-xl p-4">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
      <span className="text-red-300 text-sm">{error}</span>
      <button onClick={load} className="ml-auto text-red-400 hover:text-red-300 text-sm underline">Reintentar</button>
    </div>
  )

  const { stats, pending_requests, last_30d_conversion } = data
  const convTotal = Number(last_30d_conversion.converted) + Number(last_30d_conversion.not_converted)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Vista general del sistema Kirion WMS</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm rounded-lg transition-colors border border-gray-700">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard stat="trial"         value={stats.trial} />
        <StatCard stat="active"        value={stats.active} />
        <StatCard stat="trial_expired" value={stats.trial_expired} />
        <StatCard stat="total"         value={stats.total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h2 className="text-white font-medium text-sm">Tasa de conversion</h2>
          </div>
          <ConversionBar converted={Number(last_30d_conversion.converted)} total={convTotal} />
        </div>

        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium text-sm mb-4">Accesos rapidos</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Todos los tenants',      to: '/super-admin/tenants',                   c: 'text-blue-400' },
              { label: 'Solicitudes pendientes', to: '/super-admin/solicitudes',               c: 'text-amber-400' },
              { label: 'Notificaciones',         to: '/super-admin/notificaciones',            c: 'text-purple-400' },
              { label: 'Tenants suspendidos',    to: '/super-admin/tenants?status=suspended',  c: 'text-red-400' },
            ].map(({ label, to, c }) => (
              <Link key={to} to={to} className="flex items-center justify-between p-3 bg-gray-800/60 hover:bg-gray-800 rounded-lg border border-gray-700/50 transition-colors group">
                <span className={`text-sm font-medium ${c}`}>{label}</span>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-medium text-sm">Solicitudes pendientes</h2>
            {pending_requests.length > 0 && (
              <span className="bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">{pending_requests.length}</span>
            )}
          </div>
          <Link to="/super-admin/solicitudes" className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="px-5">
          {pending_requests.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-gray-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm">Sin solicitudes pendientes</span>
            </div>
          ) : pending_requests.map(r => {
            const age = Math.floor((Date.now() - new Date(r.created_at)) / 86400000)
            return (
              <div key={r.id} className="flex items-center justify-between py-3 border-b border-gray-800/60 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-400 text-xs font-bold">{r.organization_name?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{r.organization_name}</p>
                    <p className="text-gray-400 text-xs truncate">{r.contact_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-gray-500 text-xs">{age === 0 ? 'hoy' : `hace ${age}d`}</span>
                  <Link to="/super-admin/solicitudes" className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
                    Revisar
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
