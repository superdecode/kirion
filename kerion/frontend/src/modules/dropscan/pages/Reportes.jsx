import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Header from '../../../core/components/layout/Header'
import LoadingSpinner from '../../../core/components/common/LoadingSpinner'
import { useI18nStore } from '../../../core/stores/i18nStore'
import * as ds from '../services/dropscanService'
import { BarChart3, Download, Calendar, TrendingUp, Package, CheckCircle, Building2, Radio } from 'lucide-react'
import MultiSelect from '../../../core/components/common/MultiSelect'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import * as XLSX from 'xlsx'

export default function Reportes() {
  const { t } = useI18nStore()
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const [fechaInicio, setFechaInicio] = useState(weekAgo)
  const [fechaFin, setFechaFin] = useState(today)
  const [empresaFilter, setEmpresaFilter] = useState([])
  const [canalFilter, setCanalFilter] = useState([])

  // Fetch empresas and canales for filters
  const { data: empresasData } = useQuery({ queryKey: ['dropscan-empresas'], queryFn: ds.getEmpresas })
  const { data: canalesData } = useQuery({ queryKey: ['dropscan-canales'], queryFn: ds.getCanales })
  const empresas = (Array.isArray(empresasData) ? empresasData : empresasData?.items || empresasData?.empresas || []).filter(e => e.activo !== false)
  const canales = (Array.isArray(canalesData) ? canalesData : canalesData?.items || canalesData?.canales || []).filter(c => c.activo !== false)

  const { data, isLoading } = useQuery({
    queryKey: ['dropscan-metrics', fechaInicio, fechaFin, empresaFilter, canalFilter],
    queryFn: () => ds.getMetrics(fechaInicio, fechaFin, empresaFilter.length ? empresaFilter : undefined, canalFilter.length ? canalFilter : undefined),
    enabled: !!fechaInicio && !!fechaFin,
  })

  const totales = data?.totales || {}
  const porDia = data?.por_dia || []
  const porEmpresa = data?.por_empresa || []
  const porCanal = data?.por_canal || []
  const PIE_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#84cc16']

  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportData = await ds.getExportData(
        fechaInicio, fechaFin,
        empresaFilter.length ? empresaFilter : undefined,
        canalFilter.length ? canalFilter : undefined
      )
      const registros = exportData?.registros || []

      const wb = XLSX.utils.book_new()

      // Sheet 1: Daily summary
      if (porDia.length) {
        const resumenData = [
          [t('history.date'), t('dashboard.pallets'), t('dashboard.completedPallets'), t('dashboard.guides'), t('reports.avgTime')],
          ...porDia.map(d => [
            new Date(d.fecha).toLocaleDateString('es-MX'),
            d.tarimas,
            d.completadas,
            d.guias,
            d.tiempo_promedio_min
          ]),
          [],
          ['TOTALES', totales.tarimas, totales.completadas, totales.guias, '']
        ]
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData)
        wsResumen['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 18 }]
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')
      }

      // Sheet 2: All guides detail
      if (registros.length) {
        const detalleData = [
          ['Tarima', 'Empresa', 'Canal', 'Operador Tarima', 'Estado', 'Guías en Tarima', 'Inicio Tarima', 'Cierre Tarima', 'Duración (min)', 'Código Guía', 'Posición', 'Fecha Escaneo', 'Operador Escaneo'],
          ...registros.map(r => [
            r.tarima_codigo,
            r.empresa,
            r.canal,
            r.operador,
            r.estado,
            r.cantidad_guias,
            r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleString('es-MX') : '',
            r.fecha_cierre ? new Date(r.fecha_cierre).toLocaleString('es-MX') : '',
            r.duracion_min || '',
            r.codigo_guia || '',
            r.posicion || '',
            r.timestamp_escaneo ? new Date(r.timestamp_escaneo).toLocaleString('es-MX') : '',
            r.operador_guia || ''
          ])
        ]
        const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData)
        wsDetalle['!cols'] = [
          { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 12 },
          { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 22 },
          { wch: 10 }, { wch: 20 }, { wch: 20 }
        ]
        XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Guías')
      }

      XLSX.writeFile(wb, `reporte-dropscan-${fechaInicio}-${fechaFin}.xlsx`)
    } catch {
      // silent fail — toast would need import
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-full mx-auto space-y-6">
          {/* Date selector */}
          <motion.div
            className="card p-4 flex items-end gap-4 flex-wrap"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('history.startDate')}</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('history.endDate')}</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-primary-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setFechaInicio(today); setFechaFin(today) }}
                className="px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                {t('common.today')}
              </button>
              <button
                onClick={() => { setFechaInicio(weekAgo); setFechaFin(today) }}
                className="px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                {t('common.last7Days')}
              </button>
              <button
                onClick={() => {
                  const m = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
                  setFechaInicio(m); setFechaFin(today)
                }}
                className="px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                {t('common.last30Days')}
              </button>
            </div>
            {/* Empresa filter - multi-select */}
            <MultiSelect
              label={t('history.company')}
              icon={Building2}
              placeholder={t('common.all')}
              options={empresas.map(e => ({ value: e.id, label: e.nombre, color: e.color }))}
              selected={empresaFilter}
              onChange={setEmpresaFilter}
            />

            {/* Canal filter - multi-select */}
            <MultiSelect
              label={t('history.channel')}
              icon={Radio}
              placeholder={t('common.all')}
              options={canales.map(c => ({ value: c.id, label: c.nombre }))}
              selected={canalFilter}
              onChange={setCanalFilter}
            />

            <div className="flex-1" />
            <button
              onClick={handleExport}
              disabled={!porDia.length || isExporting}
              title={t('reports.exportExcel')}
              className="p-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Download className="w-4 h-4" />}
            </button>
          </motion.div>

          {isLoading ? (
            <LoadingSpinner text={t('common.loading')} />
          ) : (
            <>
              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {[
                  { icon: Package, value: totales.guias || 0, label: t('dashboard.totalGuides'), gradient: 'from-primary-100 to-primary-50', iconColor: 'text-primary-600' },
                  { icon: CheckCircle, value: totales.completadas || 0, label: t('dashboard.completedPallets'), gradient: 'from-success-100 to-success-50', iconColor: 'text-success-600' },
                  { icon: TrendingUp, value: totales.tarimas || 0, label: t('reports.totalPallets'), gradient: 'from-warning-100 to-warning-50', iconColor: 'text-warning-600' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    className="card-interactive p-5 flex items-center gap-4 group"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                      <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-warm-800">{stat.value}</p>
                      <p className="text-xs text-warm-400">{stat.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Charts */}
              {porDia.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {/* Daily guides */}
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold text-warm-700 mb-4">{t('reports.dailyTrend')}</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={porDia}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="fecha"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(d) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                          labelFormatter={(d) => new Date(d).toLocaleDateString('es-MX')}
                        />
                        <Bar dataKey="guias" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Guías" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Avg time trend */}
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold text-warm-700 mb-4">{t('reports.avgTime')}</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={porDia}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="fecha"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(d) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}
                        />
                        <YAxis tick={{ fontSize: 10 }} unit=" min" />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                          labelFormatter={(d) => new Date(d).toLocaleDateString('es-MX')}
                        />
                        <Line
                          type="monotone"
                          dataKey="tiempo_promedio_min"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          name="Tiempo (min)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Donut charts: empresa & canal distribution */}
              {(porEmpresa.length > 0 || porCanal.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {porEmpresa.length > 0 && (
                    <div className="card p-5">
                      <h3 className="text-sm font-semibold text-warm-700 mb-1">Distribución por Empresa</h3>
                      <p className="text-xs text-warm-400 mb-4">Guías escaneadas por empresa</p>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={porEmpresa}
                            dataKey="guias"
                            nameKey="empresa"
                            cx="50%" cy="50%"
                            innerRadius={65}
                            outerRadius={105}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {porEmpresa.map((e, i) => (
                              <Cell key={e.empresa} fill={e.color || PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                            formatter={(v, n) => [`${v} guías`, n]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {porCanal.length > 0 && (
                    <div className="card p-5">
                      <h3 className="text-sm font-semibold text-warm-700 mb-1">Distribución por Canal</h3>
                      <p className="text-xs text-warm-400 mb-4">Guías escaneadas por canal</p>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={porCanal}
                            dataKey="guias"
                            nameKey="canal"
                            cx="50%" cy="50%"
                            innerRadius={65}
                            outerRadius={105}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {porCanal.map((c, i) => (
                              <Cell key={c.canal} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                            formatter={(v, n) => [`${v} guías`, n]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Data table */}
              {porDia.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-warm-100/60 bg-gradient-to-r from-warm-50 to-primary-50/40">
                    <h3 className="text-sm font-semibold text-warm-700">{t('reports.dailyDetail')}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-warm-50 to-primary-50/40 border-b border-warm-200">
                          <th className="text-left px-4 py-3 font-bold text-warm-600">{t('history.date')}</th>
                          <th className="text-center px-4 py-3 font-bold text-warm-600">{t('dashboard.pallets')}</th>
                          <th className="text-center px-4 py-3 font-bold text-warm-600">{t('dashboard.completedPallets')}</th>
                          <th className="text-center px-4 py-3 font-bold text-warm-600">{t('dashboard.guides')}</th>
                          <th className="text-center px-4 py-3 font-bold text-warm-600">{t('reports.avgTime')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {porDia.map(d => (
                          <tr key={d.fecha} className="hover:bg-primary-50/20 transition-colors">
                            <td className="px-4 py-3 text-warm-700">
                              {new Date(d.fecha).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </td>
                            <td className="px-4 py-3 text-center text-warm-600">{d.tarimas}</td>
                            <td className="px-4 py-3 text-center text-success-600 font-semibold">{d.completadas}</td>
                            <td className="px-4 py-3 text-center font-bold text-warm-700">{d.guias}</td>
                            <td className="px-4 py-3 text-center text-warm-500">{d.tiempo_promedio_min} min</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-warm-50 to-primary-50/40 font-bold">
                          <td className="px-4 py-3 text-warm-700">{t('common.total')}</td>
                          <td className="px-4 py-3 text-center text-warm-700">{totales.tarimas}</td>
                          <td className="px-4 py-3 text-center text-success-600">{totales.completadas}</td>
                          <td className="px-4 py-3 text-center text-warm-700">{totales.guias}</td>
                          <td className="px-4 py-3 text-center text-warm-400">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
