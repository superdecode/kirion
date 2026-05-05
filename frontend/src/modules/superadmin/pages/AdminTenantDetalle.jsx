import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import adminApi from '../services/adminApi'

function AddSubscriptionForm({ tenantId, plans, onDone }) {
  const [form, setForm] = useState({ plan_id: '', expires_at: '', payment_reference: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.plan_id || !form.expires_at) return setError('Plan y fecha de vencimiento requeridos')
    setLoading(true)
    try {
      await adminApi.post(`/tenants/${tenantId}/subscriptions`, form)
      onDone()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al agregar suscripcion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Plan</label>
          <select
            value={form.plan_id}
            onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          >
            <option value="">Seleccionar...</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.name} — ${p.price_amount} {p.price_currency}/mes</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Vence el</label>
          <input
            type="date"
            value={form.expires_at}
            onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Referencia de pago</label>
          <input
            type="text"
            value={form.payment_reference}
            onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))}
            placeholder="Num. transferencia, etc."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Notas</label>
          <input
            type="text"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
      >
        {loading ? 'Guardando...' : 'Activar suscripcion'}
      </button>
    </form>
  )
}

export default function AdminTenantDetalle() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showSubForm, setShowSubForm] = useState(false)

  function showMsg(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function load() {
    try {
      const [detailRes, plansRes] = await Promise.all([
        adminApi.get(`/tenants/${id}`),
        adminApi.get('/plans'),
      ])
      setData(detailRes.data)
      setPlans(plansRes.data.data)
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function handleAction(action) {
    try {
      await adminApi.post(`/tenants/${id}/${action}`)
      showMsg(action === 'suspend' ? 'Tenant suspendido' : 'Tenant reactivado')
      load()
    } catch (err) {
      showMsg(err.response?.data?.error || 'Error')
    }
  }

  if (loading) return <p className="text-gray-400">Cargando...</p>
  if (!data) return <p className="text-red-400">Tenant no encontrado</p>

  const { tenant, provisioning_log, subscriptions } = data

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 rounded-lg z-50">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link to="/super-admin/tenants" className="text-gray-400 hover:text-white text-sm">
          Tenants /
        </Link>
        <h1 className="text-xl font-bold text-white">{tenant.legal_name}</h1>
        <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full">{tenant.status}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-medium mb-3">Informacion</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Slug', tenant.slug],
              ['Email contacto', tenant.contact_email],
              ['Telefono', tenant.contact_phone || '-'],
              ['Pais', tenant.country || '-'],
              ['Plan', tenant.plan_name || '-'],
              ['Trial vence', tenant.trial_expires_at ? new Date(tenant.trial_expires_at).toLocaleDateString('es-MX') : '-'],
              ['Suscripcion vence', tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at).toLocaleDateString('es-MX') : '-'],
              ['Creado', new Date(tenant.created_at).toLocaleString('es-MX')],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-gray-400">{k}</dt>
                <dd className="text-white text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800">
            {tenant.status !== 'suspended' ? (
              <button
                onClick={() => handleAction('suspend')}
                className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/70 text-red-300 text-xs rounded-lg transition-colors"
              >
                Suspender
              </button>
            ) : (
              <button
                onClick={() => handleAction('reactivate')}
                className="px-3 py-1.5 bg-green-900/40 hover:bg-green-900/70 text-green-300 text-xs rounded-lg transition-colors"
              >
                Reactivar
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-medium">Suscripciones</h2>
            <button
              onClick={() => setShowSubForm(s => !s)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors"
            >
              + Agregar
            </button>
          </div>
          {showSubForm && (
            <div className="mb-4 p-4 bg-gray-800 rounded-lg">
              <AddSubscriptionForm
                tenantId={id}
                plans={plans}
                onDone={() => { setShowSubForm(false); load() }}
              />
            </div>
          )}
          {subscriptions.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin suscripciones</p>
          ) : (
            <div className="space-y-2">
              {subscriptions.map(s => (
                <div key={s.id} className="flex justify-between items-start py-2 border-b border-gray-800 last:border-0 text-sm">
                  <div>
                    <p className="text-white">{s.plan_name}</p>
                    <p className="text-gray-500 text-xs">{s.payment_reference || 'Sin referencia'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs ${s.status === 'active' ? 'text-green-400' : 'text-gray-500'}`}>{s.status}</span>
                    {s.expires_at && (
                      <p className="text-gray-500 text-xs">vence {new Date(s.expires_at).toLocaleDateString('es-MX')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-medium mb-3">Log de provisioning</h2>
        {provisioning_log.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin registros</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {provisioning_log.map(l => (
              <div key={l.id} className="flex items-center gap-3 py-1.5 border-b border-gray-800 last:border-0 text-xs">
                <span className={l.status === 'ok' ? 'text-green-400' : l.status === 'skipped' ? 'text-gray-500' : 'text-red-400'}>
                  {l.status === 'ok' ? '✓' : l.status === 'skipped' ? '–' : '✗'}
                </span>
                <span className="text-gray-300 font-mono">{l.step}</span>
                {l.error_message && <span className="text-red-400 truncate">{l.error_message}</span>}
                <span className="text-gray-600 ml-auto">{new Date(l.created_at).toLocaleTimeString('es-MX')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
