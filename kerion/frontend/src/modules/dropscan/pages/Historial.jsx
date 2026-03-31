import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Header from '../../../core/components/layout/Header'
import Modal from '../../../core/components/common/Modal'
import LoadingSpinner from '../../../core/components/common/LoadingSpinner'
import { useAuthStore } from '../../../core/stores/authStore'
import { useToastStore } from '../../../core/stores/toastStore'
import { useI18nStore } from '../../../core/stores/i18nStore'
import * as ds from '../services/dropscanService'
import {
  ChevronLeft, ChevronRight, Eye, Trash2, Search, Download,
  Package, Clock, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, X,
  RotateCcw, AlertTriangle, Copy
} from 'lucide-react'

export default function Historial() {
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  // Default date range: last 30 days
  const defaultEnd = new Date().toISOString().slice(0, 10)
  const defaultStart = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [filters, setFilters] = useState({
    estado: searchParams.get('estado') || '',
    fecha_inicio: searchParams.get('fecha_inicio') || defaultStart,
    fecha_fin: searchParams.get('fecha_fin') || defaultEnd,
    search: searchParams.get('search') || ''
  })
  const [selectedTarima, setSelectedTarima] = useState(null)
  const [deletingTarima, setDeletingTarima] = useState(null) // tarima row to delete
  const [sortCol, setSortCol] = useState('fecha_inicio')
  const [sortDir, setSortDir] = useState('desc')
  const [detailTab, setDetailTab] = useState('guias')
  const { canDelete, user } = useAuthStore()
  const toast = useToastStore.getState()
  const { t } = useI18nStore()
  const qc = useQueryClient()

  const highlightGuia = searchParams.get('highlight_guia') || ''
  const highlightRowRef = useRef(null)

  // Auto-open tarima detail if navigated from SearchBar with tarima_id param
  useEffect(() => {
    const tarimaId = searchParams.get('tarima_id')
    if (tarimaId) {
      setDetailTab('guias')
      setSelectedTarima(parseInt(tarimaId))
    }
  }, [searchParams])

  // Scroll highlighted guide into view when modal opens
  useEffect(() => {
    if (highlightGuia && selectedTarima && highlightRowRef.current) {
      setTimeout(() => highlightRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400)
    }
  }, [selectedTarima, highlightGuia])

  const { data, isLoading } = useQuery({
    queryKey: ['dropscan-tarimas', page, filters],
    queryFn: () => ds.getTarimas({ ...filters, page, limit: 15 }),
  })

  const rawTarimasDup = data?.tarimas || []
  const rawTarimas = rawTarimasDup.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 }

  // Client-side sort
  const tarimas = useMemo(() => {
    const sorted = [...rawTarimas]
    sorted.sort((a, b) => {
      let aV = a[sortCol], bV = b[sortCol]
      if (sortCol === 'cantidad_guias') { aV = Number(aV); bV = Number(bV) }
      if (sortCol === 'fecha_inicio') { aV = new Date(aV); bV = new Date(bV) }
      if (typeof aV === 'string') { aV = aV.toLowerCase(); bV = bV?.toLowerCase() || '' }
      if (aV < bV) return sortDir === 'asc' ? -1 : 1
      if (aV > bV) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [rawTarimas, sortCol, sortDir])

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['dropscan-tarima-detail', selectedTarima],
    queryFn: () => ds.getTarimaDetail(selectedTarima),
    enabled: !!selectedTarima,
  })

  const { data: duplicadosData, isLoading: duplicadosLoading } = useQuery({
    queryKey: ['dropscan-tarima-duplicados', selectedTarima],
    queryFn: () => ds.getTarimaDuplicados(selectedTarima),
    enabled: !!selectedTarima && detailTab === 'duplicados',
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => ds.deleteTarima(id),
    onSuccess: () => { toast.success(t('history.palletDeleted')); qc.invalidateQueries({ queryKey: ['dropscan-tarimas'] }); setSelectedTarima(null) },
    onError: (err) => toast.error(err.response?.data?.error || t('toast.error'))
  })

  const reopenMutation = useMutation({
    mutationFn: (id) => ds.reopenTarima(id),
    onSuccess: () => {
      toast.success(t('history.palletReopened'))
      qc.invalidateQueries({ queryKey: ['dropscan-tarimas'] })
      qc.invalidateQueries({ queryKey: ['dropscan-tarima-detail'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || t('toast.error'))
  })

  const estadoColors = {
    'EN_PROCESO': 'bg-warning-100 text-warning-700',
    'FINALIZADA': 'bg-success-100 text-success-700',
    'CANCELADA': 'bg-danger-100 text-danger-700',
  }

  const getEstadoLabels = (t) => ({
    'EN_PROCESO': t('status.EN_PROCESO'),
    'FINALIZADA': t('status.FINALIZADA'),
    'CANCELADA': t('status.CANCELADA'),
  })
  const estadoLabels = getEstadoLabels(t)

  const canReopen = user && ['Supervisor', 'Jefe', 'Administrador'].includes(user.rol_nombre)

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-warm-300" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-500" /> : <ArrowDown className="w-3 h-3 text-primary-500" />
  }

  const clearFilters = () => { setFilters({ estado: '', fecha_inicio: '', fecha_fin: '', search: '' }); setPage(1) }
  const hasActiveFilters = filters.estado || filters.fecha_inicio || filters.search

  const handleExport = () => {
    try {
      const csv = [
        ['Codigo', 'Empresa', 'Canal', 'Operador', 'Guias', 'Estado', 'Fecha'].join(','),
        ...tarimas.map(row => [row.codigo, row.empresa_nombre, row.canal_nombre, row.operador_nombre, row.cantidad_guias, row.estado, new Date(row.fecha_inicio).toLocaleString('es-MX')].join(','))
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `historial_${new Date().toISOString().slice(0,10)}.csv`; a.click()
      toast.success(t('toast.success'))
    } catch { toast.error(t('toast.error')) }
  }

  const handleOpenDetail = (id) => {
    setDetailTab('guias')
    setSelectedTarima(id)
  }

  const detail = detailData?.tarima
  const detailGuias = detailData?.guias || []
  const duplicados = duplicadosData?.duplicados || []

  return (
    <div className="flex flex-col h-full">
      <Header title={t('history.title')} subtitle={t('history.subtitle')} showSearch />

      <div className="flex-1 overflow-y-auto">
        {/* Filter bar */}
        <div className="sticky top-0 z-[5] bg-white/60 backdrop-blur-2xl border-b border-warm-100/40 px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Global search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
              <input value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
                placeholder={t('scan.searchPallet')}
                className="w-full pl-10 pr-10 py-2 text-sm rounded-xl border border-warm-200 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white" />
              {filters.search && (
                <button onClick={() => setFilters(f => ({ ...f, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-warm-400 hover:text-warm-600" />
                </button>
              )}
            </div>

            {/* Quick status filter */}
            {['', 'EN_PROCESO', 'FINALIZADA', 'CANCELADA'].map(s => (
              <button key={s} onClick={() => { setFilters(f => ({ ...f, estado: s })); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${filters.estado === s ? 'bg-primary-600 text-white shadow-glow' : 'bg-warm-100 text-warm-600 hover:bg-warm-200'}`}>
                {s === '' ? t('common.all') : estadoLabels[s]}
              </button>
            ))}

            {/* Quick date filters */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setFilters(f => ({ ...f, fecha_inicio: defaultEnd, fecha_fin: defaultEnd })); setPage(1) }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-warm-100 text-warm-600 hover:bg-warm-200 transition-colors"
              >Hoy</button>
              <button
                onClick={() => { setFilters(f => ({ ...f, fecha_inicio: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), fecha_fin: defaultEnd })); setPage(1) }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-warm-100 text-warm-600 hover:bg-warm-200 transition-colors"
              >7 días</button>
              <button
                onClick={() => { setFilters(f => ({ ...f, fecha_inicio: defaultStart, fecha_fin: defaultEnd })); setPage(1) }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-warm-100 text-warm-600 hover:bg-warm-200 transition-colors"
              >Último mes</button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <input type="date" value={filters.fecha_inicio} onChange={e => { setFilters(f => ({ ...f, fecha_inicio: e.target.value })); setPage(1) }}
                className="px-2.5 py-1.5 rounded-lg border border-warm-200 text-xs outline-none focus:border-primary-400" />
              <span className="text-xs text-warm-400">--</span>
              <input type="date" value={filters.fecha_fin} onChange={e => { setFilters(f => ({ ...f, fecha_fin: e.target.value })); setPage(1) }}
                className="px-2.5 py-1.5 rounded-lg border border-warm-200 text-xs outline-none focus:border-primary-400" />
            </div>

            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-primary-600 hover:text-primary-700 font-semibold transition-colors">{t('common.clear')}</button>
            )}
            <button onClick={handleExport} className="p-2 rounded-xl text-warm-400 hover:text-primary-600 hover:bg-primary-50 transition-all" title="Exportar CSV">
              <Download className="w-4 h-4" />
            </button>
            <span className="badge bg-warm-100 text-warm-500">{pagination.total} {t('dashboard.pallets')}</span>
          </div>
        </div>

        <div className="p-4">
          <div className="max-w-full mx-auto">
            {/* Table */}
            <motion.div
              className="card overflow-hidden"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {isLoading ? (
                <LoadingSpinner text={t('common.loading')} />
              ) : tarimas.length === 0 ? (
                <div className="p-16 text-center text-sm text-warm-400">{t('history.noPalletsFound')}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-warm-50 border-b border-warm-100">
                        <th className="table-header" onClick={() => handleSort('codigo')}>
                          <span className="flex items-center gap-1.5">{t('history.palletCode')} <SortIcon col="codigo" /></span>
                        </th>
                        <th className="table-header" onClick={() => handleSort('empresa_nombre')}>
                          <span className="flex items-center gap-1.5">{t('history.company')} <SortIcon col="empresa_nombre" /></span>
                        </th>
                        <th className="table-header" onClick={() => handleSort('canal_nombre')}>
                          <span className="flex items-center gap-1.5">{t('history.channel')} <SortIcon col="canal_nombre" /></span>
                        </th>
                        <th className="table-header" onClick={() => handleSort('operador_nombre')}>
                          <span className="flex items-center gap-1.5">{t('history.operator')} <SortIcon col="operador_nombre" /></span>
                        </th>
                        <th className="table-header text-center" onClick={() => handleSort('cantidad_guias')}>
                          <span className="flex items-center justify-center gap-1.5">{t('history.guides')} <SortIcon col="cantidad_guias" /></span>
                        </th>
                        <th className="table-header text-center" onClick={() => handleSort('estado')}>
                          <span className="flex items-center justify-center gap-1.5">{t('common.status')} <SortIcon col="estado" /></span>
                        </th>
                        <th className="table-header" onClick={() => handleSort('fecha_inicio')}>
                          <span className="flex items-center gap-1.5">{t('history.date')} <SortIcon col="fecha_inicio" /></span>
                        </th>
                        <th className="table-header text-center">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-50">
                      {tarimas.map(row => (
                        <tr key={row.id} className="hover:bg-warm-50/50 transition-colors group">
                          <td className="table-cell">
                            <span className="font-mono font-semibold text-warm-700">{row.codigo}</span>
                          </td>
                          <td className="table-cell text-warm-600">{row.empresa_nombre}</td>
                          <td className="table-cell text-warm-600">{row.canal_nombre}</td>
                          <td className="table-cell text-warm-600">{row.operador_nombre}</td>
                          <td className="table-cell text-center">
                            <span className="font-bold text-warm-700">{row.cantidad_guias}</span>
                            <span className="text-warm-400">/100</span>
                          </td>
                          <td className="table-cell text-center">
                            <span className={`badge text-[10px] ${estadoColors[row.estado] || 'bg-warm-100 text-warm-600'}`}>
                              {estadoLabels[row.estado] || row.estado}
                            </span>
                          </td>
                          <td className="table-cell text-warm-500 text-xs">
                            {new Date(row.fecha_inicio).toLocaleDateString('es-MX')}
                            <br /><span className="text-warm-400">{new Date(row.fecha_inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenDetail(row.id)}
                                className="p-2 rounded-xl hover:bg-primary-50 text-warm-400 hover:text-primary-600 transition-all" title="Ver detalle">
                                <Eye className="w-4 h-4" />
                              </button>
                              {canDelete('dropscan.historial') && (
                                <button onClick={() => setDeletingTarima(row)}
                                  className="p-2 rounded-xl hover:bg-danger-50 text-warm-400 hover:text-danger-500 transition-all" title="Eliminar">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-warm-100 bg-warm-50/30">
                  <p className="text-xs text-warm-400 font-medium">{t('common.page')} {pagination.page} / {pagination.pages} · {pagination.total} {t('common.records')}</p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-2 rounded-xl hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                      className="p-2 rounded-xl hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedTarima} onClose={() => setSelectedTarima(null)} icon={Package}
        title={detail ? `${t('history.palletDetail')} ${detail.codigo}` : t('common.loading')} size="xl"
        footer={detail && (
          <>
            {detail.estado === 'FINALIZADA' && canReopen && (
              <button onClick={() => reopenMutation.mutate(detail.id)}
                disabled={reopenMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm bg-primary-50 text-primary-700 rounded-xl hover:bg-primary-100 font-semibold transition-all disabled:opacity-50">
                <RotateCcw className="w-4 h-4" /> {t('history.reopen')}
              </button>
            )}
            <button onClick={() => setSelectedTarima(null)} className="btn-ghost">{t('common.close')}</button>
          </>
        )}>
        {detailLoading ? (
          <LoadingSpinner text={t('common.loading')} />
        ) : detail ? (
          <div className="space-y-5">
            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Package, l: t('history.company'), v: detail.empresa_nombre },
                { icon: Package, l: t('history.channel'), v: detail.canal_nombre },
                { icon: Package, l: t('history.operator'), v: detail.operador_nombre },
                { icon: Package, l: t('history.guides'), v: `${detail.cantidad_guias}/100` },
                { icon: CheckCircle, l: t('common.status'), v: estadoLabels[detail.estado] || detail.estado },
                { icon: Clock, l: t('history.startTime'), v: new Date(detail.fecha_inicio).toLocaleString('es-MX') },
                { icon: Clock, l: t('history.endTime'), v: detail.fecha_cierre ? new Date(detail.fecha_cierre).toLocaleString('es-MX') : '--' },
                { icon: Clock, l: t('history.duration'), v: detail.tiempo_armado_segundos ? `${Math.round(detail.tiempo_armado_segundos / 60)} min` : '--' },
              ].map(f => (
                <div key={f.l} className="p-3 rounded-xl bg-warm-50 border border-warm-100/50">
                  <p className="text-[10px] text-warm-400 uppercase tracking-wider font-bold mb-0.5">{f.l}</p>
                  <p className="text-sm font-semibold text-warm-700">{f.v}</p>
                </div>
              ))}
            </div>

            {/* Cancellation reason */}
            {detail.estado === 'CANCELADA' && detail.cancelada_razon && (
              <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-warning-700">{t('history.palletCancelled')}</p>
                  <p className="text-xs text-warning-600 mt-0.5">{detail.cancelada_razon}</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-warm-100">
              <button
                onClick={() => setDetailTab('guias')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px
                  ${detailTab === 'guias'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-warm-400 hover:text-warm-600'}`}
              >
                {t('history.correctGuides')} ({detailGuias.length})
              </button>
              <button
                onClick={() => setDetailTab('duplicados')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-1.5
                  ${detailTab === 'duplicados'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-warm-400 hover:text-warm-600'}`}
              >
                <Copy className="w-3.5 h-3.5" /> {t('scan.duplicates')}
              </button>
            </div>

            {/* Tab content: Guias Correctas */}
            {detailTab === 'guias' && (
              <div>
                {detailGuias.length === 0 ? (
                  <div className="p-8 text-center text-sm text-warm-400">{t('history.noGuidesRegistered')}</div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-warm-100 scrollbar-thin">
                    <table className="w-full text-xs">
                      <thead className="bg-warm-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-bold text-warm-500">#</th>
                          <th className="text-left px-3 py-2.5 font-bold text-warm-500">{t('history.guideCode')}</th>
                          <th className="text-left px-3 py-2.5 font-bold text-warm-500">{t('history.operator')}</th>
                          <th className="text-left px-3 py-2.5 font-bold text-warm-500">{t('history.scanTime')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-warm-50">
                        {detailGuias.map(g => {
                          const isHighlighted = highlightGuia && g.codigo_guia === highlightGuia
                          return (
                            <tr key={g.id}
                              ref={isHighlighted ? highlightRowRef : null}
                              className={`transition-colors ${isHighlighted ? 'bg-warning-100 border-l-4 border-warning-500' : 'hover:bg-warm-50'}`}>
                              <td className="px-3 py-2 text-warm-400 font-bold">{g.posicion}</td>
                              <td className={`px-3 py-2 font-mono font-semibold ${isHighlighted ? 'text-warning-700' : 'text-warm-700'}`}>
                                {g.codigo_guia}
                                {isHighlighted && <span className="ml-2 text-[9px] bg-warning-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">encontrada</span>}
                              </td>
                              <td className="px-3 py-2 text-warm-500">{g.operador_nombre}</td>
                              <td className="px-3 py-2 text-warm-400">{new Date(g.timestamp_escaneo).toLocaleTimeString('es-MX')}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab content: Duplicados */}
            {detailTab === 'duplicados' && (
              <div>
                {duplicadosLoading ? (
                  <LoadingSpinner text={t('common.loading')} />
                ) : duplicados.length === 0 ? (
                  <div className="p-8 text-center text-sm text-warm-400">
                    <Copy className="w-8 h-8 text-warm-200 mx-auto mb-2" />
                    {t('history.noDuplicatesFound')}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-warm-100 scrollbar-thin">
                    <table className="w-full text-xs">
                      <thead className="bg-warm-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-bold text-warm-500">{t('history.duplicateGuide')}</th>
                          <th className="text-left px-3 py-2.5 font-bold text-warm-500">{t('history.originalGuide')}</th>
                          <th className="text-left px-3 py-2.5 font-bold text-warm-500">{t('history.operator')}</th>
                          <th className="text-left px-3 py-2.5 font-bold text-warm-500">{t('history.scanTime')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-warm-50">
                        {duplicados.map((d, i) => (
                          <tr key={d.id || i} className="hover:bg-warm-50 transition-colors">
                            <td className="px-3 py-2 font-mono font-semibold text-danger-600">{d.codigo_guia}</td>
                            <td className="px-3 py-2 font-mono text-warm-600">{d.guia_original || d.codigo_guia_original || '--'}</td>
                            <td className="px-3 py-2 text-warm-500">{d.operador_nombre}</td>
                            <td className="px-3 py-2 text-warm-400">{d.timestamp ? new Date(d.timestamp).toLocaleTimeString('es-MX') : '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deletingTarima} onClose={() => setDeletingTarima(null)}
        title="Eliminar Tarima" icon={Trash2} size="sm"
        footer={<>
          <button onClick={() => setDeletingTarima(null)} className="btn-ghost">Cancelar</button>
          <button
            onClick={() => { deleteMutation.mutate(deletingTarima.id); setDeletingTarima(null) }}
            disabled={deleteMutation.isPending}
            className="btn-danger inline-flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar permanentemente'}
          </button>
        </>}>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-danger-800">Esta acción no se puede revertir</p>
              <p className="text-xs text-danger-600 mt-1">
                Se eliminarán permanentemente la tarima y todas sus guías escaneadas.
              </p>
            </div>
          </div>
          {deletingTarima && (
            <div className="p-3 rounded-xl bg-warm-50 border border-warm-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-warm-500 font-medium">Tarima</span>
                <span className="text-sm font-bold font-mono text-warm-800">{deletingTarima.codigo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-warm-500 font-medium">Empresa</span>
                <span className="text-sm font-semibold text-warm-700">{deletingTarima.empresa_nombre}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-warm-500 font-medium">Guías</span>
                <span className="text-sm font-semibold text-warm-700">{deletingTarima.cantidad_guias}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
