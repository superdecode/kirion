import { Router } from 'express'
import { query, getClient } from '../../../config/database.js'
import { authenticateToken, loadFullUser } from '../../../shared/middleware/auth.js'
import { requirePermission } from '../../../shared/middleware/permissions.js'

const router = Router()

// ==================== CANALES DE ESCANEO ====================

// GET /api/dropscan/config/canales - List all channels
router.get('/canales',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'leer'),
  async (req, res) => {
    try {
      const { activo } = req.query
      let sql = `
        SELECT c.*, 
               u1.nombre as created_by_name,
               u2.nombre as updated_by_name
        FROM canales_escaneo c
        LEFT JOIN usuarios u1 ON c.created_by = u1.id
        LEFT JOIN usuarios u2 ON c.updated_by = u2.id
      `
      const params = []
      
      if (activo !== undefined) {
        sql += ' WHERE c.activo = $1'
        params.push(activo === 'true')
      }
      
      sql += ' ORDER BY c.es_default DESC, c.nombre ASC'
      
      const result = await query(sql, params)
      res.json(result.rows)
    } catch (error) {
      console.error('Get canales error:', error)
      res.status(500).json({ error: 'Error obteniendo canales' })
    }
  }
)

// GET /api/dropscan/config/canales/:id - Get single channel
router.get('/canales/:id',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'leer'),
  async (req, res) => {
    try {
      const result = await query(
        `SELECT c.*, 
                u1.nombre as created_by_name,
                u2.nombre as updated_by_name
         FROM canales_escaneo c
         LEFT JOIN usuarios u1 ON c.created_by = u1.id
         LEFT JOIN usuarios u2 ON c.updated_by = u2.id
         WHERE c.id = $1`,
        [req.params.id]
      )
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Canal no encontrado' })
      }
      
      res.json(result.rows[0])
    } catch (error) {
      console.error('Get canal error:', error)
      res.status(500).json({ error: 'Error obteniendo canal' })
    }
  }
)

// POST /api/dropscan/config/canales - Create new channel
router.post('/canales',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'crear'),
  async (req, res) => {
    const client = await getClient()
    try {
      await client.query('BEGIN')
      
      const { nombre, descripcion, activo, es_default } = req.body
      const userId = req.user.id
      
      if (!nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' })
      }
      
      // If setting as default, unset other defaults
      if (es_default) {
        await client.query(
          'UPDATE canales_escaneo SET es_default = false WHERE es_default = true'
        )
      }
      
      const result = await client.query(
        `INSERT INTO canales_escaneo (nombre, descripcion, activo, es_default, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING *`,
        [nombre.trim(), descripcion || null, activo !== false, es_default || false, userId]
      )
      
      await client.query('COMMIT')
      res.status(201).json(result.rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Create canal error:', error)
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'Ya existe un canal con ese nombre' })
      }
      
      res.status(500).json({ error: 'Error creando canal' })
    } finally {
      client.release()
    }
  }
)

// PUT /api/dropscan/config/canales/:id - Update channel
router.put('/canales/:id',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'editar'),
  async (req, res) => {
    const client = await getClient()
    try {
      await client.query('BEGIN')
      
      const { id } = req.params
      const { nombre, descripcion, activo, es_default } = req.body
      const userId = req.user.id
      
      if (!nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' })
      }
      
      // Check if channel exists
      const existing = await client.query('SELECT id FROM canales_escaneo WHERE id = $1', [id])
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Canal no encontrado' })
      }
      
      // If setting as default, unset other defaults
      if (es_default) {
        await client.query(
          'UPDATE canales_escaneo SET es_default = false WHERE es_default = true AND id != $1',
          [id]
        )
      }
      
      const result = await client.query(
        `UPDATE canales_escaneo 
         SET nombre = $1, descripcion = $2, activo = $3, es_default = $4, updated_by = $5
         WHERE id = $6
         RETURNING *`,
        [nombre.trim(), descripcion || null, activo !== false, es_default || false, userId, id]
      )
      
      await client.query('COMMIT')
      res.json(result.rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Update canal error:', error)
      
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un canal con ese nombre' })
      }
      
      res.status(500).json({ error: 'Error actualizando canal' })
    } finally {
      client.release()
    }
  }
)

// DELETE /api/dropscan/config/canales/:id - Delete channel
router.delete('/canales/:id',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'eliminar'),
  async (req, res) => {
    const client = await getClient()
    try {
      await client.query('BEGIN')
      
      const { id } = req.params
      
      // Check if channel is in use
      const inUse = await client.query(
        'SELECT COUNT(*) FROM tarimas WHERE canal_id = $1',
        [id]
      )
      
      if (parseInt(inUse.rows[0].count) > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({ 
          error: 'No se puede eliminar el canal porque está siendo utilizado en tarimas existentes' 
        })
      }
      
      // Check if it's the default channel
      const isDefault = await client.query(
        'SELECT es_default FROM canales_escaneo WHERE id = $1',
        [id]
      )
      
      if (isDefault.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Canal no encontrado' })
      }
      
      if (isDefault.rows[0].es_default) {
        await client.query('ROLLBACK')
        return res.status(409).json({ 
          error: 'No se puede eliminar el canal por defecto. Primero asigna otro canal como predeterminado.' 
        })
      }
      
      await client.query('DELETE FROM canales_escaneo WHERE id = $1', [id])
      
      await client.query('COMMIT')
      res.json({ success: true, message: 'Canal eliminado correctamente' })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Delete canal error:', error)
      res.status(500).json({ error: 'Error eliminando canal' })
    } finally {
      client.release()
    }
  }
)

