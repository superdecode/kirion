import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Package, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(email, password)
    if (result.success) {
      navigate('/')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-50 via-primary-50/30 to-warm-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-card p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 flex items-center justify-center mb-4 shadow-glow">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-warm-800">WMS System</h1>
            <p className="text-sm text-warm-400 mt-1">Sistema de Gestión de Almacén</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoFocus
                className="input-field py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field py-3 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-5 border-t border-warm-100">
            <p className="text-xs text-warm-400 text-center mb-2">Credenciales de prueba</p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => { setEmail('admin@wms.com'); setPassword('admin123') }}
                className="w-full text-xs text-warm-500 hover:text-primary-600 hover:bg-primary-50 
                           rounded-xl py-2 px-3 transition-all text-left">
                <span className="font-semibold">Admin:</span> admin@wms.com / admin123
              </button>
              <button
                type="button"
                onClick={() => { setEmail('operador@wms.com'); setPassword('operador123') }}
                className="w-full text-xs text-warm-500 hover:text-primary-600 hover:bg-primary-50 
                           rounded-xl py-2 px-3 transition-all text-left">
                <span className="font-semibold">Operador:</span> operador@wms.com / operador123
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-warm-400 mt-6">
          WMS Professional v1.0.0
        </p>
      </div>
    </div>
  )
}
