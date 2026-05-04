import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import env from './config/env.js'
import { query } from './config/database.js'

// Core routes
import authRoutes from './core/routes/auth.routes.js'
import usersRoutes from './core/routes/users.routes.js'
import rolesRoutes from './core/routes/roles.routes.js'
import configRoutes from './core/routes/config.routes.js'
import setupRoutes from './core/routes/setup.routes.js'
import wmsRoutes from './core/routes/wms.routes.js'

// Module routes
import scanRoutes from './modules/dropscan/routes/scan.routes.js'
import tarimasRoutes from './modules/dropscan/routes/tarimas.routes.js'
import dashboardRoutes from './modules/dropscan/routes/dashboard.routes.js'
import dropscanConfigRoutes from './modules/dropscan/routes/config.routes.js'
import operadoresRoutes from './modules/dropscan/routes/operadores.routes.js'

// Inventory module routes
import invScanRoutes from './modules/inventory/routes/scan.routes.js'
import invHistoryRoutes from './modules/inventory/routes/history.routes.js'

// FEP module routes
import fepFoliosRoutes from './modules/fep/routes/folios.routes.js'

const app = express()

// Security
app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))

// Rate limiting — global (all /api routes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' }
})
app.use('/api', generalLimiter)

// Rate limiting — stricter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intenta más tarde' }
})

