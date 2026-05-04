import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Header from '../core/components/layout/Header'
import Modal from '../core/components/common/Modal'
import LoadingSpinner from '../core/components/common/LoadingSpinner'
import { useAuthStore } from '../core/stores/authStore'
import { useToastStore } from '../core/stores/toastStore'
import { useI18nStore } from '../core/stores/i18nStore'
import api from '../core/services/api'
import {
  Users, Shield, Plus, Search, Edit3, Trash2, ToggleLeft, ToggleRight,
  Key, Copy, ChevronDown, CheckCircle, XCircle, Settings2, Check
} from 'lucide-react'

// Module definitions for scalable permission system
const MODULE_GROUPS = [
  {
    group: 'DropScan',
    groupKey: 'admin.group.dropscan',
    modules: [
      { key: 'dropscan.dashboard', label: 'Dashboard' },
      { key: 'dropscan.escaneo', label: 'Escaneo' },
      { key: 'dropscan.historial', label: 'Historial' },
      { key: 'dropscan.reportes', label: 'Reportes' },
      { key: 'dropscan.configuracion', label: 'Configuración' },
    ]
  },
  {
    group: 'Inventario',
    groupKey: 'admin.group.inventory',
    modules: [
      { key: 'inventory.escaneo', label: 'Escaneo' },
      { key: 'inventory.historial', label: 'Historial' },
      { key: 'inventory.reportes', label: 'Reportes' },
    ]
  },
  {
    group: 'Sistema',
    groupKey: 'admin.group.sistema',
    modules: [
      { key: 'global.inicio', label: 'Inicio (Dashboard Global)' },
      { key: 'global.administracion', label: 'Administración' },
      { key: 'global.wms', label: 'WMS Hub (Conexión)' },
    ]
  },
  {
    group: 'Folios (FEP)',
    groupKey: 'admin.group.fep',
    modules: [
      { key: 'fep.folios', label: 'Folios' },
    ]
  },
  {
    group: 'Módulos Futuros',
    groupKey: 'admin.group.future',
    modules: [
      { key: 'despacho.ordenes', label: 'Despacho - Órdenes' },
      { key: 'despacho.validacion', label: 'Despacho - Validación' },
      { key: 'rastreo.consulta', label: 'Rastreo - Consulta' },
      { key: 'integraciones.config', label: 'Integraciones' },
      { key: 'reportes.global', label: 'Reportes Globales' },
    ]
  },
]

const PERM_LEVELS = [
  { value: 'sin_acceso', label: 'Sin acceso', color: 'bg-warm-100 text-warm-500' },
  { value: 'lectura', label: 'Solo lectura', color: 'bg-warning-100 text-warning-700' },
  { value: 'escritura', label: 'Lectura/Escritura', color: 'bg-success-100 text-success-700' },
  { value: 'gestion', label: 'Gestión', color: 'bg-accent-100 text-accent-700' },
  { value: 'total', label: 'Administrador', color: 'bg-primary-100 text-primary-700' },
]

const LEVEL_ORDER = ['sin_acceso', 'lectura', 'escritura', 'gestion', 'total']

const COL_DEFS = [
  { key: 'ver', label: 'Ver', level: 'lectura' },
  { key: 'crear', label: 'Crear', level: 'escritura' },
  { key: 'actualizar', label: 'Actualizar', level: 'gestion' },
  { key: 'eliminar', label: 'Eliminar', level: 'total' },
]

// API helpers
const getUsers = async () => { const { data } = await api.get('/users'); return data }
const getRoles = async () => { const { data } = await api.get('/roles'); return data }

const isActive = (u) => u.estado !== 'INACTIVO' && u.activo !== false

