import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import {
  LayoutDashboard, ScanBarcode, History, BarChart3,
  ChevronLeft, ChevronRight,
  Package, Settings2, Settings
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
      { path: '/dropscan/configuracion', label: 'Configuración', icon: Settings, permission: 'dropscan.configuracion' },
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
    <motion.aside
      className="h-screen bg-white/90 backdrop-blur-xl border-r border-warm-100/60
                 flex flex-col shrink-0 relative overflow-hidden"
      animate={{ width: collapsed ? 68 : 260 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background mesh gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-50/30 via-transparent to-accent-50/20 pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary-100/20 rounded-full blur-3xl pointer-events-none" />

      {/* Collapse toggle */}
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-20 w-6 h-6 rounded-full
                   gradient-primary shadow-lg
                   flex items-center justify-center
                   text-white hover:shadow-glow
                   transition-shadow duration-300 group"
        title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
      >
        <motion.div
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronRight className="w-3 h-3" />
        </motion.div>
      </motion.button>

      {/* Logo Header */}
      <div className={`flex items-center gap-3 h-16 border-b border-warm-100/40 shrink-0 relative z-10
                        ${collapsed ? 'px-3 justify-center' : 'px-5'}`}>
        <motion.div
          className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-glow"
          whileHover={{ scale: 1.08, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <Package className="w-5 h-5 text-white" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              className="flex-1 min-w-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-sm font-bold text-gradient-vibrant tracking-tight">WMS System</h1>
              <p className="text-[10px] text-warm-400 font-medium">Professional</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2.5 relative z-10">
        {/* Global Dashboard */}
        <NavItem to="/" icon={LayoutDashboard} label="Inicio" collapsed={collapsed} end />

        {/* Module sections */}
        {moduleNav.map((mod) => {
          const visibleItems = mod.items.filter(item => canView(item.permission))
          if (visibleItems.length === 0) return null

          return (
            <div key={mod.id} className="mt-5">
              <AnimatePresence>
                {!collapsed ? (
                  <motion.p
                    className="px-3 mb-2 text-[10px] font-bold text-warm-400 uppercase tracking-[0.08em]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {mod.label}
                  </motion.p>
                ) : (
                  <div className="flex justify-center mb-2">
                    <div className="w-5 h-[2px] rounded-full bg-warm-200" />
                  </div>
                )}
              </AnimatePresence>
              {visibleItems.map((item, i) => (
                <NavItem
                  key={item.path}
                  to={item.path}
                  icon={item.icon}
                  label={item.label}
                  collapsed={collapsed}
                  end={item.path === '/dropscan'}
                  index={i}
                />
              ))}
            </div>
          )
        })}

        {/* Admin */}
        {adminNav.some(item => canView(item.permission)) && (
          <div className="mt-5">
            <AnimatePresence>
              {!collapsed ? (
                <motion.p
                  className="px-3 mb-2 text-[10px] font-bold text-warm-400 uppercase tracking-[0.08em]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Sistema
                </motion.p>
              ) : (
                <div className="flex justify-center mb-2">
                  <div className="w-5 h-[2px] rounded-full bg-warm-200" />
                </div>
              )}
            </AnimatePresence>
            {adminNav.filter(item => canView(item.permission)).map((item) => (
              <NavItem key={item.path} to={item.path} icon={item.icon} label={item.label} collapsed={collapsed} />
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-warm-100/40 p-3 relative z-10">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <motion.div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500
                        text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm"
            whileHover={{ scale: 1.08 }}
          >
            {initials}
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                className="flex-1 min-w-0"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm font-semibold text-warm-700 truncate">{user?.nombre_completo}</p>
                <p className="text-[10px] text-warm-400 font-medium truncate">{user?.rol_nombre}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}

function NavItem({ to, icon: Icon, label, collapsed, end = false, index = 0 }) {
  const location = useLocation()
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive: active }) =>
        `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 mb-0.5
         ${active
          ? 'text-primary-700'
          : 'text-warm-500 hover:text-warm-700'
        }
         ${collapsed ? 'justify-center px-0' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      {/* Active background with glow */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 bg-gradient-to-r from-primary-50 to-primary-50/50 rounded-xl border border-primary-100/60 shadow-sm"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
      {/* Hover background */}
      {!isActive && (
        <div className="absolute inset-0 rounded-xl bg-transparent group-hover:bg-warm-100/60 transition-colors duration-200" />
      )}
      <div className="relative z-10 flex items-center gap-3">
        <Icon className={`w-[18px] h-[18px] shrink-0 transition-all duration-200
                         group-hover:scale-110 ${isActive ? 'text-primary-600' : ''}`} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="truncate"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </NavLink>
  )
}
