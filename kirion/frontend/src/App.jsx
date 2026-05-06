import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './core/stores/authStore'

// Layout
import MainLayout from './core/components/layout/MainLayout'
import ErrorBoundary from './core/components/common/ErrorBoundary'

// Auth
import Login from './core/components/auth/Login'
import ProtectedRoute, { PermissionRoute } from './core/components/auth/ProtectedRoute'

// Pages
import GlobalDashboard from './pages/GlobalDashboard'
import Administracion from './pages/Administracion'

// DropScan Module
import DropScanDashboard from './modules/dropscan/pages/Dashboard'
import Escaneo from './modules/dropscan/pages/Escaneo'
import Historial from './modules/dropscan/pages/Historial'
import Reportes from './modules/dropscan/pages/Reportes'
import Configuracion from './modules/dropscan/pages/Configuracion'

// Inventory Module
import InvEscaneo from './modules/inventory/pages/Escaneo'
import InvHistorial from './modules/inventory/pages/Historial'
import InvReportes from './modules/inventory/pages/Reportes'

// WMS Hub
import WmsHub from './pages/WmsHub'

// FEP Module
import Folios from './modules/fep/pages/Folios'
import FolioDetalle from './modules/fep/pages/FolioDetalle'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
})

// Smart redirect: if user can't view global dashboard, redirect to first allowed module
const MODULE_ROUTES = [
  { module: 'global.inicio', path: '/' },
  { module: 'dropscan.dashboard', path: '/dropscan' },
  { module: 'dropscan.escaneo', path: '/dropscan/escaneo' },
  { module: 'dropscan.historial', path: '/dropscan/historial' },
  { module: 'dropscan.reportes', path: '/dropscan/reportes' },
  { module: 'dropscan.configuracion', path: '/dropscan/configuracion' },
  { module: 'inventory.escaneo', path: '/inventory/escaneo' },
  { module: 'inventory.historial', path: '/inventory/historial' },
  { module: 'inventory.reportes', path: '/inventory/reportes' },
  { module: 'fep.folios', path: '/dropscan/folios' },
  { module: 'global.wms', path: '/wms' },
  { module: 'global.administracion', path: '/admin' },
]

function SmartRedirect() {
  const { canView } = useAuthStore()
  if (canView('global.inicio')) return <GlobalDashboard />
  const first = MODULE_ROUTES.find(r => r.path !== '/' && canView(r.module))
  if (first) return <Navigate to={first.path} replace />
  return <GlobalDashboard />
}

function AppRoutes() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />

      {/* Protected */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Global — smart redirect if no dashboard access */}
        <Route path="/" element={<ErrorBoundary><SmartRedirect /></ErrorBoundary>} />

        {/* DropScan Module */}
        <Route path="/dropscan" element={
          <PermissionRoute module="dropscan.dashboard"><ErrorBoundary><DropScanDashboard /></ErrorBoundary></PermissionRoute>
        } />
        <Route path="/dropscan/escaneo" element={
          <PermissionRoute module="dropscan.escaneo"><ErrorBoundary><Escaneo /></ErrorBoundary></PermissionRoute>
        } />
        <Route path="/dropscan/historial" element={
          <PermissionRoute module="dropscan.historial"><ErrorBoundary><Historial /></ErrorBoundary></PermissionRoute>
        } />
        <Route path="/dropscan/reportes" element={
          <PermissionRoute module="dropscan.reportes"><ErrorBoundary><Reportes /></ErrorBoundary></PermissionRoute>
        } />
        <Route path="/dropscan/configuracion" element={
          <PermissionRoute module="dropscan.configuracion"><ErrorBoundary><Configuracion /></ErrorBoundary></PermissionRoute>
        } />

        {/* Inventory Module */}
        <Route path="/inventory/escaneo" element={
          <PermissionRoute module="inventory.escaneo"><ErrorBoundary><InvEscaneo /></ErrorBoundary></PermissionRoute>
        } />
        <Route path="/inventory/historial" element={
          <PermissionRoute module="inventory.historial"><ErrorBoundary><InvHistorial /></ErrorBoundary></PermissionRoute>
        } />
        <Route path="/inventory/reportes" element={
          <PermissionRoute module="inventory.reportes"><ErrorBoundary><InvReportes /></ErrorBoundary></PermissionRoute>
        } />

        {/* FEP — embedded inside DropScan */}
        <Route path="/dropscan/folios" element={
          <PermissionRoute module="fep.folios"><ErrorBoundary><Folios /></ErrorBoundary></PermissionRoute>
        } />
        <Route path="/dropscan/folios/:id" element={
          <PermissionRoute module="fep.folios"><ErrorBoundary><FolioDetalle /></ErrorBoundary></PermissionRoute>
        } />

        {/* WMS Hub */}
        <Route path="/wms" element={
          <PermissionRoute module="global.wms"><ErrorBoundary><WmsHub /></ErrorBoundary></PermissionRoute>
        } />

        {/* Administration (unified users + roles) */}
        <Route path="/admin" element={
          <PermissionRoute module="global.administracion"><ErrorBoundary><Administracion /></ErrorBoundary></PermissionRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
