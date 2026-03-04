import { useAuthStore } from '../core/stores/authStore'
import Header from '../core/components/layout/Header'
import {
  ScanBarcode, Package, Truck, CheckSquare, ArrowRight,
  Activity, Users, Clock
} from 'lucide-react'
import { Link } from 'react-router-dom'

const modules = [
  {
    id: 'dropscan',
    name: 'DropScan',
    description: 'Escaneo y trazabilidad de guías de paquetería',
    icon: ScanBarcode,
    path: '/dropscan',
    color: 'from-primary-500 to-primary-700',
    active: true,
  },
  {
    id: 'inventory',
    name: 'Inventario',
    description: 'Gestión de inventario y clasificación de productos',
    icon: Package,
    path: '/inventory',
    color: 'from-accent-500 to-accent-700',
    active: false,
  },
  {
    id: 'dispatch',
    name: 'Despacho',
    description: 'Gestión y validación de órdenes de despacho',
    icon: Truck,
    path: '/dispatch',
    color: 'from-warning-400 to-warning-600',
    active: false,
  },
  {
    id: 'validate',
    name: 'Validador',
    description: 'Validación rápida de códigos con estadísticas',
    icon: CheckSquare,
    path: '/validate',
    color: 'from-violet-500 to-violet-700',
    active: false,
  },
]

export default function GlobalDashboard() {
  const { user } = useAuthStore()

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="Vista general del sistema" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Welcome */}
        <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700 rounded-3xl p-8 text-white mb-8 shadow-xl overflow-hidden relative">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-white/5 rounded-full blur-xl" />
          <div className="relative">
            <h2 className="text-2xl font-extrabold mb-1">
              Bienvenido, {user?.nombre_completo?.split(' ')[0] || 'Usuario'}
            </h2>
            <p className="text-primary-200 text-sm font-medium">
              Sistema de Gestión de Almacén · {user?.rol_nombre}
            </p>

            <div className="grid grid-cols-3 gap-5 mt-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <Activity className="w-5 h-5 text-primary-200 mb-2" />
                <p className="text-2xl font-extrabold">1</p>
                <p className="text-[11px] text-primary-200 font-medium">Módulo Activo</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <Users className="w-5 h-5 text-primary-200 mb-2" />
                <p className="text-2xl font-extrabold">—</p>
                <p className="text-[11px] text-primary-200 font-medium">Usuarios En Línea</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <Clock className="w-5 h-5 text-primary-200 mb-2" />
                <p className="text-2xl font-extrabold">{new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-[11px] text-primary-200 font-medium">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modules */}
        <h3 className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-4">Módulos del Sistema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon
            return (
              <div
                key={mod.id}
                className={`relative card-interactive p-5
                            ${!mod.active ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {!mod.active && (
                  <span className="absolute top-3 right-3 badge bg-warm-100 text-warm-500 text-[9px]">
                    Próximamente
                  </span>
                )}
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${mod.color} flex items-center justify-center mb-4 shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-sm font-bold text-warm-800 mb-1">{mod.name}</h4>
                <p className="text-xs text-warm-400 mb-4 line-clamp-2 leading-relaxed">{mod.description}</p>
                {mod.active ? (
                  <Link
                    to={mod.path}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 group"
                  >
                    Abrir módulo <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : (
                  <span className="text-xs text-warm-300">No disponible</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