export default function Administracion() {
  const { t } = useI18nStore()
  const [tab, setTab] = useState('usuarios')
  const { canWrite, canDelete } = useAuthStore()
  const canEditAdmin = canWrite('global.administracion')
  const canDeleteAdmin = canDelete('global.administracion')

  return (
    <div className="flex flex-col h-full">
      <Header title={t('admin.title')} subtitle={t('admin.subtitle')} />

      <div className="flex-1 overflow-y-auto">
        {/* Tab bar */}
        <div className="sticky top-0 z-[5] bg-white/60 backdrop-blur-2xl border-b border-warm-100/40 px-6">
          <div className="flex gap-1">
            {[
              { key: 'usuarios', label: t('admin.users'), icon: Users },
              { key: 'roles', label: t('admin.roles'), icon: Shield },
            ].map(item => (
              <button key={item.key} onClick={() => setTab(item.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all duration-200
                  ${tab === item.key
                    ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                    : 'border-transparent text-warm-500 hover:text-warm-700 hover:bg-warm-50'
                  }`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="max-w-full mx-auto">
            {tab === 'usuarios' ? (
              <UsersTab canEdit={canEditAdmin} canDel={canDeleteAdmin} />
            ) : (
              <RolesTab canEdit={canEditAdmin} canDel={canDeleteAdmin} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════ PASSWORD RESET MODAL ═══════════
function PasswordResetModal({ isOpen, onClose, user }) {
  const [password, setPassword] = useState('')
  const toast = useToastStore.getState()
  const qc = useQueryClient()

  useEffect(() => {
    if (isOpen) setPassword('')
  }, [isOpen])

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/users/${user.id}/reset-password`, data),
    onSuccess: () => { toast.success('Contraseña restablecida exitosamente'); qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose() },
    onError: (e) => toast.error(e.response?.data?.error || 'Error restableciendo contraseña')
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!password.trim()) { toast.warning('La contraseña es requerida'); return }
    mutation.mutate({ password })
  }

  if (!user) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Resetear contraseña: ${user.nombre_completo}`} icon={Key} size="sm"
      footer={<>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
        <button onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Guardando...' : 'Resetear Contraseña'}
        </button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-warm-700 mb-1.5">Nueva contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="input-field" required autoFocus />
        </div>
      </form>
    </Modal>
  )
}

// ═══════════ USERS TAB ═══════════
function UsersTab({ canEdit, canDel }) {
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [resetUser, setResetUser] = useState(null)
  const toast = useToastStore.getState()
  const qc = useQueryClient()

  const { data, isLoading, isError: usersError } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, retry: 1 })
  const { data: rolesData } = useQuery({ queryKey: ['admin-roles'], queryFn: getRoles, retry: 1 })
  const users = data?.usuarios || data?.users || []
  const roles = rolesData?.roles || []

  const filtered = search
    ? users.filter(u => u.nombre_completo?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.codigo?.toLowerCase().includes(search.toLowerCase()))
    : users

  const toggleMutation = useMutation({
    mutationFn: (user) => api.put(`/users/${user.id}`, { estado: isActive(user) ? 'INACTIVO' : 'ACTIVO' }),
    onSuccess: () => { toast.success('Estado actualizado'); qc.invalidateQueries({ queryKey: ['admin-users'] }) },
    onError: () => toast.error('Error actualizando estado')
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success('Usuario eliminado'); qc.invalidateQueries({ queryKey: ['admin-users'] }) },
    onError: (e) => toast.error(e.response?.data?.error || 'Error eliminando')
  })

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuarios..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-warm-200 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <span className="badge bg-warm-100 text-warm-500">{filtered.length} usuarios</span>
        {canEdit && (
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 ml-auto">
            <Plus className="w-4 h-4" /> Nuevo Usuario
          </button>
        )}
      </div>

      {/* Users table */}
      {isLoading ? <LoadingSpinner text="Cargando usuarios..." /> : usersError ? (
        <div className="card p-6 text-center text-warm-500">Error cargando usuarios. Verifica tu sesión e intenta de nuevo.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-warm-50 to-purple-50 border-b border-warm-200">
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Usuario</th>
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Email</th>
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Código</th>
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Rol</th>
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Estado</th>
                  {canEdit && <th className="text-right px-4 py-3 font-bold text-warm-600">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {filtered.map(u => {
                  const initials = u.nombre_completo?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
                  const role = roles.find(r => r.id === u.rol_id)
                  return (
                    <tr key={u.id} className="hover:bg-purple-50/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                            {initials}
                          </div>
                          <span className="font-semibold text-warm-800">{u.nombre_completo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-warm-600">{u.email}</td>
                      <td className="px-4 py-3 font-mono text-warm-500">{u.codigo}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-primary-100 text-primary-700">{role?.nombre || u.rol_nombre || 'Sin rol'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${isActive(u) ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'}`}>
                          {isActive(u) ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditUser(u)} className="p-2 rounded-lg hover:bg-primary-50 text-warm-400 hover:text-primary-600 transition-all" title="Editar">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => toggleMutation.mutate(u)}
                              className="p-2 rounded-lg hover:bg-warm-100 text-warm-400 hover:text-warm-600 transition-all" title={isActive(u) ? 'Desactivar' : 'Activar'}>
                              {isActive(u) ? <ToggleRight className="w-4 h-4 text-success-500" /> : <ToggleLeft className="w-4 h-4 text-warm-400" />}
                            </button>
                            <button onClick={() => setResetUser(u)} className="p-2 rounded-lg hover:bg-warning-50 text-warm-400 hover:text-warning-600 transition-all" title="Resetear contraseña">
                              <Key className="w-4 h-4" />
                            </button>
                            {canDel && (
                              <button onClick={() => { if (confirm(`¿Eliminar usuario ${u.nombre_completo}?`)) deleteMutation.mutate(u.id) }}
                                className="p-2 rounded-lg hover:bg-danger-50 text-warm-400 hover:text-danger-500 transition-all" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit User Modal */}
      <UserFormModal isOpen={showCreate || !!editUser} onClose={() => { setShowCreate(false); setEditUser(null) }}
        user={editUser} roles={roles} />

      {/* Password Reset Modal */}
      <PasswordResetModal isOpen={!!resetUser} onClose={() => setResetUser(null)} user={resetUser} />
    </div>
  )
}

function UserFormModal({ isOpen, onClose, user, roles }) {
  const [form, setForm] = useState({ nombre_completo: '', email: '', codigo: '', password: '', rol_id: '', estado: 'ACTIVO' })
  const toast = useToastStore.getState()
  const qc = useQueryClient()

  // Populate on open
  useEffect(() => {
    if (user) {
      setForm({
        nombre_completo: user.nombre_completo || '',
        email: user.email || '',
        codigo: user.codigo || '',
        password: '',
        rol_id: user.rol_id || '',
        estado: user.estado || (isActive(user) ? 'ACTIVO' : 'INACTIVO'),
      })
    } else {
      setForm({ nombre_completo: '', email: '', codigo: '', password: '', rol_id: '', estado: 'ACTIVO' })
    }
  }, [user])

  const mutation = useMutation({
    mutationFn: (data) => user ? api.put(`/users/${user.id}`, data) : api.post('/users', data),
    onSuccess: () => { toast.success(user ? 'Usuario actualizado' : 'Usuario creado'); qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose() },
    onError: (e) => toast.error(e.response?.data?.error || 'Error guardando usuario')
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form, rol_id: parseInt(form.rol_id) || undefined }
    if (!user && !payload.password) { toast.warning('La contraseña es requerida'); return }
    if (user && !payload.password) delete payload.password
    mutation.mutate(payload)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={user ? 'Editar Usuario' : 'Nuevo Usuario'} icon={Users} size="md"
      footer={<>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
        <button onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Guardando...' : user ? 'Actualizar' : 'Crear Usuario'}
        </button>
      </>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-warm-700 mb-1.5">Nombre completo</label>
          <input value={form.nombre_completo} onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
            className="input-field" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1.5">Código</label>
            <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
              className="input-field" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-warm-700 mb-1.5">
            {user ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña'}
          </label>
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="input-field" {...(!user ? { required: true } : {})} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-warm-700 mb-1.5">Rol</label>
          <select value={form.rol_id} onChange={e => setForm(f => ({ ...f, rol_id: e.target.value }))} className="select-field" required>
            <option value="">Seleccionar rol...</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre} — {r.descripcion}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-warm-700 mb-1.5">Estado</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, estado: f.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' }))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                form.estado === 'ACTIVO'
                  ? 'bg-success-100 text-success-700 ring-1 ring-success-200'
                  : 'bg-danger-100 text-danger-700 ring-1 ring-danger-200'
              }`}>
              {form.estado === 'ACTIVO' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {form.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ═══════════ ROLES TAB ═══════════
function RolesTab({ canEdit, canDel }) {
  const [editRole, setEditRole] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const toast = useToastStore.getState()
  const qc = useQueryClient()
  const { t } = useI18nStore()

  const { data, isLoading, isError: rolesError } = useQuery({ queryKey: ['admin-roles'], queryFn: getRoles, retry: 1 })
  const { data: usersData } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers, retry: 1 })
  const roles = data?.roles || data || []
  const users = usersData?.usuarios || usersData?.users || []

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/roles/${id}`),
    onSuccess: () => { toast.success('Rol eliminado'); qc.invalidateQueries({ queryKey: ['admin-roles'] }) },
    onError: (e) => toast.error(e.response?.data?.error || 'Error eliminando rol')
  })

  const duplicateMutation = useMutation({
    mutationFn: (role) => api.post(`/roles/${role.id}/duplicate`),
    onSuccess: () => { toast.success('Rol duplicado'); qc.invalidateQueries({ queryKey: ['admin-roles'] }) },
    onError: (e) => toast.error(e.response?.data?.error || 'Error duplicando')
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="badge bg-warm-100 text-warm-500">{roles.length} roles</span>
        {canEdit && (
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 ml-auto">
            <Plus className="w-4 h-4" /> Nuevo Rol
          </button>
        )}
      </div>

      {isLoading ? <LoadingSpinner text="Cargando roles..." /> : rolesError ? (
        <div className="card p-6 text-center text-warm-500">Error cargando roles. Verifica tu sesión e intenta de nuevo.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-warm-50 to-purple-50 border-b border-warm-200">
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Rol</th>
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Descripción</th>
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Usuarios</th>
                  <th className="text-left px-4 py-3 font-bold text-warm-600">Permisos</th>
                  {canEdit && <th className="text-right px-4 py-3 font-bold text-warm-600">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {roles.map(r => {
                  const userCount = users.filter(u => u.rol_id === r.id).length
                  return (
                    <tr key={r.id} className="hover:bg-purple-50/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center shadow-sm shrink-0">
                            <Shield className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-warm-800">{r.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-warm-600">{r.descripcion || 'Sin descripción'}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-warm-100 text-warm-500">{userCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {(() => {
                            const accessible = []
                            if (r.permisos && typeof r.permisos === 'object') {
                              MODULE_GROUPS.forEach(g => {
                                g.modules.forEach(m => {
                                  const parts = m.key.split('.')
                                  const level = parts.length === 2
                                    ? r.permisos[parts[0]]?.[parts[1]]
                                    : r.permisos[parts[0]]
                                  if (level && level !== 'sin_acceso') accessible.push(m.label)
                                })
                              })
                            }
                            if (accessible.length === 0) {
                              return <span className="text-[11px] text-warm-400">{t('admin.noAccess')}</span>
                            }
                            return (
                              <>
                                {accessible.slice(0, 6).map(label => (
                                  <span key={label} className="badge bg-primary-100 text-primary-700 text-[10px]">{label}</span>
                                ))}
                                {accessible.length > 6 && (
                                  <span className="badge bg-warm-100 text-warm-400 text-[10px]">+{accessible.length - 6}</span>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditRole(r)} className="p-2 rounded-lg hover:bg-primary-50 text-warm-400 hover:text-primary-600 transition-all" title="Editar permisos">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => duplicateMutation.mutate(r)} className="p-2 rounded-lg hover:bg-warm-100 text-warm-400 hover:text-warm-600 transition-all" title="Duplicar rol">
                              <Copy className="w-4 h-4" />
                            </button>
                            {canDel && userCount === 0 && (
                              <button onClick={() => { if (confirm(`¿Eliminar rol ${r.nombre}?`)) deleteMutation.mutate(r.id) }}
                                className="p-2 rounded-lg hover:bg-danger-50 text-warm-400 hover:text-danger-500 transition-all" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RoleFormModal isOpen={showCreate || !!editRole} onClose={() => { setShowCreate(false); setEditRole(null) }} role={editRole} />
    </div>
  )
}

function PermCheckbox({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-[18px] h-[18px] rounded flex items-center justify-center border-2 transition-all duration-150 mx-auto shrink-0
        ${checked
          ? 'bg-primary-600 border-primary-600 text-white shadow-sm shadow-primary-200/60'
          : 'bg-white border-warm-300 hover:border-primary-400 hover:bg-primary-50'
        }`}
    >
      {checked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
    </button>
  )
}

function RoleFormModal({ isOpen, onClose, role }) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [permisos, setPermisos] = useState({})
  const toast = useToastStore.getState()
  const qc = useQueryClient()
  const { t } = useI18nStore()
  const colLabels = [
    { key: 'ver', label: t('admin.view'), level: 'lectura' },
    { key: 'crear', label: t('admin.create'), level: 'escritura' },
    { key: 'actualizar', label: t('admin.update'), level: 'gestion' },
    { key: 'eliminar', label: t('admin.delete'), level: 'total' },
  ]

  // Populate
  useEffect(() => {
    if (role) {
      setNombre(role.nombre || '')
      setDescripcion(role.descripcion || '')
      setPermisos(role.permisos && typeof role.permisos === 'object' ? JSON.parse(JSON.stringify(role.permisos)) : {})
    } else {
      setNombre('')
      setDescripcion('')
      setPermisos({})
    }
  }, [role])

  const mutation = useMutation({
    mutationFn: (data) => role ? api.put(`/roles/${role.id}`, data) : api.post('/roles', data),
    onSuccess: () => { toast.success(role ? 'Rol actualizado' : 'Rol creado'); qc.invalidateQueries({ queryKey: ['admin-roles'] }); onClose() },
    onError: (e) => toast.error(e.response?.data?.error || 'Error guardando rol')
  })

  const setPermLevel = (moduleKey, level) => {
    const parts = moduleKey.split('.')
    setPermisos(prev => {
      const next = { ...prev }
      if (parts.length === 2) {
        if (!next[parts[0]]) next[parts[0]] = {}
        next[parts[0]] = { ...next[parts[0]], [parts[1]]: level }
      } else {
        next[parts[0]] = level
      }
      return next
    })
  }

  const getPermLevel = (moduleKey) => {
    const parts = moduleKey.split('.')
    if (parts.length === 2) return permisos[parts[0]]?.[parts[1]] || 'sin_acceso'
    return permisos[parts[0]] || 'sin_acceso'
  }

  const handleSubmit = () => {
    if (!nombre.trim()) { toast.warning('El nombre es requerido'); return }
    mutation.mutate({ nombre, descripcion, permisos })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={role ? `Editar: ${role.nombre}` : 'Nuevo Rol'} icon={Shield} size="xl"
      footer={<>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
        <button onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Guardando...' : role ? 'Actualizar Rol' : 'Crear Rol'}
        </button>
      </>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1.5">Nombre del Rol</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1.5">Descripción</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Permission matrix */}
        <div>
          <h4 className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-3">{t('admin.permsByModule')}</h4>
          <div className="rounded-xl border border-warm-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-primary-600 to-primary-700">
                  <th className="text-left px-4 py-3 text-white font-semibold text-xs uppercase tracking-wide w-[42%]">{t('admin.module')}</th>
                  {colLabels.map(col => (
                    <th key={col.key} className="text-center px-3 py-3 text-white font-semibold text-xs uppercase tracking-wide">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULE_GROUPS.map(g => (
                  <>
                    <tr key={`g-${g.groupKey}`} className="bg-primary-50 border-y border-primary-100">
                      <td colSpan={5} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-600">
                        {t(g.groupKey) || g.group}
                      </td>
                    </tr>
                    {g.modules.map((m, i) => {
                      const current = getPermLevel(m.key)
                      const enabled = current !== 'sin_acceso'
                      return (
                        <tr key={m.key} className={`border-b border-warm-100 transition-colors hover:bg-primary-50/40 ${i % 2 === 0 ? 'bg-white' : 'bg-warm-50/30'}`}>
                          <td className="px-4 py-2.5">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                              <PermCheckbox
                                checked={enabled}
                                onChange={() => setPermLevel(m.key, enabled ? 'sin_acceso' : 'lectura')}
                              />
                              <span className={`text-sm font-medium leading-snug ${enabled ? 'text-warm-800' : 'text-warm-400'}`}>{m.label}</span>
                            </label>
                          </td>
                          {colLabels.map(col => {
                            const colIdx = LEVEL_ORDER.indexOf(col.level)
                            const curIdx = LEVEL_ORDER.indexOf(current)
                            const checked = curIdx >= colIdx
                            return (
                              <td key={col.key} className="text-center px-3 py-2.5">
                                <PermCheckbox
                                  checked={checked}
                                  onChange={() => {
                                    if (curIdx >= colIdx) {
                                      setPermLevel(m.key, LEVEL_ORDER[colIdx - 1])
                                    } else {
                                      setPermLevel(m.key, col.level)
                                    }
                                  }}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
