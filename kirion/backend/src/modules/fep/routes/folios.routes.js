import { Router } from 'express'
import PDFDocument from 'pdfkit'
import { query, getClient } from '../../../config/database.js'
import { authenticateToken, loadFullUser } from '../../../shared/middleware/auth.js'
import { requirePermission } from '../../../shared/middleware/permissions.js'

const router = Router()
const TZ = 'America/Mexico_City'

// ─── helpers ────────────────────────────────────────────────────────────────

function isSameDay(tsUTC) {
  const now = new Date()
  const nowMx = new Date(now.toLocaleString('en-US', { timeZone: TZ }))
  const tsMx = new Date(new Date(tsUTC).toLocaleString('en-US', { timeZone: TZ }))
  return nowMx.toDateString() === tsMx.toDateString()
}

async function recalcTotals(client, folioId) {
  await client.query(
    `UPDATE folios_entrega fe SET
       total_tarimas = (SELECT COUNT(*) FROM folios_entrega_tarimas WHERE folio_id = $1 AND eliminado_en IS NULL),
       total_guias   = (SELECT COALESCE(SUM(t.cantidad_guias),0) FROM folios_entrega_tarimas fet
                        JOIN tarimas t ON t.id = fet.tarima_id
                        WHERE fet.folio_id = $1 AND fet.eliminado_en IS NULL),
       updated_at = now()
     WHERE fe.id = $1`,
    [folioId]
  )
}

async function logAction(client, folioId, accion, detalle, usuarioId) {
  await client.query(
    `INSERT INTO folios_entrega_log (folio_id, accion, detalle, usuario_id) VALUES ($1,$2,$3,$4)`,
    [folioId, accion, JSON.stringify(detalle), usuarioId]
  )
}

// ─── GET /api/fep/folios/stats/hoy ──────────────────────────────────────────
router.get('/stats/hoy',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'ver'),
  async (req, res) => {
    try {
      const result = await query(
        `SELECT
           COUNT(*) FILTER (WHERE estado = 'ACTIVO')     AS activos,
           COUNT(*) FILTER (WHERE estado = 'CANCELADO')  AS cancelados,
           COUNT(*) FILTER (WHERE estado = 'COMPLETADO') AS completados,
           COALESCE(SUM(total_tarimas),0) AS total_tarimas,
           COALESCE(SUM(total_guias),0)   AS total_guias
         FROM folios_entrega
         WHERE (created_at AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date`
      )
      res.json({ stats: result.rows[0] })
    } catch (err) {
      console.error('FEP stats error:', err)
      res.status(500).json({ error: 'Error obteniendo estadísticas' })
    }
  }
)

// ─── GET /api/fep/folios/preview-tarimas ────────────────────────────────────
router.get('/preview-tarimas',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'ver'),
  async (req, res) => {
    try {
      const { empresa_id, canales, fecha_desde, fecha_hasta, estatus_tarima = 'FINALIZADA', page = 1, limit = 50 } = req.query
      if (!empresa_id) return res.status(400).json({ error: 'empresa_id requerido' })

      const safePage = Math.max(1, parseInt(page) || 1)
      const safeLimit = Math.min(200, Math.max(1, parseInt(limit) || 50))
      const offset = (safePage - 1) * safeLimit

      const params = [Number(empresa_id)]
      let where = ['t.empresa_id = $1']
      let pc = 1

      if (canales && canales !== 'all') {
        const ids = String(canales).split(',').map(Number).filter(Boolean)
        if (ids.length) { pc++; where.push(`t.canal_id = ANY($${pc})`); params.push(ids) }
      }

      const tzExpr = `(t.fecha_inicio AT TIME ZONE '${TZ}')::date`
      if (fecha_desde) { pc++; where.push(`${tzExpr} >= $${pc}::date`); params.push(fecha_desde) }
      if (fecha_hasta) { pc++; where.push(`${tzExpr} <= $${pc}::date`); params.push(fecha_hasta) }

      if (estatus_tarima === 'FINALIZADA') {
        where.push(`t.estado = 'FINALIZADA'`)
      } else if (estatus_tarima === 'EN_PROCESO') {
        where.push(`t.estado = 'EN_PROCESO'`)
      }

      const whereClause = 'WHERE ' + where.join(' AND ')

      // Tarimas already in an active folio (blocked)
      const blockedQuery = `
        EXISTS (
          SELECT 1 FROM folios_entrega_tarimas fet
          JOIN folios_entrega fe ON fe.id = fet.folio_id
          WHERE fet.tarima_id = t.id AND fet.eliminado_en IS NULL AND fe.estado = 'ACTIVO'
        )`

      const countRes = await query(`SELECT COUNT(*) FROM tarimas t ${whereClause}`, params)
      const total = parseInt(countRes.rows[0].count)

      pc++; params.push(safeLimit)
      pc++; params.push(offset)

      const result = await query(
        `SELECT t.id, t.codigo, t.estado, t.cantidad_guias,
                t.fecha_inicio, t.fecha_cierre,
                e.nombre AS empresa_nombre, e.codigo AS empresa_codigo,
                c.nombre AS canal_nombre, c.id AS canal_id,
                ${blockedQuery} AS bloqueada,
                (SELECT fe2.folio_numero FROM folios_entrega_tarimas fet2
                 JOIN folios_entrega fe2 ON fe2.id = fet2.folio_id
                 WHERE fet2.tarima_id = t.id AND fet2.eliminado_en IS NULL AND fe2.estado = 'ACTIVO'
                 LIMIT 1) AS folio_asignado
         FROM tarimas t
         JOIN configuraciones e ON t.empresa_id = e.id
         JOIN configuraciones c ON t.canal_id = c.id
         ${whereClause}
         ORDER BY t.fecha_inicio DESC
         LIMIT $${pc-1} OFFSET $${pc}`,
        params
      )

      res.json({
        tarimas: result.rows,
        pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) }
      })
    } catch (err) {
      console.error('FEP preview tarimas error:', err)
      res.status(500).json({ error: 'Error obteniendo tarimas disponibles' })
    }
  }
)

