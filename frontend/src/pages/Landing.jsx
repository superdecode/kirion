import { useState } from 'react'
import axios from 'axios'
import { Check, ChevronRight, Zap, Shield, BarChart3, Users, FileText, Package, ArrowRight, Star, MessageCircle } from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Zap,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    title: 'Escaneo DropScan',
    desc: 'Registra guias en tiempo real con validacion automatica de duplicados, notificaciones sonoras y cierre de tarimas. Cero errores, maxima velocidad.',
  },
  {
    icon: FileText,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    title: 'FEP — Folios de Entrega',
    desc: 'Generacion automatica de folios y actas de entrega con firma del destinatario. Exportacion a PDF con un clic.',
  },
  {
    icon: Package,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    title: 'Inventario',
    desc: 'Control de stock por escaneo, historial completo de movimientos y reportes de diferencias. Siempre sabes que tienes y donde esta.',
  },
  {
    icon: BarChart3,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    title: 'Dashboard y Reportes',
    desc: 'Metricas de productividad por operador, empresa y canal. Filtros avanzados, exportacion a Excel y vista en tiempo real.',
  },
  {
    icon: Users,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    title: 'Permisos por Rol',
    desc: '5 niveles de acceso: Administrador, Jefe, Supervisor, Operador y Usuario. Control granular de que puede ver y hacer cada persona.',
  },
  {
    icon: Shield,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    title: 'Multi-empresa',
    desc: 'Separa operaciones por empresa, canal o cliente dentro del mismo sistema. Reportes independientes sin mezclar datos.',
  },
]

const PLANS = [
  {
    name: 'Basico',
    price: 97,
    desc: 'Para operaciones pequenas',
    color: 'border-gray-700',
    badge: null,
    features: [
      'Hasta 3 operadores',
      'Modulo DropScan',
      'Dashboard basico',
      'Soporte por email',
      '5,000 guias/mes',
    ],
    excluded: ['FEP — Folios de entrega', 'Modulo Inventario', 'Reportes avanzados'],
  },
  {
    name: 'Profesional',
    price: 188,
    desc: 'El mas popular',
    color: 'border-blue-500',
    badge: 'Mas popular',
    badgeColor: 'bg-blue-600',
    features: [
      'Operadores ilimitados',
      'DropScan + FEP + Inventario',
      'Dashboard avanzado + Excel',
      'Permisos por rol (5 niveles)',
      '50,000 guias/mes',
      'Soporte prioritario',
      'Onboarding incluido',
    ],
    excluded: [],
  },
  {
    name: 'Enterprise',
    price: null,
    desc: 'Para grandes operaciones',
    color: 'border-purple-500',
    badge: 'Mejor valor',
    badgeColor: 'bg-purple-600',
    features: [
      'Todo lo del plan Profesional',
      'Guias ilimitadas',
      'Integraciones API',
      'SLA garantizado',
      'Soporte dedicado 24/7',
      'Capacitacion in-situ',
      'Personalizacion a medida',
    ],
    excluded: [],
  },
]

const PAIN_POINTS = [
  { q: 'Escaneos duplicados', a: 'Kirion detecta y bloquea automaticamente guias repetidas, con alerta sonora inmediata.' },
  { q: 'Errores manuales', a: 'La validacion automatica elimina el error humano en el registro de guias y movimientos.' },
  { q: 'Sin visibilidad en tiempo real', a: 'Dashboard en vivo con metricas de productividad, sin esperar al cierre del turno.' },
  { q: 'Actas de entrega en papel', a: 'FEP genera folios digitales con firma del destinatario y exporta PDF al instante.' },
]

const COUNTRIES = ['Mexico', 'Colombia', 'Chile', 'Peru', 'Argentina', 'Brasil', 'China', 'Otro']

const STATS = [
  { value: '12+', label: 'Empresas activas' },
  { value: '500K+', label: 'Guias procesadas' },
  { value: '99.9%', label: 'Uptime garantizado' },
  { value: '< 30 min', label: 'Tiempo de setup' },
]

// ── Components ─────────────────────────────────────────────────────────────────

