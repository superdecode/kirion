import { useToastStore } from '../../stores/toastStore'
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles = {
  success: 'bg-success-50 border-success-400 text-success-800',
  error: 'bg-danger-50 border-danger-400 text-danger-800',
  warning: 'bg-warning-50 border-warning-400 text-warning-800',
  info: 'bg-primary-50 border-primary-400 text-primary-800',
}

const iconStyles = {
  success: 'text-success-500',
  error: 'text-danger-500',
  warning: 'text-warning-500',
  info: 'text-primary-500',
}

export default function Toast() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || Info
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-card animate-slide-in ${styles[toast.type] || styles.info}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconStyles[toast.type]}`} />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
