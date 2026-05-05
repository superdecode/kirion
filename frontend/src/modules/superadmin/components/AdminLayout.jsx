import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuthStore } from '../stores/adminAuthStore'

const NAV = [
  { to: '/super-admin', label: 'Dashboard', end: true },
  { to: '/super-admin/solicitudes', label: 'Solicitudes' },
  { to: '/super-admin/tenants', label: 'Tenants' },
  { to: '/super-admin/notificaciones', label: 'Notificaciones' },
]

export default function AdminLayout() {
  const { admin, logout } = useAdminAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/super-admin/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <p className="text-white font-bold text-sm">Kerion Admin</p>
          <p className="text-gray-500 text-xs mt-0.5 truncate">{admin?.email}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
