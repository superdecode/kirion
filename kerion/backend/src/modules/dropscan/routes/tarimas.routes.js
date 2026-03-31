import { Router } from 'express'
import { query } from '../../../config/database.js'
import { authenticateToken, loadFullUser } from '../../../shared/middleware/auth.js'
import { requirePermission } from '../../../shared/middleware/permissions.js'

const router = Router()

// GET /api/dropscan/tarimas
router.get('/',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.historial', 'ver'),
  async (req, res) => {
    try {
      const { fecha_inicio, fecha_fin, empresa_id, canal_id, estado, operador_id, page = 1, limit = 20 } = req.query
      const safePage = Math.max(1, parseInt(page) || 1)
      const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 20))
      const offset = (safePage - 1) * safeLimit

      let where = []
      let params = []
      let paramCount = 0

      if (fecha_inicio) {
        paramCount++
        where.push(`t.fecha_inicio >= $${paramCount}`)
        params.push(fecha_inicio)
      }
      if (fecha_fin) {
        paramCount++
        where.push(`t.fecha_inicio <= $${paramCount}::date + interval '1 day'`)
        params.push(fecha_fin)
      }
      if (empresa_id) {
        paramCount++
        where.push(`t.empresa_id = $${paramCount}`)
        params.push(empresa_id)
      }
      if (canal_id) {
        paramCount++
        where.push(`t.canal_id = $${paramCount}`)
        params.push(canal_id)
      }
      if (estado) {
        paramCount++
        where.push(`t.estado = $${paramCount}`)
        params.push(estado)
      }
      if (operador_id) {
        paramCount++
        where.push(`t.operador_id = $${paramCount}`)
        params.push(operador_id)
      }

      const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''

      // Count total
      const countRes = await query(
        `SELECT COUNT(*) FROM tarimas t ${whereClause}`,
        params
      )
      const total = parseInt(countRes.rows[0].count)

      // Get paginated results
      paramCount++
      params.push(safeLimit)
      paramCount++
      params.push(offset)

      const result = await query(
        `SELECT t.id, t.codigo, t.estado, t.cantidad_guias,
                t.fecha_inicio, t.fecha_cierre, t.tiempo_armado_segundos,
                e.nombre as empresa_nombre, e.codigo as empresa_codigo,
                c.nombre as canal_nombre, c.codigo as canal_codigo,
                COALESCE(s.usuario_operador, u.nombre_completo) as operador_nombre, u.codigo as operador_codigo
         FROM tarimas t
         JOIN configuraciones e ON t.empresa_id = e.id
         JOIN configuraciones c ON t.canal_id = c.id
         JOIN usuarios u ON t.operador_id = u.id
         LEFT JOIN sesiones_escaneo s ON s.tarima_actual_id = t.id OR (s.operador_id = t.operador_id AND s.empresa_id = t.empresa_id AND s.canal_id = t.canal_id AND DATE(s.fecha_inicio) = DATE(t.fecha_inicio))
         ${whereClause}
         ORDER BY t.fecha_inicio DESC
         LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
        params
      )

      res.json({
        tarimas: result.rows,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          pages: Math.ceil(total / safeLimit)
        }
      })
    } catch (error) {
      console.error('Get tarimas error:', error)
      res.status(500).json({ error: 'Error obteniendo tarimas' })
    }
  }
)

// GET /api/dropscan/tarimas/:id
router.get('/:id',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.historial', 'ver'),
  async (req, res) => {
    try {
      const { id } = req.params

      const tarimaRes = await query(
        `SELECT t.*, e.nombre as empresa_nombre, e.codigo as empresa_codigo,
                c.nombre as canal_nombre, c.codigo as canal_codigo,
                COALESCE(s.usuario_operador, u.nombre_completo) as operador_nombre, u.codigo as operador_codigo
         FROM tarimas t
         JOIN configuraciones e ON t.empresa_id = e.id
         JOIN configuraciones c ON t.canal_id = c.id
         JOIN usuarios u ON t.operador_id = u.id
         LEFT JOIN sesiones_escaneo s ON s.tarima_actual_id = t.id OR (s.operador_id = t.operador_id AND s.empresa_id = t.empresa_id AND s.canal_id = t.canal_id AND DATE(s.fecha_inicio) = DATE(t.fecha_inicio))
         WHERE t.id = $1`,
        [id]
      )

      if (tarimaRes.rows.length === 0) {
        return res.status(404).json({ error: 'Tarima no encontrada' })
      }

      const guiasRes = await query(
        `SELECT g.id, g.codigo_guia, g.posicion, g.timestamp_escaneo,
                COALESCE(g.usuario_operador, u.nombre_completo) as operador_nombre
         FROM guias g
         JOIN usuarios u ON g.operador_id = u.id
         WHERE g.tarima_id = $1
         ORDER BY g.posicion ASC`,
        [id]
      )

      const duplicadosRes = await query(
        `SELECT COUNT(*) FROM alertas_duplicados WHERE tarima_id = $1`,
        [id]
      )

      res.json({
        tarima: tarimaRes.rows[0],
        guias: guiasRes.rows,
        duplicados_count: parseInt(duplicadosRes.rows[0].count) || 0
      })
    } catch (error) {
      console.error('Get tarima detail error:', error)
      res.status(500).json({ error: 'Error obteniendo tarima' })
    }
  }
)

// POST /api/dropscan/tarimas/:id/finalize
router.post('/:id/finalize',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.escaneo', 'editar'),
  async (req, res) => {
    try {
      const { id } = req.params
      const result = await query(
        `UPDATE tarimas SET estado = 'FINALIZADA', fecha_cierre = CURRENT_TIMESTAMP WHERE id = $1 AND estado = 'EN_PROCESO' RETURNING *`,
        [id]
      )
      if (result.rows.length === 0) return res.status(404).json({ error: 'Tarima no encontrada o no está en proceso' })
      res.json({ success: true, tarima: result.rows[0] })
    } catch (error) {
      console.error('Finalize tarima error:', error)
      res.status(500).json({ error: 'Error finalizando tarima' })
    }
  }
)

// POST /api/dropscan/tarimas/:id/cancel
router.post('/:id/cancel',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.escaneo', 'editar'),
  async (req, res) => {
    try {
      const { id } = req.params
      const { razon } = req.body
      if (!razon || !razon.trim()) return res.status(400).json({ error: 'La razón de cancelación es requerida' })
      const result = await query(
        `UPDATE tarimas SET estado = 'CANCELADA', fecha_cierre = CURRENT_TIMESTAMP, cancelada_razon = $1 WHERE id = $2 AND estado = 'EN_PROCESO' RETURNING *`,
        [razon.trim(), id]
      )
      if (result.rows.length === 0) return res.status(404).json({ error: 'Tarima no encontrada o no está en proceso' })
      res.json({ success: true, tarima: result.rows[0] })
    } catch (error) {
      console.error('Cancel tarima error:', error)
      res.status(500).json({ error: 'Error cancelando tarima' })
    }
  }
)

// POST /api/dropscan/tarimas/:id/reopen
router.post('/:id/reopen',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.historial', 'desbloquear'),
  async (req, res) => {
    try {
      const { id } = req.params
      const result = await query(
        `UPDATE tarimas SET estado = 'EN_PROCESO', fecha_cierre = NULL WHERE id = $1 AND estado = 'FINALIZADA' RETURNING *`,
        [id]
      )
      if (result.rows.length === 0) return res.status(404).json({ error: 'Tarima no encontrada o no está finalizada' })
      res.json({ success: true, tarima: result.rows[0] })
    } catch (error) {
      console.error('Reopen tarima error:', error)
      res.status(500).json({ error: 'Error reabriendo tarima' })
    }
  }
)

// GET /api/dropscan/tarimas/:id/duplicados
router.get('/:id/duplicados',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.historial', 'ver'),
  async (req, res) => {
    try {
      const { id } = req.params
      const result = await query(
        `SELECT ad.id, ad.codigo_guia, ad.timestamp_alerta,
                g.codigo_guia as guia_original_codigo, g.posicion as guia_original_posicion,
                COALESCE(g.usuario_operador, u.nombre_completo) as operador_nombre
         FROM alertas_duplicados ad
         LEFT JOIN guias g ON ad.guia_original_id = g.id
         JOIN usuarios u ON ad.operador_id = u.id
         WHERE ad.tarima_id = $1
         ORDER BY ad.timestamp_alerta DESC`,
        [id]
      )
      res.json({ duplicados: result.rows })
    } catch (error) {
      console.error('Get duplicados error:', error)
      res.status(500).json({ error: 'Error obteniendo duplicados' })
    }
  }
)

// DELETE /api/dropscan/tarimas/:id
router.delete('/:id',
  authenticateToken, loadFullUser,
  requirePermission('dropscan.historial', 'eliminar'),
  async (req, res) => {
    try {
      const { id } = req.params

      const tarimaRes = await query('SELECT * FROM tarimas WHERE id = $1', [id])
      if (tarimaRes.rows.length === 0) {
        return res.status(404).json({ error: 'Tarima no encontrada' })
      }

      // Cascade deletes guias and alertas
      await query('DELETE FROM tarimas WHERE id = $1', [id])
      res.json({ success: true, message: 'Tarima eliminada' })
    } catch (error) {
      console.error('Delete tarima error:', error)
      res.status(500).json({ error: 'Error eliminando tarima' })
    }
  }
)

export default router
