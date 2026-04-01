import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Header from '../../../core/components/layout/Header'
import LoadingSpinner from '../../../core/components/common/LoadingSpinner'
import { useI18nStore } from '../../../core/stores/i18nStore'
import * as ds from '../services/dropscanService'
import { BarChart3, Download, TrendingUp, Package, CheckCircle, Building2, Radio, Clock, User, ChevronDown, X } from 'lucide-react'
import MultiSelect from '../../../core/components/common/MultiSelect'
import { useAuthStore } from '../../../core/stores/authStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import * as XLSX from 'xlsx'
import { fmtDate, fmtDateShort, fmtDateTime } from '../../../core/utils/dateFormat'

export default function Reportes() {
  const { t } = useI18nStore()
  const { canWrite } = useAuthStore()
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const [fechaInicio, setFechaInicio] = useState(weekAgo)
  const [fechaFin, setFechaFin] = useState(today)
  const [empresaFilter, setEmpresaFilter] = useState([])
  const [canalFilter, setCanalFilter] = useState([])
  const [escaneadorFilter, setEscaneadorFilter] = useState([])

  // Fetch empresas and canales for filters
  const { data: empresasData } = useQuery({ queryKey: ['dropscan-empresas'], queryFn: ds.getEmpresas })
  const { data: canalesData } = useQuery({ queryKey: ['dropscan-canales'], queryFn: ds.getCanales })
  const empresas = (Array.isArray(empresasData) ? empresasData : empresasData?.items || empresasData?.empresas || []).filter(e => e.activo !== false)
  const canales = (Array.isArray(canalesData) ? canalesData : canalesData?.items || canalesData?.canales || []).filter(c => c.activo !== false)

  const { data, isLoading } = useQuery({
    queryKey: ['dropscan-metrics', fechaInicio, fechaFin, empresaFilter, canalFilter, escaneadorFilter],
    queryFn: () => ds.getMetrics(fechaInicio, fechaFin, empresaFilter.length ? empresaFilter : undefined, canalFilter.length ? canalFilter : undefined, escaneadorFilter.length ? escaneadorFilter : undefined),
    enabled: !!fechaInicio && !!fechaFin,
  })

  const { data: escaneadoresData } = useQuery({
    queryKey: ['dropscan-escaneadores-opts', fechaInicio, fechaFin, empresaFilter, canalFilter],
    queryFn: () => ds.getMetrics(fechaInicio, fechaFin, empresaFilter.length ? empresaFilter : undefined, canalFilter.length ? canalFilter : undefined),
    enabled: !!fechaInicio && !!fechaFin,
  })
  const escaneadoresOpts = (escaneadoresData?.por_escaneador || []).map(e => ({ value: e.escaneador, label: e.escaneador }))

  const totales = data?.totales || {}
  const porDia = data?.por_dia || []
  const porEmpresa = data?.por_empresa || []
  const porCanal = data?.por_canal || []
  const porEscaneador = data?.por_escaneador || []
  const PIE_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#84cc16']

  const [isExporting, setIsExporting] = useState(false)

  // Chart visibility selector
  const CHART_OPTIONS = [
    { key: 'dailyGuides', label: 'Guías diarias' },
    { key: 'avgTime', label: 'Tiempo promedio' },
    { key: 'byEmpresa', label: 'Por empresa' },
    { key: 'byCanal', label: 'Por canal' },
    { key: 'byEscaneador', label: 'Por escaneador' },
  ]
  const CHART_DEFAULTS = { dailyGuides: true, avgTime: true, byEmpresa: true, byCanal: true, byEscaneador: true }
  const [visibleCharts, setVisibleCharts] = useState(() => {
    try {
      const saved = localStorage.getItem('dropscan-visible-charts')
      return saved ? { ...CHART_DEFAULTS, ...JSON.parse(saved) } : CHART_DEFAULTS
    } catch { return CHART_DEFAULTS }
  })
  const toggleChart = (key) => setVisibleCharts(v => {
    const next = { ...v, [key]: !v[key] }
    try { localStorage.setItem('dropscan-visible-charts', JSON.stringify(next)) } catch {}
    return next
  })
  const activeCharts = CHART_OPTIONS.filter(c => visibleCharts[c.key])

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
            fmtDate(d.fecha),
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
            r.fecha_inicio ? fmtDateTime(r.fecha_inicio) : '',
            r.fecha_cierre ? fmtDateTime(r.fecha_cierre) : '',
            r.duracion_min || '',
            r.codigo_guia || '',
            r.posicion || '',
            r.timestamp_escaneo ? fmtDateTime(r.timestamp_escaneo) : '',
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
          {/* Filters */}
          <motion.div className="card p-4 space-y-3"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Compact date range */}
              <div className="flex items-center gap-1.5 bg-warm-50 border border-warm-200 rounded-xl px-3 py-2 shrink-0">
                <Clock className="w-3.5 h-3.5 text-warm-400" />
                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                  className="text-xs outline-none bg-transparent text-warm-700 w-[108px]" />
                <span className="text-warm-300 text-xs">→</span>
                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                  className="text-xs outline-none bg-transparent text-warm-700 w-[108px]" />
              </div>
              {/* Quick presets */}
              {[
                { l: 'Hoy', f: () => { setFechaInicio(today); setFechaFin(today) } },
                { l: '7d', f: () => { setFechaInicio(weekAgo); setFechaFin(today) } },
                { l: '30d', f: () => { setFechaInicio(new Date(Date.now()-30*86400000).toISOString().slice(0,10)); setFechaFin(today) } },
              ].map(({ l, f }) => (
                <button key={l} onClick={f} className="px-2.5 py-1.5 text-xs font-semibold bg-warm-100 text-warm-600 hover:bg-warm-200 rounded-lg transition-colors">{l}</button>
              ))}
              {/* Empresa + Canal */}
              <MultiSelect icon={Building2} placeholder={t('history.company')}
                options={empresas.map(e => ({ value: e.id, label: e.nombre, color: e.color }))}
                selected={empresaFilter} onChange={setEmpresaFilter} />
              <MultiSelect icon={Radio} placeholder={t('history.channel')}
                options={canales.map(c => ({ value: c.id, label: c.nombre }))}
                selected={canalFilter} onChange={setCanalFilter} />
              <MultiSelect icon={User} placeholder="Escaneador"
                options={escaneadoresOpts}
                selected={escaneadorFilter} onChange={setEscaneadorFilter} />
              <div className="ml-auto flex items-center gap-2">
                {/* Chart selector */}
                <div className="relative group">
                  <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-warm-100 text-warm-700 hover:bg-warm-200 rounded-xl transition-colors border border-warm-200">
                    <BarChart3 className="w-3.5 h-3.5" /> Gráficas <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-depth border border-warm-100 min-w-[180px] overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                    {CHART_OPTIONS.map(opt => (
                      <button key={opt.key} onClick={() => toggleChart(opt.key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                          visibleCharts[opt.key] ? 'text-primary-700 bg-primary-50/60' : 'text-warm-500 hover:bg-warm-50'
                        }`}>
                        <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                          visibleCharts[opt.key] ? 'border-primary-500 bg-primary-500' : 'border-warm-300'
                        }`}>
                          {visibleCharts[opt.key] && <span className="text-white text-[8px] font-bold">✓</span>}
                        </div>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {canWrite('dropscan.reportes') && (
                  <button onClick={handleExport} disabled={!porDia.length || isExporting}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-success-50 text-success-700 hover:bg-success-100 rounded-xl transition-colors border border-success-200 disabled:opacity-50">
                    {isExporting ? <div className="w-3.5 h-3.5 border-2 border-success-600 border-t-transparent rounded-full animate-spin" />
                      : <Download className="w-3.5 h-3.5" />} Exportar
                  </button>
                )}
              </div>
            </div>
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
              {porDia.length > 0 && activeCharts.length > 0 && (
                <div className={`grid gap-4 ${
                  activeCharts.length === 1 ? 'grid-cols-1' :
                  activeCharts.length === 2 ? 'grid-cols-2' :
                  activeCharts.length >= 3 ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2'
                }`}>
                  {/* Daily guides */}
                  {visibleCharts.dailyGuides && (
                    <div className="card p-4">
                      <h3 className="text-xs font-semibold text-warm-600 mb-2">{t('reports.dailyTrend')}</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={porDia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="fecha" tick={{ fontSize: 9 }} tickFormatter={(d) => fmtDate(d)} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} labelFormatter={(d) => fmtDate(d)} />
                          <Bar dataKey="guias" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Guías" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Avg time trend */}
                  {visibleCharts.avgTime && (
                    <div className="card p-4">
                      <h3 className="text-xs font-semibold text-warm-600 mb-2">{t('reports.avgTime')}</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={porDia.filter(d => d.tiempo_promedio_min > 0)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="fecha" tick={{ fontSize: 9 }} tickFormatter={(d) => fmtDate(d)} />
                          <YAxis tick={{ fontSize: 9 }} unit="m" />
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                            labelFormatter={(d) => fmtDate(d)}
                            formatter={(v) => [`${v} min`, 'Tiempo promedio']} />
                          <Line type="monotone" dataKey="tiempo_promedio_min" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Tiempo (min)" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Empresa donut */}
                  {visibleCharts.byEmpresa && porEmpresa.length > 0 && (
                    <div className="card p-4">
                      <h3 className="text-xs font-semibold text-warm-600 mb-2">Por Empresa</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={porEmpresa} dataKey="guias" nameKey="empresa" cx="50%" cy="45%" innerRadius={48} outerRadius={75} paddingAngle={3} strokeWidth={0}>
                            {porEmpresa.map((e, i) => (
                              <Cell key={e.empresa} fill={e.color || PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v, n) => [`${v} guías`, n]} />
                          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} formatter={(v) => <span style={{ fontSize: 10, color: '#64748b' }}>{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Canal donut */}
                  {visibleCharts.byCanal && porCanal.length > 0 && (
                    <div className="card p-4">
                      <h3 className="text-xs font-semibold text-warm-600 mb-2">Por Canal</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={porCanal} dataKey="guias" nameKey="canal" cx="50%" cy="45%" innerRadius={48} outerRadius={75} paddingAngle={3} strokeWidth={0}>
                            {porCanal.map((c, i) => (
                              <Cell key={c.canal} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v, n) => [`${v} guías`, n]} />
                          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} formatter={(v) => <span style={{ fontSize: 10, color: '#64748b' }}>{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Por escaneador */}
                  {visibleCharts.byEscaneador && porEscaneador.length > 0 && (
                    <div className={`card p-4 ${activeCharts.length <= 2 ? '' : 'xl:col-span-2'}`}>
                      <h3 className="text-xs font-semibold text-warm-600 mb-2">Por Escaneador</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={porEscaneador} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 9 }} />
                          <YAxis type="category" dataKey="escaneador" tick={{ fontSize: 9 }} width={90} />
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                            formatter={(v) => [`${v} guías`, 'Guías']} />
                          <Bar dataKey="guias" fill="#10b981" radius={[0, 3, 3, 0]} name="Guías" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Per-escaneador table */}
              {porEscaneador.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-warm-100/60 bg-gradient-to-r from-warm-50 to-primary-50/40">
                    <h3 className="text-sm font-semibold text-warm-700 flex items-center gap-2">
                      <User className="w-4 h-4 text-warm-400" /> Por Escaneador
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-warm-50 to-primary-50/40 border-b border-warm-200">
                          <th className="text-left px-4 py-3 font-bold text-warm-600">Escaneador</th>
                          <th className="text-center px-4 py-3 font-bold text-warm-600">{t('dashboard.pallets')}</th>
                          <th className="text-center px-4 py-3 font-bold text-warm-600">{t('dashboard.guides')}</th>
                          <th className="px-4 py-3 font-bold text-warm-600 w-40">Rendimiento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {porEscaneador.map((e, i) => {
                          const maxGuias = porEscaneador[0]?.guias || 1
                          return (
                            <tr key={e.escaneador || i} className="hover:bg-primary-50/20 transition-colors">
                              <td className="px-4 py-3 font-semibold text-warm-700">{e.escaneador}</td>
                              <td className="px-4 py-3 text-center text-warm-600">{e.tarimas}</td>
                              <td className="px-4 py-3 text-center font-bold text-warm-700">{e.guias}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-warm-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-success-400 rounded-full" style={{ width: `${(e.guias / maxGuias) * 100}%` }} />
                                  </div>
                                  <span className="text-[10px] text-warm-400 w-8 text-right">{Math.round((e.guias / maxGuias) * 100)}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Daily detail table */}
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
                              {fmtDateShort(d.fecha)}
                            </td>
                            <td className="px-4 py-3 text-center text-warm-600">{d.tarimas}</td>
                            <td className="px-4 py-3 text-center text-success-600 font-semibold">{d.completadas}</td>
                            <td className="px-4 py-3 text-center font-bold text-warm-700">{d.guias}</td>
                            <td className="px-4 py-3 text-center text-warm-500">{d.tiempo_promedio_min > 0 ? `${d.tiempo_promedio_min} min` : '—'}</td>
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