// ─── GET /api/fep/folios ─────────────────────────────────────────────────────
router.get('/',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'ver'),
  async (req, res) => {
    try {
      const { empresa_id, estado, canal_id, fecha_desde, fecha_hasta, folio, codigo_guia, page = 1, limit = 20 } = req.query
      const safePage = Math.max(1, parseInt(page) || 1)
      const safeLimit = Math.min(500, Math.max(1, parseInt(limit) || 20))
      const offset = (safePage - 1) * safeLimit

      const params = []
      const where = []
      let pc = 0

      if (empresa_id) { pc++; where.push(`fe.empresa_id = $${pc}`); params.push(Number(empresa_id)) }
      if (estado) { pc++; where.push(`fe.estado = $${pc}`); params.push(estado) }
      if (canal_id) { pc++; where.push(`$${pc} = ANY(fe.canales)`); params.push(Number(canal_id)) }

      const tzExpr = `(fe.created_at AT TIME ZONE '${TZ}')::date`
      if (fecha_desde) { pc++; where.push(`${tzExpr} >= $${pc}::date`); params.push(fecha_desde) }
      if (fecha_hasta) { pc++; where.push(`${tzExpr} <= $${pc}::date`); params.push(fecha_hasta) }

      if (folio?.trim()) { pc++; where.push(`fe.folio_numero ILIKE $${pc}`); params.push(`%${folio.trim()}%`) }

      if (codigo_guia?.trim()) {
        pc++
        where.push(`EXISTS (
          SELECT 1 FROM folios_entrega_tarimas fet
          JOIN guias g ON g.tarima_id = fet.tarima_id
          WHERE fet.folio_id = fe.id AND fet.eliminado_en IS NULL AND g.codigo_guia ILIKE $${pc}
        )`)
        params.push(`%${codigo_guia.trim()}%`)
      }

      const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''

      const countRes = await query(`SELECT COUNT(*) FROM folios_entrega fe ${whereClause}`, params)
      const total = parseInt(countRes.rows[0].count)

      pc++; params.push(safeLimit)
      pc++; params.push(offset)

      const result = await query(
        `SELECT fe.id, fe.folio_numero, fe.estado, fe.canales,
                fe.total_tarimas, fe.total_guias, fe.created_at, fe.hora_fin,
                fe.fecha_tarimas_desde, fe.fecha_tarimas_hasta, fe.estatus_tarima_filtro,
                e.nombre AS empresa_nombre, e.codigo AS empresa_codigo, e.id AS empresa_id,
                u.nombre_completo AS creado_por_nombre
         FROM folios_entrega fe
         JOIN configuraciones e ON e.id = fe.empresa_id
         JOIN usuarios u ON u.id = fe.creado_por
         ${whereClause}
         ORDER BY fe.created_at DESC
         LIMIT $${pc-1} OFFSET $${pc}`,
        params
      )

      res.json({
        folios: result.rows,
        pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) }
      })
    } catch (err) {
      console.error('FEP list error:', err)
      res.status(500).json({ error: 'Error obteniendo folios' })
    }
  }
)

