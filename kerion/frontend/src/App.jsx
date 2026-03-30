import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './core/stores/authStore'

// Layout
import MainLayout from './core/components/layout/MainLayout'

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
})

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
        {/* Global */}
        <Route path="/" element={
          <PermissionRoute module="global.inicio"><GlobalDashboard /></PermissionRoute>
        } />

        {/* DropScan Module */}
        <Route path="/dropscan" element={
          <PermissionRoute module="dropscan.dashboard"><DropScanDashboard /></PermissionRoute>
        } />
        <Route path="/dropscan/escaneo" element={
          <PermissionRoute module="dropscan.escaneo"><Escaneo /></PermissionRoute>
        } />
        <Route path="/dropscan/historial" element={
          <PermissionRoute module="dropscan.historial"><Historial /></PermissionRoute>
        } />
        <Route path="/dropscan/reportes" element={
          <PermissionRoute module="dropscan.reportes"><Reportes /></PermissionRoute>
        } />
        <Route path="/dropscan/configuracion" element={
          <PermissionRoute module="dropscan.configuracion"><Configuracion /></PermissionRoute>
        } />

        {/* Administration (unified users + roles) */}
        <Route path="/admin" element={
          <PermissionRoute module="global.administracion"><Administracion /></PermissionRoute>
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
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
