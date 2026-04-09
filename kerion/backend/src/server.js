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

// Module routes
import scanRoutes from './modules/dropscan/routes/scan.routes.js'
import tarimasRoutes from './modules/dropscan/routes/tarimas.routes.js'
import dashboardRoutes from './modules/dropscan/routes/dashboard.routes.js'
import dropscanConfigRoutes from './modules/dropscan/routes/config.routes.js'
import operadoresRoutes from './modules/dropscan/routes/operadores.routes.js'

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

// DropScan module routes
app.use('/api/dropscan', scanRoutes)
app.use('/api/dropscan/tarimas', tarimasRoutes)
app.use('/api/dropscan/dashboard', dashboardRoutes)
app.use('/api/dropscan/config', dropscanConfigRoutes)
app.use('/api/dropscan/operadores', operadoresRoutes)

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
