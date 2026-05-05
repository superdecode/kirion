import { useState } from 'react'
import axios from 'axios'

const FEATURES = [
  { title: 'Escaneo en tiempo real', desc: 'Registra guias al instante con validacion automatica de duplicados.' },
  { title: 'Control por tarimas', desc: 'Organiza escaneos en tarimas de hasta 100 guias con cierre automatico.' },
  { title: 'Dashboard y reportes', desc: 'Visualiza rendimiento por operador, empresa y canal en tiempo real.' },
  { title: 'Multi-operador', desc: 'Diferentes niveles de acceso para administradores, supervisores y operadores.' },
]

const COUNTRIES = ['Mexico', 'Colombia', 'Chile', 'Peru', 'Argentina', 'Brasil', 'Otro']

function FormField({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 transition-colors"
      />
    </div>
  )
}

export default function Landing() {
  const [form, setForm] = useState({
    organization_name: '', contact_name: '', contact_email: '', contact_phone: '', country: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await axios.post('/api/public/signup-requests', form)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar la solicitud. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="font-bold text-lg tracking-tight">Kerion</p>
          <a href="#solicitar" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            Solicitar prueba gratuita
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          <span className="text-blue-300 text-sm">Prueba gratuita 7 dias</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
          Control total de<br />
          <span className="text-blue-400">Drop Scan</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Sistema de gestion de escaneo de guias para operaciones de paqueteria.
          Elimina errores, acelera el proceso y mantiene trazabilidad completa.
        </p>
        <a
          href="#solicitar"
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-4 rounded-xl text-lg transition-colors"
        >
          Probar 7 dias gratis
        </a>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 pb-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Precio simple</h2>
        <p className="text-gray-400 mb-10">Sin contratos. Cancela cuando quieras.</p>
        <div className="inline-block bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-left max-w-sm w-full">
          <p className="text-gray-400 text-sm mb-1">Plan mensual</p>
          <p className="text-4xl font-bold text-white mb-1">$188 <span className="text-xl text-gray-400 font-normal">USD/mes</span></p>
          <p className="text-blue-400 text-sm mb-6">7 dias de prueba sin costo</p>
          <ul className="space-y-2 text-sm text-gray-300 mb-8">
            <li>Modulo Drop Scan completo</li>
            <li>Usuarios ilimitados</li>
            <li>Dashboard y reportes</li>
            <li>Soporte por email</li>
          </ul>
          <a
            href="#solicitar"
            className="block text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Comenzar prueba gratis
          </a>
        </div>
      </section>

      {/* Signup Form */}
      <section id="solicitar" className="bg-white/[0.02] border-t border-white/5">
        <div className="max-w-2xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-2">Solicitar prueba gratuita</h2>
          <p className="text-gray-400 text-center mb-10">
            Completa el formulario y revisaremos tu solicitud en menos de 24 horas.
          </p>

          {success ? (
            <div className="bg-green-900/20 border border-green-800 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 text-2xl">✓</span>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Solicitud recibida</h3>
              <p className="text-gray-400 text-sm">
                Te enviamos un email de confirmacion. Revisaremos tu solicitud y te contactaremos pronto.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <FormField
                label="Nombre de la empresa *"
                type="text"
                value={form.organization_name}
                onChange={set('organization_name')}
                placeholder="Ej. Logistica del Norte S.A."
                required
              />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  label="Nombre del contacto *"
                  type="text"
                  value={form.contact_name}
                  onChange={set('contact_name')}
                  placeholder="Tu nombre"
                  required
                />
                <FormField
                  label="Email corporativo *"
                  type="email"
                  value={form.contact_email}
                  onChange={set('contact_email')}
                  placeholder="tu@empresa.com"
                  required
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  label="Telefono"
                  type="tel"
                  value={form.contact_phone}
                  onChange={set('contact_phone')}
                  placeholder="+52 55 0000 0000"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Pais</label>
                  <select
                    value={form.country}
                    onChange={set('country')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors"
                  >
                    <option value="" className="bg-gray-900">Seleccionar...</option>
                    {COUNTRIES.map(c => (
                      <option key={c} value={c} className="bg-gray-900">{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-4 rounded-xl text-lg transition-colors mt-2"
              >
                {loading ? 'Enviando...' : 'Solicitar prueba gratuita'}
              </button>
              <p className="text-gray-500 text-xs text-center">
                Sin costo durante 7 dias. Sin tarjeta de credito requerida.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-bold text-white">Kerion Drop Scan</p>
          <p className="text-gray-500 text-sm">
            Contacto: <a href="mailto:hola@kerion.app" className="text-gray-400 hover:text-white transition-colors">hola@kerion.app</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
