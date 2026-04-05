import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Toast from '../common/Toast'
import ConnectionBanner from '../common/ConnectionBanner'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export default function MainLayout() {
  useOnlineStatus()

  return (
    <div className="flex h-screen overflow-hidden bg-warm-50 bg-gradient-mesh">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-4">
        <ConnectionBanner />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  )
}
