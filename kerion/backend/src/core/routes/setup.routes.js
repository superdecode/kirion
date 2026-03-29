import { Router } from 'express'
import bcrypt from 'bcrypt'
import { query } from '../../config/database.js'

const router = Router()

const DEFAULT_ROLES = [
  {
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema',
    permisos: {
      global: { dashboard: 'total', administracion: 'total' },
      dropscan: { dashboard: 'total', escaneo: 'total', historial: 'total', reportes: 'total', configuracion: 'total' }
    }
  },
  {
    nombre: 'Supervisor',
    descripcion: 'Supervisor de operaciones',
    permisos: {
      global: { dashboard: 'lectura', administracion: 'sin_acceso' },
      dropscan: { dashboard: 'lectura', escaneo: 'gestion', historial: 'gestion', reportes: 'escritura', configuracion: 'escritura' }
    }
  },
  {
    nombre: 'Operador',
    descripcion: 'Operador de escaneo',
    permisos: {
      global: { dashboard: 'lectura', administracion: 'sin_acceso' },
      dropscan: { dashboard: 'lectura', escaneo: 'escritura', historial: 'lectura', reportes: 'sin_acceso', configuracion: 'sin_acceso' }
    }
  },
  {
    nombre: 'Usuario',
    descripcion: 'Solo consulta',
    permisos: {
      global: { dashboard: 'lectura', administracion: 'sin_acceso' },
      dropscan: { dashboard: 'lectura', escaneo: 'sin_acceso', historial: 'lectura', reportes: 'lectura', configuracion: 'sin_acceso' }
    }
  }
]

// POST /api/setup — seeds DB with roles, admin user, and default configs
// Only runs if DB is empty (no roles). Safe to call multiple times.
router.post('/', async (_req, res) => {
  try {
    const existing = await query('SELECT COUNT(*) FROM roles')
    if (parseInt(existing.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'El sistema ya está inicializado.',
        hint: 'Si olvidaste tus credenciales, contacta al administrador de base de datos.'
      })
    }

    // Create roles
    const roleIds = {}
    for (const role of DEFAULT_ROLES) {
      const r = await query(
        `INSERT INTO roles (nombre, descripcion, permisos) VALUES ($1, $2, $3) RETURNING id`,
        [role.nombre, role.descripcion, JSON.stringify(role.permisos)]
      )
      roleIds[role.nombre] = r.rows[0].id
    }

    // Create admin user
    const adminPassword = 'Admin2024!'
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    await query(
      `INSERT INTO usuarios (codigo, nombre_completo, email, password_hash, rol_id, estado)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVO')`,
      ['ADM001', 'Administrador', 'admin@kerion.com', passwordHash, roleIds['Administrador']]
    )

    // Default DropScan configs
    const configs = [
      { tipo: 'empresa', codigo: 'DHL', nombre: 'DHL Express' },
      { tipo: 'empresa', codigo: 'FEDEX', nombre: 'FedEx' },
      { tipo: 'empresa', codigo: 'ESTAFETA', nombre: 'Estafeta' },
      { tipo: 'canal', codigo: 'CANAL-1', nombre: 'Canal 1', es_default: true },
      { tipo: 'canal', codigo: 'CANAL-2', nombre: 'Canal 2' },
    ]
    for (const cfg of configs) {
      const configJson = cfg.tipo === 'canal'
        ? { es_default: cfg.es_default || false, empresa_ids: [] }
        : null
      await query(
        `INSERT INTO configuraciones (modulo, tipo, codigo, nombre, config_json)
         VALUES ('dropscan', $1, $2, $3, $4)
         ON CONFLICT (modulo, tipo, codigo) DO NOTHING`,
        [cfg.tipo, cfg.codigo, cfg.nombre, configJson ? JSON.stringify(configJson) : null]
      )
    }

    res.json({
      success: true,
      message: 'Sistema inicializado correctamente.',
      credentials: {
        email: 'admin@kerion.com',
        password: adminPassword,
        nota: 'Cambia esta contraseña inmediatamente después de iniciar sesión.'
      }
    })
  } catch (error) {
    console.error('Setup error:', error)
    res.status(500).json({ error: 'Error inicializando el sistema: ' + error.message })
  }
})

// GET /api/setup/status — check if DB has been initialized
router.get('/status', async (_req, res) => {
  try {
    const r = await query('SELECT COUNT(*) FROM roles')
    const initialized = parseInt(r.rows[0].count) > 0
    res.json({ initialized, roles: parseInt(r.rows[0].count) })
  } catch (error) {
    res.status(500).json({ error: 'Error verificando estado: ' + error.message })
  }
})

export default router