// ─── POST /api/fep/folios ────────────────────────────────────────────────────
router.post('/',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'crear'),
  async (req, res) => {
    const { empresa_id, canales, fecha_desde, fecha_hasta, estatus_tarima, tarima_ids } = req.body

    if (!empresa_id) return res.status(400).json({ error: 'empresa_id requerido' })
    if (!tarima_ids?.length) return res.status(400).json({ error: 'Se requiere al menos una tarima' })

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Atomic folio number generation
      const seqRes = await client.query(`SELECT nextval('fep_folio_seq') AS n`)
      const n = seqRes.rows[0].n
      const folioNumero = `FEP-${String(n).padStart(5, '0')}`

      const canalIds = canales?.length ? canales : null

      const folioRes = await client.query(
        `INSERT INTO folios_entrega
           (folio_numero, empresa_id, canales, fecha_tarimas_desde, fecha_tarimas_hasta,
            estatus_tarima_filtro, estado, hora_inicio, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,'ACTIVO',now(),$7)
         RETURNING *`,
        [folioNumero, empresa_id, canalIds, fecha_desde || new Date().toISOString().slice(0,10),
         fecha_hasta || new Date().toISOString().slice(0,10),
         estatus_tarima || 'FINALIZADA', req.fullUser.id]
      )
      const folio = folioRes.rows[0]

      // Verify tarimas are not already in an active folio
      const conflictRes = await client.query(
        `SELECT t.id, t.codigo, fe.folio_numero
         FROM tarimas t
         JOIN folios_entrega_tarimas fet ON fet.tarima_id = t.id AND fet.eliminado_en IS NULL
         JOIN folios_entrega fe ON fe.id = fet.folio_id AND fe.estado = 'ACTIVO'
         WHERE t.id = ANY($1)`,
        [tarima_ids]
      )
      if (conflictRes.rows.length > 0) {
        const codes = conflictRes.rows.map(r => `${r.codigo} (${r.folio_numero})`).join(', ')
        await client.query('ROLLBACK')
        return res.status(409).json({ error: `Tarimas ya en folio activo: ${codes}` })
      }

      // Insert tarima associations
      for (const tid of tarima_ids) {
        await client.query(
          `INSERT INTO folios_entrega_tarimas (folio_id, tarima_id, agregado_por) VALUES ($1,$2,$3)`,
          [folio.id, tid, req.fullUser.id]
        )
      }

      await recalcTotals(client, folio.id)
      await logAction(client, folio.id, 'CREACION', { tarima_ids }, req.fullUser.id)

      await client.query('COMMIT')

      // Return full folio with updated totals
      const fullRes = await query(
        `SELECT fe.*, e.nombre AS empresa_nombre, u.nombre_completo AS creado_por_nombre
         FROM folios_entrega fe
         JOIN configuraciones e ON e.id = fe.empresa_id
         JOIN usuarios u ON u.id = fe.creado_por
         WHERE fe.id = $1`,
        [folio.id]
      )
      res.status(201).json({ success: true, folio: fullRes.rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('FEP create error:', err)
      res.status(500).json({ error: 'Error creando folio' })
    } finally {
      client.release()
    }
  }
)

// ─── GET /api/fep/folios/:id ─────────────────────────────────────────────────
router.get('/:id',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'ver'),
  async (req, res) => {
    try {
      const { id } = req.params

      const folioRes = await query(
        `SELECT fe.*, e.nombre AS empresa_nombre, e.codigo AS empresa_codigo,
                u.nombre_completo AS creado_por_nombre
         FROM folios_entrega fe
         JOIN configuraciones e ON e.id = fe.empresa_id
         JOIN usuarios u ON u.id = fe.creado_por
         WHERE fe.id = $1`,
        [id]
      )
      if (!folioRes.rows.length) return res.status(404).json({ error: 'Folio no encontrado' })
      const folio = folioRes.rows[0]

      const tarimasRes = await query(
        `SELECT t.id, t.codigo, t.estado, t.cantidad_guias, t.fecha_inicio, t.fecha_cierre,
                c.nombre AS canal_nombre, c.id AS canal_id,
                fet.agregado_en, fet.eliminado_en
         FROM folios_entrega_tarimas fet
         JOIN tarimas t ON t.id = fet.tarima_id
         JOIN configuraciones c ON c.id = t.canal_id
         WHERE fet.folio_id = $1 AND fet.eliminado_en IS NULL
         ORDER BY fet.agregado_en ASC`,
        [id]
      )

      const guiasRes = await query(
        `SELECT g.codigo_guia, g.posicion, g.timestamp_escaneo, t.codigo AS tarima_codigo,
                c.nombre AS canal_nombre
         FROM folios_entrega_tarimas fet
         JOIN guias g ON g.tarima_id = fet.tarima_id
         JOIN tarimas t ON t.id = fet.tarima_id
         JOIN configuraciones c ON c.id = t.canal_id
         WHERE fet.folio_id = $1 AND fet.eliminado_en IS NULL
         ORDER BY g.timestamp_escaneo ASC`,
        [id]
      )

      res.json({ folio, tarimas: tarimasRes.rows, guias: guiasRes.rows })
    } catch (err) {
      console.error('FEP detail error:', err)
      res.status(500).json({ error: 'Error obteniendo folio' })
    }
  }
)

