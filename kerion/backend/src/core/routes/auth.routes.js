import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import env from '../../config/env.js'
import { query } from '../../config/database.js'
import { authenticateToken, auditLog } from '../../shared/middleware/auth.js'

const router = Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' })
    }

    const result = await query(
      `SELECT u.*, r.nombre as rol_nombre, r.permisos as rol_permisos
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const user = result.rows[0]

    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({ error: 'Usuario inactivo o suspendido' })
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    // Update last access
    await query('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1', [user.id])

    // Build permissions from role or override
    const permisos = user.permisos_override || user.rol_permisos || {}

    const jti = crypto.randomBytes(16).toString('hex')
    const payload = {
      id: user.id,
      codigo: user.codigo,
      email: user.email,
      rol_id: user.rol_id,
      rol_nombre: user.rol_nombre,
      jti,
    }

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })

    // Audit: login
    auditLog(req, 'LOGIN', 'usuario', user.id, { email: user.email, rol: user.rol_nombre })

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        codigo: user.codigo,
        nombre_completo: user.nombre_completo,
        email: user.email,
        rol_id: user.rol_id,
        rol_nombre: user.rol_nombre,
        permisos,
        avatar_url: user.avatar_url,
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.codigo, u.nombre_completo, u.email, u.rol_id, u.estado,
              u.avatar_url, u.permisos_override, u.ultimo_acceso,
              r.nombre as rol_nombre, r.permisos as rol_permisos
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const user = result.rows[0]
    const permisos = user.permisos_override || user.rol_permisos || {}

    res.json({
      id: user.id,
      codigo: user.codigo,
      nombre_completo: user.nombre_completo,
      email: user.email,
      rol_id: user.rol_id,
      rol_nombre: user.rol_nombre,
      permisos,
      avatar_url: user.avatar_url,
      estado: user.estado,
      ultimo_acceso: user.ultimo_acceso,
    })
  } catch (error) {
    console.error('Auth/me error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Blacklist the token if it has a JTI
    if (req.user.jti) {
      const expiresAt = new Date(req.user.exp * 1000)
      await query(
        'INSERT INTO token_blacklist (token_jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token_jti) DO NOTHING',
        [req.user.jti, req.user.id, expiresAt]
      )
    }
    // Cleanup expired tokens opportunistically (1 in 10 chance)
    if (Math.random() < 0.1) {
      query('DELETE FROM token_blacklist WHERE expires_at < CURRENT_TIMESTAMP').catch(() => {})
    }
    auditLog(req, 'LOGOUT', 'usuario', req.user.id, null)
    res.json({ success: true, message: 'Sesión cerrada' })
  } catch (error) {
    console.error('Logout error:', error)
    res.json({ success: true, message: 'Sesión cerrada' })
  }
})

export default router
