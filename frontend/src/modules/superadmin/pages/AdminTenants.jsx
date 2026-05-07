import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Search, RefreshCw, Building2, ChevronRight, AlertCircle, CheckCircle2, Clock, XCircle, PauseCircle, Users, Calendar, Database, Zap } from 'lucide-react'
import adminApi from '../services/adminApi'

const STATUS_CFG = {
  trial:         { label: 'Trial',          bg: 'bg-blue-500/15',    text: 'text-blue-300',   border: 'border-blue-500/25',    dot: 'bg-blue-400' },
  active:        { label: 'Activo',         bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  trial_expired: { label: 'Trial vencido',  bg: 'bg-amber-500/15',   text: 'text-amber-300',  border: 'border-amber-500/25',   dot: 'bg-amber-400' },
  expired:       { label: 'Vencido',        bg: 'bg-orange-500/15',  text: 'text-orange-300', border: 'border-orange-500/25',  dot: 'bg-orange-400' },
  suspended:     { label: 'Suspendido',     bg: 'bg-red-500/15',     text: 'text-red-300',    border: 'border-red-500/25',     dot: 'bg-red-400' },
  pending:       { label: 'Pendiente',      bg: 'bg-gray-700/50',    text: 'text-gray-300',   border: 'border-gray-600/50',    dot: 'bg-gray-400' },
  rejected:      { label: 'Rechazado',      bg: 'bg-gray-800/50',    text: 'text-gray-500',   border: 'border-gray-700/50',    dot: 'bg-gray-600' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const STATUSES = ['', 'trial', 'active', 'trial_expired', 'expired', 'suspended']
const STATUS_LABELS = { '': 'Todos', trial: 'Trial', active: 'Activo', trial_expired: 'Trial vencido', expired: 'Vencido', suspended: 'Suspendido' }

export default function AdminTenants() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tenants, setTenants] = useState([])
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dbSize, setDbSize] = useState(null)

  function load() {
    setLoading(true)
    setError('')
    const url = statusFilter ? `/tenants?status=${statusFilter}` : '/tenants'
    adminApi.get(url)
      .then(r => setTenants(r.data.data))
      .catch(() => setError('Error cargando tenants'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    adminApi.get('/usage-stats')
      .then(r => setDbSize(r.data.data?.db_size ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [statusFilter])

  const filtered = tenants.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.legal_name?.toLowerCase().includes(q) ||
      t.slug?.toLowerCase().includes(q) ||
      t.contact_email?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Tenants</h1>
          <p className="text-gray-500 text-sm mt-0.5">{tenants.length} organizaciones registradas</p>
        </div>
        <div className="flex items-center gap-3">
          {dbSize && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-gray-400 text-xs">DB</span>
              <span className="text-white text-xs font-semibold">{dbSize}</span>
            </div>
          )}
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm rounded-lg transition-colors border border-gray-700">
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, slug o email..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-0.5 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-950/30 border border-red-800/40 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex items-center gap-3 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando tenants...</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Sin resultados</p>
          <p className="text-gray-600 text-sm mt-1">Prueba cambiando los filtros de busqueda</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Organizacion</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Estado</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Plan</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Usuarios</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden xl:table-cell">Guias</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden xl:table-cell">Vencimiento</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filtered.map(t => {
                const expAt = t.active_sub_expires_at || t.subscription_expires_at || t.trial_expires_at
                const isTrial = !t.active_sub_expires_at && !t.subscription_expires_at && !!t.trial_expires_at
                const exp = expAt ? new Date(expAt) : null
                const daysLeft = exp ? Math.ceil((exp - Date.now()) / 86400000) : null
                const planLabel = t.active_plan_name || t.plan_name
                return (
                  <tr key={t.id} className="hover:bg-gray-800/30 transition-colors group cursor-pointer" onClick={() => navigate(`/super-admin/tenants/${t.id}`)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 font-bold text-gray-400 text-sm">
                          {t.legal_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{t.legal_name}</p>
                          <p className="text-gray-500 text-xs truncate">{t.slug} · {t.contact_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-gray-300 text-sm">{planLabel || '—'}</span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Users className="w-3.5 h-3.5" />
                        <span>{t.user_count ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden xl:table-cell">
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Zap className="w-3.5 h-3.5" />
                        <span>{Number(t.guias_count ?? 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden xl:table-cell">
                      {exp ? (
                        <div>
                          <span className={`text-xs font-medium ${daysLeft !== null && daysLeft < 7 ? 'text-red-400' : daysLeft !== null && daysLeft < 30 ? 'text-amber-400' : 'text-gray-300'}`}>
                            {daysLeft !== null && daysLeft > 0 ? `${daysLeft}d restantes` : 'Vencido'}
                          </span>
                          <p className="text-gray-600 text-xs mt-0.5">
                            {exp.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {isTrial && <span className="ml-1 text-blue-500">(trial)</span>}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 group-hover:bg-blue-600 border border-gray-700 group-hover:border-blue-500 text-gray-400 group-hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