// ─── PATCH /api/fep/folios/:id ───────────────────────────────────────────────
router.patch('/:id',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'editar'),
  async (req, res) => {
    const { id } = req.params
    const { agregar_tarimas = [], eliminar_tarimas = [] } = req.body

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const folioRes = await client.query(`SELECT * FROM folios_entrega WHERE id = $1 FOR UPDATE`, [id])
      if (!folioRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Folio no encontrado' }) }
      const folio = folioRes.rows[0]

      if (folio.estado !== 'ACTIVO') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Solo se pueden editar folios activos' }) }
      if (!isSameDay(folio.created_at) && req.fullUser.rol_nombre !== 'Administrador') {
        await client.query('ROLLBACK')
        return res.status(403).json({ error: 'Solo se pueden editar folios creados hoy' })
      }

      // Remove tarimas
      if (eliminar_tarimas.length) {
        await client.query(
          `UPDATE folios_entrega_tarimas SET eliminado_en = now(), eliminado_por = $1
           WHERE folio_id = $2 AND tarima_id = ANY($3) AND eliminado_en IS NULL`,
          [req.fullUser.id, id, eliminar_tarimas]
        )
      }

      // Add tarimas (check conflicts first)
      if (agregar_tarimas.length) {
        const conflictRes = await client.query(
          `SELECT t.id, t.codigo, fe.folio_numero
           FROM tarimas t
           JOIN folios_entrega_tarimas fet ON fet.tarima_id = t.id AND fet.eliminado_en IS NULL
           JOIN folios_entrega fe ON fe.id = fet.folio_id AND fe.estado = 'ACTIVO'
           WHERE t.id = ANY($1) AND fe.id != $2`,
          [agregar_tarimas, id]
        )
        if (conflictRes.rows.length) {
          const codes = conflictRes.rows.map(r => r.codigo).join(', ')
          await client.query('ROLLBACK')
          return res.status(409).json({ error: `Tarimas ya en otro folio activo: ${codes}` })
        }

        for (const tid of agregar_tarimas) {
          await client.query(
            `INSERT INTO folios_entrega_tarimas (folio_id, tarima_id, agregado_por)
             VALUES ($1,$2,$3)
             ON CONFLICT (folio_id, tarima_id) DO UPDATE
               SET eliminado_en = NULL, eliminado_por = NULL, agregado_en = now(), agregado_por = $3`,
            [id, tid, req.fullUser.id]
          )
        }
      }

      await recalcTotals(client, id)
      await logAction(client, id, 'EDICION',
        { agregar_tarimas, eliminar_tarimas }, req.fullUser.id)

      await client.query('COMMIT')

      const fullRes = await query(
        `SELECT fe.*, e.nombre AS empresa_nombre FROM folios_entrega fe
         JOIN configuraciones e ON e.id = fe.empresa_id WHERE fe.id = $1`,
        [id]
      )
      res.json({ success: true, folio: fullRes.rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('FEP edit error:', err)
      res.status(500).json({ error: 'Error editando folio' })
    } finally {
      client.release()
    }
  }
)

// ─── POST /api/fep/folios/:id/cancelar ──────────────────────────────────────
router.post('/:id/cancelar',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'cancelar'),
  async (req, res) => {
    const { id } = req.params
    const { motivo } = req.body

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const folioRes = await client.query(`SELECT * FROM folios_entrega WHERE id = $1 FOR UPDATE`, [id])
      if (!folioRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Folio no encontrado' }) }
      const folio = folioRes.rows[0]

      if (folio.estado !== 'ACTIVO') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Solo se pueden cancelar folios activos' }) }
      if (folio.estado === 'COMPLETADO') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Los folios completados son inmutables' }) }

      await client.query(
        `UPDATE folios_entrega SET estado = 'CANCELADO', motivo_cancelacion = $1, hora_fin = now(), updated_at = now() WHERE id = $2`,
        [motivo || null, id]
      )
      await logAction(client, id, 'CANCELACION', { motivo }, req.fullUser.id)

      await client.query('COMMIT')
      res.json({ success: true })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('FEP cancel error:', err)
      res.status(500).json({ error: 'Error cancelando folio' })
    } finally {
      client.release()
    }
  }
)

