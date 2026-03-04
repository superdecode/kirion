import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  LayoutDashboard, ScanBarcode, History, BarChart3,
  ChevronLeft, ChevronRight,
  Package, Settings2
} from 'lucide-react'
import { useState } from 'react'

const moduleNav = [
  {
    id: 'dropscan',
    label: 'DropScan',
    icon: ScanBarcode,
    items: [
      { path: '/dropscan', label: 'Dashboard', icon: LayoutDashboard, permission: 'dropscan.dashboard' },
      { path: '/dropscan/escaneo', label: 'Escaneo', icon: ScanBarcode, permission: 'dropscan.escaneo' },
      { path: '/dropscan/historial', label: 'Historial', icon: History, permission: 'dropscan.historial' },
      { path: '/dropscan/reportes', label: 'Reportes', icon: BarChart3, permission: 'dropscan.reportes' },
    ]
  },
]

const adminNav = [
  { path: '/admin', label: 'Administración', icon: Settings2, permission: 'global.administracion' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, canView } = useAuthStore()

  const initials = user?.nombre_completo
    ? user.nombre_completo.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <aside className={`${collapsed ? 'w-[68px]' : 'w-[260px]'} h-screen 
                        bg-gradient-to-b from-white to-warm-50
                        border-r border-warm-100
                        flex flex-col transition-all duration-300 ease-out shrink-0 relative`}>

      {/* Collapse toggle — circular gradient-primary button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-20 w-6 h-6 rounded-full
                   gradient-primary shadow-lg
                   flex items-center justify-center
                   text-white hover:shadow-xl
                   transition-all duration-300 group"
        title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 group-hover:scale-110 transition-transform" />
          : <ChevronLeft className="w-3 h-3 group-hover:scale-110 transition-transform" />
        }
      </button>

      {/* Logo Header */}
      <div className={`flex items-center gap-3 h-16 border-b border-warm-100/60 shrink-0
                        ${collapsed ? 'px-3 justify-center' : 'px-5'}`}>
        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-sm">
          <Package className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-warm-800 tracking-tight">WMS System</h1>
            <p className="text-[10px] text-warm-400 font-medium">Professional</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2.5">
        {/* Global Dashboard */}
        <NavItem to="/" icon={LayoutDashboard} label="Inicio" collapsed={collapsed} end />

        {/* Module sections */}
        {moduleNav.map((mod) => {
          const visibleItems = mod.items.filter(item => canView(item.permission))
          if (visibleItems.length === 0) return null

          return (
            <div key={mod.id} className="mt-5">
              {!collapsed ? (
                <p className="px-3 mb-2 text-[10px] font-bold text-warm-400 uppercase tracking-[0.08em]">
                  {mod.label}
                </p>
              ) : (
                <div className="flex justify-center mb-2">
                  <div className="w-5 h-[2px] rounded-full bg-warm-200" />
                </div>
              )}
              {visibleItems.map((item) => (
                <NavItem
                  key={item.path}
                  to={item.path}
                  icon={item.icon}
                  label={item.label}
                  collapsed={collapsed}
                  end={item.path === '/dropscan'}
                />
              ))}
            </div>
          )
        })}

        {/* Admin */}
        {adminNav.some(item => canView(item.permission)) && (
          <div className="mt-5">
            {!collapsed ? (
              <p className="px-3 mb-2 text-[10px] font-bold text-warm-400 uppercase tracking-[0.08em]">
                Sistema
              </p>
            ) : (
              <div className="flex justify-center mb-2">
                <div className="w-5 h-[2px] rounded-full bg-warm-200" />
              </div>
            )}
            {adminNav.filter(item => canView(item.permission)).map((item) => (
              <NavItem key={item.path} to={item.path} icon={item.icon} label={item.label} collapsed={collapsed} />
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-warm-100/60 p-3">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600
                          text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-warm-700 truncate">{user?.nombre_completo}</p>
              <p className="text-[10px] text-warm-400 font-medium truncate">{user?.rol_nombre}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function NavItem({ to, icon: Icon, label, collapsed, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 mb-0.5
         ${isActive
          ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100/60'
          : 'text-warm-500 hover:bg-warm-100 hover:text-warm-700'
        }
         ${collapsed ? 'justify-center px-0' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      <Icon className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110`} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}
