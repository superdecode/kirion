import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import env from '../../config/env.js'
import { query } from '../../config/database.js'
import { provisionTenant } from '../../services/provisioningService.js'

const router = Router()

// ── Super Admin Auth ───────────────────────────────────────────────────────────

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Token requerido' })

  try {
    const decoded = jwt.verify(token, env.JWT_ADMIN_SECRET)
    req.admin = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalido' })
  }
}

async function adminAudit(adminId, action, entityType, entityId, details) {
  try {
    await query(
      `INSERT INTO system_audit_log (actor_type, actor_id, action, entity_type, entity_id, details)
       VALUES ('super_admin',$1,$2,$3,$4,$5)`,
      [adminId, action, entityType, entityId ? String(entityId) : null, details ? JSON.stringify(details) : null]
    )
  } catch (_) { /* non-blocking */ }
}

// POST /api/admin/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

    const result = await query(
      'SELECT * FROM super_admins WHERE email = $1 AND is_active = true LIMIT 1',
      [email.toLowerCase().trim()]
    )
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales invalidas' })

    const admin = result.rows[0]
    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) return res.status(401).json({ error: 'Credenciales invalidas' })

    await query('UPDATE super_admins SET last_login_at = now() WHERE id = $1', [admin.id])

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name, role: 'super_admin' },
      env.JWT_ADMIN_SECRET,
      { expiresIn: '12h' }
    )

    res.json({ success: true, token, admin: { id: admin.id, email: admin.email, name: admin.name } })
  } catch (err) {
    console.error('[admin/auth/login]', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/admin/seed — DEV ONLY: create first super_admin if none exists
router.post('/seed', async (req, res) => {
  if (env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' })
  }
  try {
    const { email, password, name } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' })

    const existing = await query('SELECT id FROM super_admins WHERE email = $1', [email.toLowerCase().trim()])
    if (existing.rows.length > 0) {
      return res.json({ success: true, message: 'super_admin ya existe', id: existing.rows[0].id })
    }

    const hash = await bcrypt.hash(password, 12)
    const result = await query(
      `INSERT INTO super_admins (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name`,
      [email.toLowerCase().trim(), hash, name || 'Super Admin']
    )
    res.json({ success: true, admin: result.rows[0] })
  } catch (err) {
    console.error('[admin/seed]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Signup Requests ────────────────────────────────────────────────────────────

// GET /api/admin/signup-requests?status=pending
router.get('/signup-requests', authenticateAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending'
    const result = await query(
      `SELECT * FROM tenant_signup_requests WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) {
    console.error('[admin/signup-requests]', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/admin/signup-requests/:id/approve
router.post('/signup-requests/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const result = await provisionTenant(id, req.admin.id)
    adminAudit(req.admin.id, 'APPROVE_SIGNUP', 'tenant_signup_request', id, { tenant_id: result.tenantId })
    res.json({ success: true, tenant_id: result.tenantId, admin_email: result.adminEmail })
  } catch (err) {
    console.error('[admin/approve]', err)
    res.status(500).json({ error: err.message || 'Error en provisioning' })
  }
})

// POST /api/admin/signup-requests/:id/reject
router.post('/signup-requests/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    if (!reason) return res.status(400).json({ error: 'Motivo de rechazo requerido' })

    const reqRes = await query('SELECT * FROM tenant_signup_requests WHERE id = $1 LIMIT 1', [id])
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada' })
    const request = reqRes.rows[0]
    if (request.status !== 'pending') return res.status(409).json({ error: 'Solicitud ya procesada' })

    await query(
      `UPDATE tenant_signup_requests SET status='rejected', reviewed_by=$1, reviewed_at=now(), rejected_reason=$2
       WHERE id = $3`,
      [req.admin.id, reason, id]
    )

    await query(
      `INSERT INTO notifications_outbox (recipient_email, template_code, payload)
       VALUES ($1,'request_rejected',$2)`,
      [request.contact_email, JSON.stringify({
        contact_name: request.contact_name,
        organization_name: request.organization_name,
        reason,
      })]
    )

    adminAudit(req.admin.id, 'REJECT_SIGNUP', 'tenant_signup_request', id, { reason })
    res.json({ success: true })
  } catch (err) {
    console.error('[admin/reject]', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ── Tenants ────────────────────────────────────────────────────────────────────

// GET /api/admin/tenants?status=trial
router.get('/tenants', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.query
    const base = `
      SELECT t.*, p.name as plan_name,
             (SELECT COUNT(*) FROM usuarios u WHERE u.tenant_id = t.id) as user_count,
             (SELECT MAX(u.ultimo_acceso) FROM usuarios u WHERE u.tenant_id = t.id) as last_access
      FROM tenants t
      LEFT JOIN plans p ON t.current_plan_id = p.id
    `
    const result = status
      ? await query(`${base} WHERE t.status = $1 ORDER BY t.created_at DESC`, [status])
      : await query(`${base} ORDER BY t.created_at DESC`)

    res.json({ success: true, data: result.rows })
  } catch (err) {
    console.error('[admin/tenants]', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// GET /api/admin/tenants/:id
router.get('/tenants/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const [tenantRes, logRes, subRes] = await Promise.all([
      query('SELECT t.*, p.name as plan_name FROM tenants t LEFT JOIN plans p ON t.current_plan_id = p.id WHERE t.id = $1', [id]),
      query('SELECT * FROM provisioning_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50', [id]),
      query('SELECT s.*, p.name as plan_name FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.tenant_id = $1 ORDER BY s.started_at DESC', [id]),
    ])
    if (tenantRes.rows.length === 0) return res.status(404).json({ error: 'Tenant no encontrado' })

    res.json({
      success: true,
      tenant: tenantRes.rows[0],
      provisioning_log: logRes.rows,
      subscriptions: subRes.rows,
    })
  } catch (err) {
    console.error('[admin/tenants/:id]', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/admin/tenants/:id/suspend
router.post('/tenants/:id/suspend', authenticateAdmin, async (req, res) => {
  try {
    await query(`UPDATE tenants SET status = 'suspended', updated_at = now() WHERE id = $1`, [req.params.id])
    adminAudit(req.admin.id, 'SUSPEND_TENANT', 'tenant', req.params.id, null)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/admin/tenants/:id/reactivate
router.post('/tenants/:id/reactivate', authenticateAdmin, async (req, res) => {
  try {
    await query(`UPDATE tenants SET status = 'active', updated_at = now() WHERE id = $1`, [req.params.id])
    adminAudit(req.admin.id, 'REACTIVATE_TENANT', 'tenant', req.params.id, null)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Error interno' })
  }
})

// ── Subscriptions ──────────────────────────────────────────────────────────────

// GET /api/admin/plans
router.get('/plans', authenticateAdmin, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM plans WHERE is_active = true ORDER BY price_amount ASC')
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/admin/tenants/:id/subscriptions
router.post('/tenants/:id/subscriptions', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { plan_id, started_at, expires_at, payment_reference, notes } = req.body

    if (!plan_id || !expires_at) {
      return res.status(400).json({ error: 'plan_id y expires_at son requeridos' })
    }

    // Expire any current active subscriptions for this tenant
    await query(
      `UPDATE subscriptions SET status = 'expired' WHERE tenant_id = $1 AND status = 'active'`,
      [id]
    )

    const subRes = await query(
      `INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, expires_at, payment_reference, notes, recorded_by)
       VALUES ($1,$2,'active',$3,$4,$5,$6,$7) RETURNING id`,
      [id, plan_id, started_at || new Date(), expires_at, payment_reference, notes, req.admin.id]
    )

    await query(
      `UPDATE tenants SET status = 'active', subscription_expires_at = $1, current_plan_id = $2, updated_at = now()
       WHERE id = $3`,
      [expires_at, plan_id, id]
    )

    // Notify tenant
    const tenantRes = await query('SELECT contact_name, contact_email FROM tenants WHERE id = $1', [id])
    if (tenantRes.rows.length > 0) {
      const t = tenantRes.rows[0]
      await query(
        `INSERT INTO notifications_outbox (tenant_id, recipient_email, template_code, payload)
         VALUES ($1,$2,'subscription_activated',$3)`,
        [id, t.contact_email, JSON.stringify({
          contact_name: t.contact_name,
          expires_at: new Date(expires_at).toLocaleDateString('es-MX'),
        })]
      )
    }

    adminAudit(req.admin.id, 'ADD_SUBSCRIPTION', 'tenant', id, { plan_id, expires_at, payment_reference })
    res.json({ success: true, subscription_id: subRes.rows[0].id })
  } catch (err) {
    console.error('[admin/subscriptions]', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// ── Dashboard ──────────────────────────────────────────────────────────────────

// GET /api/admin/dashboard
router.get('/dashboard', authenticateAdmin, async (_req, res) => {
  try {
    const [counts, recent, conversions] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'trial')          as trial,
          COUNT(*) FILTER (WHERE status = 'active')         as active,
          COUNT(*) FILTER (WHERE status = 'trial_expired')  as trial_expired,
          COUNT(*) FILTER (WHERE status = 'expired')        as expired,
          COUNT(*) FILTER (WHERE status = 'suspended')      as suspended,
          COUNT(*)                                           as total
        FROM tenants
      `),
      query(`SELECT * FROM tenant_signup_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10`),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')  as converted,
          COUNT(*) FILTER (WHERE status IN ('trial_expired','expired')) as not_converted
        FROM tenants
        WHERE created_at >= now() - INTERVAL '30 days'
      `),
    ])

    res.json({
      success: true,
      stats: counts.rows[0],
      pending_requests: recent.rows,
      last_30d_conversion: conversions.rows[0],
    })
  } catch (err) {
    console.error('[admin/dashboard]', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

// GET /api/admin/notifications?status=failed
router.get('/notifications', authenticateAdmin, async (req, res) => {
  try {
    const status = req.query.status
    const base = 'SELECT * FROM notifications_outbox'
    const result = status
      ? await query(`${base} WHERE status = $1 ORDER BY created_at DESC LIMIT 100`, [status])
      : await query(`${base} ORDER BY created_at DESC LIMIT 100`)
    res.json({ success: true, data: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/admin/notifications/:id/retry
router.post('/notifications/:id/retry', authenticateAdmin, async (req, res) => {
  try {
    await query(
      `UPDATE notifications_outbox SET status = 'pending', attempts = 0, last_error = null WHERE id = $1`,
      [req.params.id]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Error interno' })
  }
})

export default router