// ─── DELETE /api/fep/folios/:id ──────────────────────────────────────────────
router.delete('/:id',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'eliminar'),
  async (req, res) => {
    const { id } = req.params
    const client = await getClient()
    try {
      await client.query('BEGIN')

      const folioRes = await client.query(`SELECT * FROM folios_entrega WHERE id = $1 FOR UPDATE`, [id])
      if (!folioRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Folio no encontrado' }) }
      const folio = folioRes.rows[0]

      if (folio.estado === 'COMPLETADO') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Los folios completados son inmutables' }) }

      const canPhysDelete = ['Administrador', 'Jefe'].includes(req.fullUser.rol_nombre)
      if (!canPhysDelete) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Solo Supervisor y Administrador pueden eliminar folios' }) }

      const isAdmin = ['Administrador'].includes(req.fullUser.rol_nombre)
      if (!isAdmin && !isSameDay(folio.created_at)) {
        await client.query('ROLLBACK')
        return res.status(403).json({ error: 'Solo se pueden eliminar folios del día actual' })
      }
      if (!isAdmin && !['ACTIVO', 'CANCELADO'].includes(folio.estado)) {
        await client.query('ROLLBACK')
        return res.status(403).json({ error: 'Estado no permite eliminación' })
      }

      await logAction(client, id, 'ELIMINACION', { folio_numero: folio.folio_numero }, req.fullUser.id)
      await client.query(`DELETE FROM folios_entrega WHERE id = $1`, [id])

      await client.query('COMMIT')
      res.json({ success: true })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('FEP delete error:', err)
      res.status(500).json({ error: 'Error eliminando folio' })
    } finally {
      client.release()
    }
  }
)

// ─── GET /api/fep/folios/:id/log ─────────────────────────────────────────────
router.get('/:id/log',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'ver'),
  async (req, res) => {
    try {
      const result = await query(
        `SELECT l.id, l.accion, l.detalle, l.timestamp, u.nombre_completo AS usuario_nombre
         FROM folios_entrega_log l
         LEFT JOIN usuarios u ON u.id = l.usuario_id
         WHERE l.folio_id = $1
         ORDER BY l.timestamp ASC`,
        [req.params.id]
      )
      res.json({ log: result.rows })
    } catch (err) {
      console.error('FEP log error:', err)
      res.status(500).json({ error: 'Error obteniendo log' })
    }
  }
)