// Body parsing — 1mb is sufficient for all API payloads
app.use(express.json({ limit: '1mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

// Core API routes
app.use('/api/auth', loginLimiter, authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/roles', rolesRoutes)
app.use('/api/config', configRoutes)
app.use('/api/setup', setupRoutes)
app.use('/api/wms', wmsRoutes)

// DropScan module routes
app.use('/api/dropscan', scanRoutes)
app.use('/api/dropscan/tarimas', tarimasRoutes)
app.use('/api/dropscan/dashboard', dashboardRoutes)
app.use('/api/dropscan/config', dropscanConfigRoutes)
app.use('/api/dropscan/operadores', operadoresRoutes)

// Inventory module routes
app.use('/api/inventory', invScanRoutes)
app.use('/api/inventory', invHistoryRoutes)

// FEP module routes
app.use('/api/fep/folios', fepFoliosRoutes)

// Auto-apply pending migrations (idempotent — each step is independent)
async function runMigrations() {
  const steps = [
    `CREATE TABLE IF NOT EXISTS usuarios_internos (
       id SERIAL PRIMARY KEY,
       nombre VARCHAR(50) NOT NULL,
       pin_hash VARCHAR(255) NOT NULL,
       activo BOOLEAN DEFAULT true,
       eliminado BOOLEAN DEFAULT false,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       created_by INTEGER REFERENCES usuarios(id),
       updated_by INTEGER REFERENCES usuarios(id)
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_internos_nombre
       ON usuarios_internos(nombre) WHERE eliminado = false`,
    `CREATE INDEX IF NOT EXISTS idx_usuarios_internos_activo
       ON usuarios_internos(activo) WHERE eliminado = false`,
    `CREATE TABLE IF NOT EXISTS logs_usuarios_internos (
       id SERIAL PRIMARY KEY,
       evento VARCHAR(50) NOT NULL,
       usuario_interno_id INTEGER REFERENCES usuarios_internos(id) ON DELETE SET NULL,
       usuario_interno_nombre VARCHAR(50),
       usuario_sistema_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
       usuario_sistema_email VARCHAR(100),
       detalles JSONB,
       ip_address VARCHAR(45),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE INDEX IF NOT EXISTS idx_logs_ui_evento ON logs_usuarios_internos(evento)`,
    `CREATE INDEX IF NOT EXISTS idx_logs_ui_usuario ON logs_usuarios_internos(usuario_interno_id)`,
    `CREATE INDEX IF NOT EXISTS idx_logs_ui_created ON logs_usuarios_internos(created_at)`,
    `ALTER TABLE sesiones_escaneo ADD COLUMN IF NOT EXISTS usuario_operador VARCHAR(100)`,
    `ALTER TABLE sesiones_escaneo ADD COLUMN IF NOT EXISTS usuario_interno_id INTEGER REFERENCES usuarios_internos(id)`,
    `ALTER TABLE sesiones_escaneo ADD COLUMN IF NOT EXISTS nivel_usuario VARCHAR(30)`,
    `ALTER TABLE guias ADD COLUMN IF NOT EXISTS usuario_operador VARCHAR(100)`,
    `ALTER TABLE guias ADD COLUMN IF NOT EXISTS nivel_usuario VARCHAR(30)`,
    `ALTER TABLE guias ADD COLUMN IF NOT EXISTS usuario_interno_id INTEGER REFERENCES usuarios_internos(id)`,
    `CREATE INDEX IF NOT EXISTS idx_guias_usuario_interno ON guias(usuario_interno_id)`,

    // ── WMS credentials ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS wms_credentials (
       id SERIAL PRIMARY KEY,
       app_key TEXT NOT NULL,
       app_secret_encrypted TEXT NOT NULL,
       base_url TEXT NOT NULL DEFAULT 'https://api.xlwms.com/openapi/v1',
       is_active BOOLEAN DEFAULT true,
       created_at TIMESTAMPTZ DEFAULT now(),
       updated_at TIMESTAMPTZ DEFAULT now()
     )`,

    // ── WMS cache ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS wms_cache (
       key TEXT PRIMARY KEY,
       data JSONB NOT NULL,
       expires_at TIMESTAMPTZ NOT NULL,
       created_at TIMESTAMPTZ DEFAULT now()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_wms_cache_expires ON wms_cache(expires_at)`,

    // ── Inventory sessions ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS inventory_sessions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT NOT NULL,
       origin_location TEXT,
       status TEXT DEFAULT 'active' CHECK (status IN ('active','closed')),
       started_at TIMESTAMPTZ DEFAULT now(),
       ended_at TIMESTAMPTZ
     )`,
    `CREATE INDEX IF NOT EXISTS idx_inv_sessions_user ON inventory_sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_sessions_status ON inventory_sessions(status)`,

    // ── Inventory scans ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS inventory_scans (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       session_id UUID REFERENCES inventory_sessions(id) ON DELETE CASCADE NOT NULL,
       user_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT NOT NULL,
       barcode TEXT NOT NULL,
       sku TEXT,
       product_name TEXT,
       cell_no TEXT,
       available_stock INTEGER,
       status TEXT NOT NULL CHECK (status IN ('OK','Bloqueado','NoWMS')),
       created_at TIMESTAMPTZ DEFAULT now()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_inv_scans_session ON inventory_scans(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_scans_user ON inventory_scans(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_scans_barcode ON inventory_scans(barcode)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_scans_created ON inventory_scans(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_scans_status ON inventory_scans(status)`,

    // ── Backfill existing roles with inventory + wms permissions ──────────
    `UPDATE roles SET permisos = jsonb_set(permisos, '{global,wms}', '"total"', true)
     WHERE nombre = 'Administrador' AND NOT (permisos -> 'global' ? 'wms')`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{global,wms}', '"lectura"', true)
     WHERE nombre = 'Jefe' AND NOT (permisos -> 'global' ? 'wms')`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{global,wms}', '"sin_acceso"', true)
     WHERE nombre NOT IN ('Administrador','Jefe') AND NOT (permisos -> 'global' ? 'wms')`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{inventory}',
       '{"escaneo":"total","historial":"total","reportes":"total"}'::jsonb, true)
     WHERE nombre = 'Administrador' AND NOT (permisos ? 'inventory')`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{inventory}',
       '{"escaneo":"gestion","historial":"gestion","reportes":"escritura"}'::jsonb, true)
     WHERE nombre = 'Jefe' AND NOT (permisos ? 'inventory')`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{inventory}',
       '{"escaneo":"escritura","historial":"lectura","reportes":"sin_acceso"}'::jsonb, true)
     WHERE nombre = 'Operador' AND NOT (permisos ? 'inventory')`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{inventory}',
       '{"escaneo":"sin_acceso","historial":"lectura","reportes":"lectura"}'::jsonb, true)
     WHERE nombre = 'Usuario' AND NOT (permisos ? 'inventory')`,

    // ── FEP — Folios de Entrega Paqueteria ────────────────────────────────
    `CREATE SEQUENCE IF NOT EXISTS fep_folio_seq START 1`,
    `CREATE TABLE IF NOT EXISTS folios_entrega (
       id SERIAL PRIMARY KEY,
       folio_numero VARCHAR(20) NOT NULL UNIQUE,
       empresa_id INTEGER NOT NULL REFERENCES configuraciones(id),
       canales INTEGER[],
       fecha_tarimas_desde DATE NOT NULL,
       fecha_tarimas_hasta DATE NOT NULL,
       estatus_tarima_filtro VARCHAR(20) DEFAULT 'FINALIZADA',
       estado VARCHAR(20) DEFAULT 'ACTIVO',
       motivo_cancelacion TEXT,
       hora_inicio TIMESTAMPTZ DEFAULT now(),
       hora_fin TIMESTAMPTZ,
       total_tarimas INTEGER DEFAULT 0,
       total_guias INTEGER DEFAULT 0,
       creado_por INTEGER REFERENCES usuarios(id),
       created_at TIMESTAMPTZ DEFAULT now(),
       updated_at TIMESTAMPTZ DEFAULT now()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_fep_estado ON folios_entrega(estado)`,
    `CREATE INDEX IF NOT EXISTS idx_fep_empresa ON folios_entrega(empresa_id)`,
    `CREATE INDEX IF NOT EXISTS idx_fep_created ON folios_entrega(created_at)`,
    `CREATE TABLE IF NOT EXISTS folios_entrega_tarimas (
       id SERIAL PRIMARY KEY,
       folio_id INTEGER REFERENCES folios_entrega(id) ON DELETE CASCADE,
       tarima_id INTEGER REFERENCES tarimas(id) ON DELETE RESTRICT,
       agregado_en TIMESTAMPTZ DEFAULT now(),
       agregado_por INTEGER REFERENCES usuarios(id),
       eliminado_en TIMESTAMPTZ,
       eliminado_por INTEGER REFERENCES usuarios(id),
       UNIQUE (folio_id, tarima_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_fet_folio ON folios_entrega_tarimas(folio_id)`,
    `CREATE INDEX IF NOT EXISTS idx_fet_tarima ON folios_entrega_tarimas(tarima_id)`,
    `CREATE TABLE IF NOT EXISTS folios_entrega_log (
       id SERIAL PRIMARY KEY,
       folio_id INTEGER REFERENCES folios_entrega(id) ON DELETE CASCADE,
       accion VARCHAR(30) NOT NULL,
       detalle JSONB,
       usuario_id INTEGER REFERENCES usuarios(id),
       timestamp TIMESTAMPTZ DEFAULT now()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_fel_folio ON folios_entrega_log(folio_id)`,
    // FEP permissions — always set (safe upsert by name+expected level)
    `UPDATE roles SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"total"}'::jsonb, true) WHERE nombre = 'Administrador'`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"gestion"}'::jsonb, true) WHERE nombre IN ('Jefe', 'Supervisor')`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"escritura"}'::jsonb, true) WHERE nombre = 'Operador'`,
    `UPDATE roles SET permisos = jsonb_set(permisos, '{fep}', '{"folios":"lectura"}'::jsonb, true) WHERE nombre = 'Usuario'`,
  ]
  for (const sql of steps) {
    try {
      await query(sql)
    } catch (err) {
      console.error('Migration step warning (non-fatal):', err.message.slice(0, 120))
    }
  }
}
runMigrations()

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`
  🏭 WMS Backend v1.0.0
  📡 Server running on http://localhost:${env.PORT}
  🔗 API: http://localhost:${env.PORT}/api
  🌍 Environment: ${env.NODE_ENV}
  `)
  })
}

export default app