function NavBar() {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/60">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Kirion" className="w-8 h-8 rounded-lg object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />
          <span className="text-white font-bold text-lg tracking-tight">Kirion</span>
          <span className="text-blue-400 text-xs font-semibold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">WMS</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          {[['funcionalidades', 'Funciones'], ['precios', 'Precios'], ['contacto', 'Contacto']].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="hover:text-white transition-colors">{label}</button>
          ))}
        </div>
        <button
          onClick={() => scrollTo('contacto')}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors font-medium"
        >
          Prueba gratis <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  )
}

function HeroSection() {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-950 to-gray-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(46,87,254,0.15),transparent)]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl" />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Sistema de Gestion de Almacen — SaaS
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
          Control total de tu{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400">
            operacion logistica
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-400 leading-relaxed mb-10 max-w-2xl mx-auto">
          Kirion elimina duplicados, automatiza el registro de guias y da visibilidad en tiempo real a directores de operaciones y jefes de almacen.
          <span className="text-white font-medium"> Sin hojas de calculo. Sin errores manuales.</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <button
            onClick={() => scrollTo('contacto')}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/25 text-base"
          >
            Empezar prueba de 7 dias gratis
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollTo('funcionalidades')}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-colors border border-gray-700 text-base"
          >
            Ver funciones
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
          {['Sin tarjeta de credito', 'Setup en menos de 30 min', 'Soporte incluido'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function StatsSection() {
  return (
    <section className="py-12 border-y border-gray-800 bg-gray-900/40">
      <div className="max-w-4xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-black text-white mb-1">{value}</p>
              <p className="text-gray-500 text-sm">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProblemSection() {
  return (
    <section className="py-20 bg-gray-950">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">El problema</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Cada error cuesta dinero y credibilidad
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Los almacenes que trabajan con hojas de calculo y procesos manuales pierden horas, cometen errores y no pueden escalar.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PAIN_POINTS.map(({ q, a }) => (
            <div key={q} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-400 text-xs font-bold">!</span>
                </div>
                <div>
                  <p className="text-white font-semibold mb-1">{q}</p>
                  <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-20 bg-gray-900/30">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">Funcionalidades</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Todo lo que necesitas, nada de lo que no
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Kirion fue construido especificamente para operaciones de mensajeria y logistica en Latinoamerica y Asia.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, color, bg, border, title, desc }) => (
            <div key={title} className={`bg-gray-900 border rounded-xl p-6 hover:border-opacity-60 transition-all hover:-translate-y-0.5 ${border}`}>
              <div className={`w-11 h-11 rounded-xl border ${bg} ${border} flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingSection() {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <section id="precios" className="py-20 bg-gray-950">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">Precios</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Transparente y sin sorpresas
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Prueba 7 dias gratis. Cancela cuando quieras. Sin contratos de largo plazo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative bg-gray-900 rounded-2xl border-2 p-6 flex flex-col ${plan.color} ${i === 1 ? 'ring-2 ring-blue-500/30 shadow-xl shadow-blue-500/10' : ''}`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 ${plan.badgeColor} text-white text-xs font-bold rounded-full whitespace-nowrap`}>
                  {plan.badge}
                </div>
              )}
              <div className="mb-5">
                <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
                <p className="text-gray-400 text-sm">{plan.desc}</p>
              </div>
              <div className="mb-6">
                {plan.price ? (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-white">${plan.price}</span>
                    <span className="text-gray-400 text-sm mb-1">/mes USD</span>
                  </div>
                ) : (
                  <p className="text-3xl font-black text-white">A consultar</p>
                )}
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{f}</span>
                  </li>
                ))}
                {plan.excluded.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm opacity-40">
                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-gray-600 mt-0.5">—</span>
                    <span className="text-gray-500 line-through">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => scrollTo('contacto')}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  i === 1
                    ? 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-600/25'
                    : i === 2
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
                }`}
              >
                {plan.price ? 'Empezar prueba gratis' : 'Contactar ventas'}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-600 text-sm mt-6">Todos los precios en USD. IVA segun pais.</p>
      </div>
    </section>
  )
}

function ContactSection({ form, setForm, loading, success, error, onSubmit }) {
  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  const inputCls = "w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
  const labelCls = "block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider"

  if (success) return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-white text-xl font-bold mb-2">Solicitud enviada</h3>
      <p className="text-gray-400">Nuestro equipo te contactara en menos de 24 horas para activar tu trial gratuito.</p>
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Empresa / Organizacion *</label>
          <input required value={form.organization_name} onChange={set('organization_name')} placeholder="Logistica Acme S.A." className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Nombre de contacto *</label>
          <input required value={form.contact_name} onChange={set('contact_name')} placeholder="Juan Garcia" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email corporativo *</label>
          <input required type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="juan@empresa.com" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Telefono / WhatsApp</label>
          <input value={form.contact_phone} onChange={set('contact_phone')} placeholder="+52 55 1234 5678" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Pais</label>
          <select value={form.country} onChange={set('country')} className={inputCls}>
            <option value="">Seleccionar...</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Volumen mensual estimado</label>
          <select value={form.volume} onChange={set('volume')} className={inputCls}>
            <option value="">Seleccionar...</option>
            <option value="lt5k">Menos de 5,000 guias</option>
            <option value="5k-20k">5,000 – 20,000 guias</option>
            <option value="20k-100k">20,000 – 100,000 guias</option>
            <option value="gt100k">Mas de 100,000 guias</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Mensaje (opcional)</label>
        <textarea value={form.message} onChange={set('message')} rows={3} placeholder="Cuentanos mas sobre tu operacion..." className={`${inputCls} resize-none`} />
      </div>
      {error && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/40 rounded-xl p-3 text-red-300 text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/25 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Enviando...
          </>
        ) : (
          <>Empezar prueba de 7 dias gratis <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
      <p className="text-center text-gray-500 text-xs">Sin compromiso. Sin tarjeta de credito. Cancelacion inmediata.</p>
    </form>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="Kirion" className="w-7 h-7 rounded-lg object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />
              <span className="text-white font-bold">Kirion WMS</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Sistema de gestion de almacen para operaciones de mensajeria y logistica en Latinoamerica y Asia.
            </p>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">Contacto</p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a href="mailto:contacto@kirion.app" className="hover:text-white transition-colors">
                  contacto@kirion.app
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/8618514458054"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp +86 185 1445 8054
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">Legal</p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>Terminos de servicio</li>
              <li>Politica de privacidad</li>
            </ul>
          </div>
        </div>
        <div className="pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-600 text-sm">© 2026 Kirion WMS. Todos los derechos reservados.</p>
          <p className="text-gray-700 text-xs">Hecho para logistica real</p>
        </div>
      </div>
    </footer>
  )
}

// ── WhatsApp Float ─────────────────────────────────────────────────────────────

function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/8618514458054?text=Hola,%20me%20interesa%20conocer%20Kirion%20WMS"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#20b758] text-white font-medium px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all group"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="text-sm group-hover:scale-105 transition-transform">WhatsApp</span>
    </a>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Landing() {
  const [form, setForm] = useState({
    organization_name: '', contact_name: '', contact_email: '',
    contact_phone: '', country: '', volume: '', message: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

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
      <NavBar />
      <HeroSection />
      <StatsSection />
      <ProblemSection />
      <FeaturesSection />
      <PricingSection />

      {/* Contact */}
      <section id="contacto" className="py-20 bg-gray-900/40">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-3">Empezar ahora</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              7 dias gratis, sin riesgos
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Completa el formulario y nuestro equipo te configura el sistema en menos de 30 minutos.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            {/* Benefits */}
            <div className="lg:col-span-2 space-y-4">
              {[
                { title: 'Trial de 7 dias', desc: 'Acceso completo sin restricciones. Sin tarjeta de credito.' },
                { title: 'Setup rapido', desc: 'Tu sistema configurado en menos de 30 minutos.' },
                { title: 'Soporte incluido', desc: 'Te acompanamos durante todo el proceso de adopcion.' },
                { title: 'Sin contratos', desc: 'Paga mes a mes. Cancela cuando quieras.' },
              ].map(({ title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{title}</p>
                    <p className="text-gray-400 text-sm">{desc}</p>
                  </div>
                </div>
              ))}

              <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl">
                <p className="text-white text-sm font-medium mb-1">Contacto directo</p>
                <a
                  href="https://wa.me/8618514458054"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp +86 185 1445 8054
                </a>
                <a href="mailto:contacto@kirion.app" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors mt-1.5">
                  contacto@kirion.app
                </a>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <ContactSection
                form={form}
                setForm={setForm}
                loading={loading}
                success={success}
                error={error}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  )
}