// ─── GET /api/fep/folios/:id/pdf ─────────────────────────────────────────────
router.get('/:id/pdf',
  authenticateToken, loadFullUser,
  requirePermission('fep.folios', 'ver'),
  async (req, res) => {
    try {
      const { id } = req.params

      const folioRes = await query(
        `SELECT fe.*, e.nombre AS empresa_nombre, e.codigo AS empresa_codigo,
                u.nombre_completo AS creado_por_nombre
         FROM folios_entrega fe
         JOIN configuraciones e ON e.id = fe.empresa_id
         JOIN usuarios u ON u.id = fe.creado_por
         WHERE fe.id = $1`,
        [id]
      )
      if (!folioRes.rows.length) return res.status(404).json({ error: 'Folio no encontrado' })
      const folio = folioRes.rows[0]

      const guiasRes = await query(
        `SELECT g.codigo_guia, g.posicion, g.timestamp_escaneo,
                t.codigo AS tarima_codigo, c.nombre AS canal_nombre
         FROM folios_entrega_tarimas fet
         JOIN guias g ON g.tarima_id = fet.tarima_id
         JOIN tarimas t ON t.id = fet.tarima_id
         JOIN configuraciones c ON c.id = t.canal_id
         WHERE fet.folio_id = $1 AND fet.eliminado_en IS NULL
         ORDER BY g.timestamp_escaneo ASC`,
        [id]
      )

      const tarimasRes = await query(
        `SELECT COUNT(*) AS total FROM folios_entrega_tarimas WHERE folio_id = $1 AND eliminado_en IS NULL`,
        [id]
      )

      // Log impresion
      const client2 = await getClient()
      try {
        await logAction(client2, id, 'IMPRESION', { usuario: req.fullUser.nombre_completo }, req.fullUser.id)
      } finally {
        client2.release()
      }

      const doc = new PDFDocument({ size: 'LETTER', margin: 50, autoFirstPage: true, bufferPages: true })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${folio.folio_numero}.pdf"`)
      doc.pipe(res)
      doc.on('error', (err) => {
        console.error('PDFDocument error:', err.message)
        if (!res.headersSent) res.status(500).json({ error: 'Error generando PDF' })
      })

      const fmtDate = (ts) => ts ? new Date(ts).toLocaleString('es-MX', { timeZone: TZ }) : '-'
      const generadoEn = fmtDate(new Date())
      const guias = guiasRes.rows

      // Header — first page only
      doc.fontSize(18).font('Helvetica-Bold').text('FOLIO DE ENTREGA', { align: 'center' })
      doc.fontSize(14).text(folio.folio_numero, { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      doc.text(`Empresa: ${folio.empresa_nombre}   |   Estado: ${folio.estado}`, { align: 'center' })
      doc.text(`Fecha: ${fmtDate(folio.created_at)}   |   Inicio: ${fmtDate(folio.hora_inicio)}`, { align: 'center' })
      if (folio.hora_fin) doc.text(`Fin: ${fmtDate(folio.hora_fin)}`, { align: 'center' })
      doc.moveDown()
      doc.font('Helvetica-Bold').text(`Total Tarimas: ${tarimasRes.rows[0].total}   Total Guias: ${guias.length}`)
      doc.moveDown()

      // Table header
      const tableTop = doc.y
      const cols = { n: 40, fecha: 120, guia: 160, tarima: 100, canal: 90 }
      let x = 50
      doc.font('Helvetica-Bold').fontSize(8)
      doc.text('#', x, tableTop); x += cols.n
      doc.text('Fecha y Hora', x, tableTop); x += cols.fecha
      doc.text('No. Guia', x, tableTop); x += cols.guia
      doc.text('Tarima', x, tableTop); x += cols.tarima
      doc.text('Canal', x, tableTop)

      let y = tableTop + 14
      doc.moveTo(50, y).lineTo(560, y).stroke()
      y += 2
      doc.font('Helvetica').fontSize(8)

      guias.forEach((g, i) => {
        if (y > 700) { doc.addPage(); y = 50 }
        x = 50
        doc.text(String(i + 1), x, y, { width: cols.n - 4 }); x += cols.n
        doc.text(fmtDate(g.timestamp_escaneo), x, y, { width: cols.fecha - 5 }); x += cols.fecha
        doc.text(g.codigo_guia, x, y, { width: cols.guia - 5 }); x += cols.guia
        doc.text(g.tarima_codigo || '-', x, y, { width: cols.tarima - 5 }); x += cols.tarima
        doc.text(g.canal_nombre || '-', x, y, { width: cols.canal })
        y += 12
      })

      // Signature section
      if (y > 620) { doc.addPage(); y = 50 }
      y += 20
      doc.moveTo(50, y).lineTo(560, y).stroke(); y += 20
      doc.font('Helvetica-Bold').fontSize(9)
      doc.text('Firma Responsable de Entrega:', 50, y)
      doc.text('Firma Receptor Paqueteria:', 320, y)
      y += 40
      doc.moveTo(50, y).lineTo(250, y).stroke()
      doc.moveTo(320, y).lineTo(520, y).stroke()

      // Footer - add to all pages at the end
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        const bottom = doc.page.height - 35
        doc.save()
        doc.fontSize(7).font('Helvetica').fillColor('#6b7280')
        doc.text(
          `Folio: ${folio.folio_numero}  |  Empresa: ${folio.empresa_nombre}  |  Fecha: ${fmtDate(folio.created_at)}  |  Imp: ${generadoEn}  |  Página ${i + 1} de ${range.count}`,
          50, bottom, { width: 512, align: 'center' }
        )
        doc.restore()
      }

      doc.end()
    } catch (err) {
      console.error('FEP pdf error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Error generando PDF' })
    }
  }
)

export default router