// ==================== EMPRESAS DE PAQUETERÍA ====================

// GET /api/dropscan/config/empresas - List all carriers
router.get('/empresas',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'leer'),
  async (req, res) => {
    try {
      const { activo } = req.query
      let sql = `
        SELECT e.*, 
               u1.nombre as created_by_name,
               u2.nombre as updated_by_name
        FROM empresas_paqueteria e
        LEFT JOIN usuarios u1 ON e.created_by = u1.id
        LEFT JOIN usuarios u2 ON e.updated_by = u2.id
      `
      const params = []
      
      if (activo !== undefined) {
        sql += ' WHERE e.activo = $1'
        params.push(activo === 'true')
      }
      
      sql += ' ORDER BY e.nombre ASC'
      
      const result = await query(sql, params)
      res.json(result.rows)
    } catch (error) {
      console.error('Get empresas error:', error)
      res.status(500).json({ error: 'Error obteniendo empresas' })
    }
  }
)

// GET /api/dropscan/config/empresas/:id - Get single carrier
router.get('/empresas/:id',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'leer'),
  async (req, res) => {
    try {
      const result = await query(
        `SELECT e.*, 
                u1.nombre as created_by_name,
                u2.nombre as updated_by_name
         FROM empresas_paqueteria e
         LEFT JOIN usuarios u1 ON e.created_by = u1.id
         LEFT JOIN usuarios u2 ON e.updated_by = u2.id
         WHERE e.id = $1`,
        [req.params.id]
      )
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Empresa no encontrada' })
      }
      
      res.json(result.rows[0])
    } catch (error) {
      console.error('Get empresa error:', error)
      res.status(500).json({ error: 'Error obteniendo empresa' })
    }
  }
)

// POST /api/dropscan/config/empresas - Create new carrier
router.post('/empresas',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'crear'),
  async (req, res) => {
    try {
      const { nombre, codigo, color, activo } = req.body
      const userId = req.user.id
      
      if (!nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' })
      }
      
      if (!codigo || !codigo.trim()) {
        return res.status(400).json({ error: 'El código es requerido' })
      }
      
      // Validate color format (hex)
      const colorValue = color || '#6366f1'
      if (!/^#[0-9A-F]{6}$/i.test(colorValue)) {
        return res.status(400).json({ error: 'El color debe ser un código hexadecimal válido (ej: #FF0000)' })
      }
      
      const result = await query(
        `INSERT INTO empresas_paqueteria (nombre, codigo, color, activo, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING *`,
        [nombre.trim(), codigo.trim().toUpperCase(), colorValue, activo !== false, userId]
      )
      
      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error('Create empresa error:', error)
      
      if (error.code === '23505') {
        if (error.constraint.includes('nombre')) {
          return res.status(409).json({ error: 'Ya existe una empresa con ese nombre' })
        }
        if (error.constraint.includes('codigo')) {
          return res.status(409).json({ error: 'Ya existe una empresa con ese código' })
        }
      }
      
      res.status(500).json({ error: 'Error creando empresa' })
    }
  }
)

// PUT /api/dropscan/config/empresas/:id - Update carrier
router.put('/empresas/:id',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'editar'),
  async (req, res) => {
    try {
      const { id } = req.params
      const { nombre, codigo, color, activo } = req.body
      const userId = req.user.id
      
      if (!nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' })
      }
      
      if (!codigo || !codigo.trim()) {
        return res.status(400).json({ error: 'El código es requerido' })
      }
      
      // Validate color format
      const colorValue = color || '#6366f1'
      if (!/^#[0-9A-F]{6}$/i.test(colorValue)) {
        return res.status(400).json({ error: 'El color debe ser un código hexadecimal válido (ej: #FF0000)' })
      }
      
      const result = await query(
        `UPDATE empresas_paqueteria 
         SET nombre = $1, codigo = $2, color = $3, activo = $4, updated_by = $5
         WHERE id = $6
         RETURNING *`,
        [nombre.trim(), codigo.trim().toUpperCase(), colorValue, activo !== false, userId, id]
      )
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Empresa no encontrada' })
      }
      
      res.json(result.rows[0])
    } catch (error) {
      console.error('Update empresa error:', error)
      
      if (error.code === '23505') {
        if (error.constraint.includes('nombre')) {
          return res.status(409).json({ error: 'Ya existe una empresa con ese nombre' })
        }
        if (error.constraint.includes('codigo')) {
          return res.status(409).json({ error: 'Ya existe una empresa con ese código' })
        }
      }
      
      res.status(500).json({ error: 'Error actualizando empresa' })
    }
  }
)

// DELETE /api/dropscan/config/empresas/:id - Delete carrier
router.delete('/empresas/:id',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.configuracion', 'eliminar'),
  async (req, res) => {
    const client = await getClient()
    try {
      await client.query('BEGIN')
      
      const { id } = req.params
      
      // Check if carrier is in use
      const inUse = await client.query(
        'SELECT COUNT(*) FROM tarimas WHERE empresa_id = $1',
        [id]
      )
      
      if (parseInt(inUse.rows[0].count) > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({ 
          error: 'No se puede eliminar la empresa porque está siendo utilizada en tarimas existentes' 
        })
      }
      
      const result = await client.query(
        'DELETE FROM empresas_paqueteria WHERE id = $1 RETURNING id',
        [id]
      )
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Empresa no encontrada' })
      }
      
      await client.query('COMMIT')
      res.json({ success: true, message: 'Empresa eliminada correctamente' })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Delete empresa error:', error)
      res.status(500).json({ error: 'Error eliminando empresa' })
    } finally {
      client.release()
    }
  }
)

export default router
