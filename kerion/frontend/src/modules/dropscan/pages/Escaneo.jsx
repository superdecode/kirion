import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../../../core/components/layout/Header'
import Modal from '../../../core/components/common/Modal'
import { useAuthStore } from '../../../core/stores/authStore'
import { useToastStore } from '../../../core/stores/toastStore'
import { useI18nStore } from '../../../core/stores/i18nStore'
import * as ds from '../services/dropscanService'
import api from '../../../core/services/api'
import {
  ScanBarcode, Play, Square, Package, Trash2, Search,
  CheckCircle, XCircle, Volume2, VolumeX,
  PanelRightClose, PanelRightOpen, Clock, Ban, AlertTriangle, Plus
} from 'lucide-react'

const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination); gain.gain.value = 0.15
    if (type === 'success') { osc.frequency.value = 880; osc.type = 'sine'; osc.start(); osc.stop(ctx.currentTime + 0.1) }
    else if (type === 'error') { osc.frequency.value = 220; osc.type = 'square'; osc.start(); osc.stop(ctx.currentTime + 0.3) }
    else if (type === 'complete') { osc.frequency.value = 1200; osc.type = 'sine'; osc.start(); setTimeout(() => { osc.frequency.value = 1500 }, 100); osc.stop(ctx.currentTime + 0.25) }
    else if (type === 'warning') { osc.frequency.value = 600; osc.type = 'triangle'; osc.start(); osc.stop(ctx.currentTime + 0.2) }
  } catch (e) { /* silent */ }
}

function getTodayDateStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const estadoBadgeClass = (estado) => {
  switch (estado) {
    case 'EN_PROCESO': return 'bg-primary-100 text-primary-700'
    case 'FINALIZADA': return 'bg-success-100 text-success-700'
    case 'CANCELADA': return 'bg-danger-100 text-danger-700'
    default: return 'bg-warm-200 text-warm-600'
  }
}

export default function Escaneo() {
  const [sessionActive, setSessionActive] = useState(false)
  const [session, setSession] = useState(null)
  const [tarima, setTarima] = useState(null)
  const [tarimasActivas, setTarimasActivas] = useState([]) // Multi-tarima support
  const [guias, setGuias] = useState([])
  const [duplicados, setDuplicados] = useState([])
  const [completedTarimas, setCompletedTarimas] = useState([])
  const [scanInput, setScanInput] = useState('')
  const [lastScan, setLastScan] = useState(null)
  const [flashType, setFlashType] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showStartModal, setShowStartModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showPanel, setShowPanel] = useState(true)
  const [panelSearch, setPanelSearch] = useState('')
  const [panelDetailId, setPanelDetailId] = useState(null)
  const [historyTab, setHistoryTab] = useState('guias') // 'guias' or 'duplicados'
  const [selectedEmpresa, setSelectedEmpresa] = useState('')
  const [selectedCanal, setSelectedCanal] = useState('')
  const inputRef = useRef(null)
  const qc = useQueryClient()
  const { canDelete, user } = useAuthStore()
  const toast = useToastStore
  const { t } = useI18nStore()
  const isSupervisor = user?.rol_nombre === 'Supervisor' || user?.rol_nombre === 'Jefe' || user?.rol_nombre === 'Administrador'

  const { data: empresasData } = useQuery({ queryKey: ['dropscan-empresas'], queryFn: ds.getEmpresas })
  const { data: canalesData } = useQuery({ queryKey: ['dropscan-canales'], queryFn: ds.getCanales })
  const empresas = empresasData?.items || []
  const canales = canalesData?.items || []

  // Today's history for no-session view
  const todayStr = getTodayDateStr()
  const { data: todayHistoryData } = useQuery({
    queryKey: ['dropscan-today-history', todayStr],
    queryFn: () => ds.getTarimas({ fecha_inicio: todayStr, fecha_fin: todayStr }),
    enabled: !sessionActive,
  })
  const todayTarimas = todayHistoryData?.items || todayHistoryData?.tarimas || []

  // Panel detail
  const { data: panelDetailData } = useQuery({
    queryKey: ['dropscan-tarima-detail', panelDetailId],
    queryFn: () => ds.getTarimaDetail(panelDetailId),
    enabled: !!panelDetailId,
  })

  useEffect(() => {
    ds.getActiveSession().then((data) => {
      if (data.sesion) {
        setSession(data.sesion)
        setTarima(data.tarima_actual)
        setTarimasActivas(data.tarimas_activas || [data.tarima_actual].filter(Boolean))
        setGuias(data.ultimas_guias || [])
        setSessionActive(true)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (sessionActive && inputRef.current) inputRef.current.focus()
  }, [sessionActive, guias])

  useEffect(() => {
    if (flashType) {
      const t = setTimeout(() => setFlashType(null), 500)
      return () => clearTimeout(t)
    }
  }, [flashType])

  // --- Mutations ---

  const startMutation = useMutation({
    mutationFn: () => ds.startSession(parseInt(selectedEmpresa), parseInt(selectedCanal)),
    onSuccess: (data) => {
      setSession(data.sesion)
      setTarima(data.tarima_actual)
      setTarimasActivas(data.tarimas_activas || [data.tarima_actual])
      setGuias([])
      setDuplicados([])
      setCompletedTarimas([])
      setSessionActive(true)
      setShowStartModal(false)
      toast.success(t('scan.sessionStarted'))
      setTimeout(() => inputRef.current?.focus(), 100)
    },
    onError: (err) => toast.error(err.response?.data?.error || t('toast.error'))
  })

  const endMutation = useMutation({
    mutationFn: () => ds.endSession(session.id),
    onSuccess: () => {
      setSessionActive(false)
      setSession(null)
      setTarima(null)
      setTarimasActivas([])
      setGuias([])
      setDuplicados([])
      setLastScan(null)
      setCompletedTarimas([])
      toast.info(t('scan.sessionEnded'))
      qc.invalidateQueries({ queryKey: ['dropscan-today-history'] })
    },
    onError: () => toast.error(t('toast.error'))
  })

  // Multi-tarima mutations
  const addTarimaMutation = useMutation({
    mutationFn: () => ds.addTarima(session.id),
    onSuccess: (data) => {
      setTarima(data.nueva_tarima)
      setTarimasActivas(data.tarimas_activas)
      setGuias([])
      toast.success(t('scan.newPalletCreated'))
      setTimeout(() => inputRef.current?.focus(), 100)
    },
    onError: (err) => toast.error(err.response?.data?.error || t('toast.error'))
  })

  const switchTarimaMutation = useMutation({
    mutationFn: (tarimaId) => ds.switchTarima(session.id, tarimaId),
    onSuccess: (data) => {
      setTarima(data.tarima_actual)
      setGuias(data.ultimas_guias || [])
      setTimeout(() => inputRef.current?.focus(), 100)
    },
    onError: (err) => toast.error(err.response?.data?.error || t('toast.error'))
  })

  const scanMutation = useMutation({
    mutationFn: (code) => ds.scanGuia(session.id, code, tarima?.id),
    onSuccess: (data) => {
      setLastScan({ type: 'success', code: data.guia.codigo_guia, pos: data.guia.posicion })
      setFlashType('success')
      if (soundEnabled) playSound('success')

      if (data.tarima_completada) {
        setCompletedTarimas(prev => [{ ...data.tarima, estado: 'FINALIZADA', completedAt: new Date() }, ...prev])
        setTarima(data.nueva_tarima)
        // Update tarimasActivas: remove completed, add new
        setTarimasActivas(prev => {
          const filtered = prev.filter(t => t.id !== data.tarima.id)
          return data.nueva_tarima ? [...filtered, data.nueva_tarima] : filtered
        })
        setGuias([])
        if (soundEnabled) playSound('complete')
        toast.success(t('scan.palletCompleted'))
      } else {
        setTarima(data.tarima)
        // Update the tarima in tarimasActivas
        setTarimasActivas(prev => prev.map(t => t.id === data.tarima.id ? data.tarima : t))
        setGuias(prev => [data.guia, ...prev].slice(0, 20))
      }

      if (data.alerta) {
        if (soundEnabled) playSound('warning')
        toast.warning(data.alerta.message)
      }
      setScanInput('')
      setSession(prev => prev ? { ...prev, total_guias: (prev.total_guias || 0) + 1 } : prev)
    },
    onError: (err) => {
      const d = err.response?.data
      if (d?.error === 'DUPLICADO') {
        // Build detailed duplicate message with position info
        let detailMessage = d.message
        if (d.posicion_original) {
          if (d.duplicado_en === 'tarima_actual') {
            detailMessage = t('scan.alreadyScannedInPallet').replace('{pos}', d.posicion_original)
          } else if (d.duplicado_en === 'otra_tarima') {
            detailMessage = t('scan.alreadyScannedInOtherPallet')
              .replace('{pallet}', d.tarima_original)
              .replace('{pos}', d.posicion_original)
          }
        }
        setLastScan({ type: 'duplicate', message: detailMessage })
        setFlashType('error')
        if (soundEnabled) playSound('error')
        toast.error(detailMessage)
        setDuplicados(prev => [{
          codigo_guia: scanInput.trim(),
          message: detailMessage,
          tarima_original: d.tarima_original,
          posicion_original: d.posicion_original,
          duplicado_en: d.duplicado_en,
          timestamp: new Date()
        }, ...prev])
        setSession(prev => prev ? { ...prev, alertas_duplicados: (prev.alertas_duplicados || 0) + 1 } : prev)
      } else {
        toast.error(d?.error || t('toast.error'))
        setFlashType('error')
        if (soundEnabled) playSound('error')
      }
      setScanInput('')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (guiaId) => ds.deleteGuia(session.id, guiaId),
    onSuccess: (_, guiaId) => {
      setGuias(prev => prev.filter(g => g.id !== guiaId))
      setTarima(prev => prev ? { ...prev, cantidad_guias: prev.cantidad_guias - 1 } : prev)
      setSession(prev => prev ? { ...prev, total_guias: Math.max(0, (prev.total_guias || 1) - 1) } : prev)
      toast.success(t('scan.guideDeleted'))
    },
    onError: () => toast.error(t('toast.error'))
  })

  const cancelTarimaMutation = useMutation({
    mutationFn: (razon) => api.post(`/dropscan/tarimas/${tarima.id}/cancel`, { razon }).then(r => r.data),
    onSuccess: (data) => {
      toast.success(t('scan.palletCancelled'))
      setShowCancelModal(false)
      setCancelReason('')
      if (data.nueva_tarima) {
        setTarima(data.nueva_tarima)
        setGuias([])
      } else {
        // If backend does not auto-create a new tarima, prompt or end
        setTarima(null)
        setGuias([])
        toast.info(t('scan.newPalletCreated'))
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || t('toast.error'))
  })

  const handleScan = useCallback((e) => {
    e.preventDefault()
    const code = scanInput.trim()
    if (!code || scanMutation.isPending) return
    scanMutation.mutate(code)
  }, [scanInput, scanMutation])

  const handleDeleteDuplicado = (index) => {
    setDuplicados(prev => prev.filter((_, i) => i !== index))
  }

  const handleCancelTarima = () => {
    if (!cancelReason.trim()) {
      toast.warning(t('scan.cancelReasonRequired'))
      return
    }
    cancelTarimaMutation.mutate(cancelReason.trim())
  }

  const progressPercent = tarima ? (tarima.cantidad_guias / 100) * 100 : 0
  const progressGradient = progressPercent >= 95
    ? 'from-danger-400 to-danger-600'
    : progressPercent >= 90
      ? 'from-warning-400 to-warning-600'
      : 'from-primary-400 to-accent-500'

  // Panel filtered tarimas
  const allTarimas = tarima ? [{ ...tarima, isCurrent: true }, ...completedTarimas] : completedTarimas
  const filteredPanel = panelSearch
    ? allTarimas.filter(t => t.codigo?.toLowerCase().includes(panelSearch.toLowerCase()))
    : allTarimas

  // --- NO SESSION VIEW ---
  if (!sessionActive) {
    return (
      <div className="flex flex-col h-full">
        <Header title={t('scan.title')} subtitle="DropScan" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {/* Start session CTA */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow-lg"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.05, rotate: 3 }}
              >
                <ScanBarcode className="w-12 h-12 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-warm-800 mb-2">{t('scan.startSession')}</h2>
              <p className="text-sm text-warm-500 mb-8 leading-relaxed">
                {t('scan.startDesc')}
              </p>
              <motion.button
                onClick={() => setShowStartModal(true)}
                className="btn-primary inline-flex items-center gap-2.5 px-8 py-3.5 text-base shadow-glow"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Play className="w-5 h-5" /> {t('scan.start')}
              </motion.button>
            </motion.div>

            {/* Today's history */}
            <motion.div
              className="card overflow-hidden"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="px-5 py-3.5 border-b border-warm-100 flex items-center justify-between bg-warm-50/50">
                <h4 className="text-sm font-bold text-warm-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warm-400" />
                  {t('history.todayHistory')}
                </h4>
                <span className="badge bg-warm-100 text-warm-500">{todayTarimas.length}</span>
              </div>
              {todayTarimas.length === 0 ? (
                <div className="p-10 text-center text-sm text-warm-400">
                  {t('history.noPalletsToday')}
                </div>
              ) : (
                <div className="divide-y divide-warm-50">
                  {todayTarimas.map(t => (
                    <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-warm-50/50 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-semibold text-warm-700 truncate">{t.codigo}</p>
                        <p className="text-[10px] text-warm-400 font-medium">
                          {t.cantidad_guias} {t('dashboard.guides')}
                          {t.created_at && ` · ${new Date(t.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <span className={`badge text-[9px] ${estadoBadgeClass(t.estado)}`}>
                        {t.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Start session modal */}
        <Modal isOpen={showStartModal} onClose={() => setShowStartModal(false)} title={t('scan.newScanSession')} icon={ScanBarcode}
          footer={<>
            <button onClick={() => setShowStartModal(false)} className="btn-ghost">{t('common.cancel')}</button>
            <button onClick={() => startMutation.mutate()} disabled={!selectedEmpresa || !selectedCanal || startMutation.isPending} className="btn-primary">
              {startMutation.isPending ? t('scan.starting') : t('scan.start')}
            </button>
          </>}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1.5">{t('scan.company')}</label>
              <select value={selectedEmpresa} onChange={(e) => setSelectedEmpresa(e.target.value)} className="select-field">
                <option value="">{t('scan.selectCompany')}</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1.5">{t('scan.channel')}</label>
              <select value={selectedCanal} onChange={(e) => setSelectedCanal(e.target.value)} className="select-field">
                <option value="">{t('scan.selectChannel')}</option>
                {canales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // --- ACTIVE SESSION VIEW ---
  return (
    <div className="flex flex-col h-full">
      <Header title={t('scan.activeTitle')} subtitle={`${session?.empresa_nombre || ''} · ${session?.canal_nombre || ''}`}
        actions={
          <div className="flex items-center gap-1.5">
            <button onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-2 rounded-xl transition-all inline-flex items-center gap-2 text-sm font-semibold ${soundEnabled ? 'text-primary-600 bg-primary-50 shadow-sm' : 'text-warm-500 bg-warm-100 hover:bg-warm-200'}`}
              title={soundEnabled ? t('scan.soundOn') : t('scan.soundOff')}>
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? t('scan.sound') : t('scan.mute')}</span>
            </button>
            <button onClick={() => setShowPanel(!showPanel)}
              className="px-3 py-2 rounded-xl text-warm-500 bg-warm-100 hover:bg-warm-200 transition-all hidden lg:inline-flex items-center gap-2 text-sm font-semibold"
              title={showPanel ? t('scan.hidePanel') : t('scan.showPanel')}>
              {showPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              <span>{t('scan.panel')}</span>
            </button>
            <button onClick={() => setShowCancelModal(true)}
              disabled={!tarima}
              className="px-3 py-2 rounded-xl text-warning-600 bg-warning-50 hover:bg-warning-100 transition-all inline-flex items-center gap-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('scan.cancelPallet')}>
              <Ban className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.cancel')}</span>
            </button>
            <button onClick={() => { if (confirm(t('scan.endConfirm'))) endMutation.mutate() }}
              className="btn-danger inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
              <Square className="w-4 h-4" /> {t('scan.end')}
            </button>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main scanning area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {/* Multi-tarima tabs */}
            {tarimasActivas.length > 0 && (
              <motion.div
                className="flex items-center gap-2 mb-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto pb-1">
                  {tarimasActivas.map((t, idx) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (t.id !== tarima?.id) {
                          switchTarimaMutation.mutate(t.id)
                        }
                      }}
                      disabled={switchTarimaMutation.isPending}
                      className={`relative px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
                        t.id === tarima?.id
                          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                          : 'bg-white border-2 border-warm-200 text-warm-600 hover:border-primary-300 hover:text-primary-600'
                      }`}
                    >
                      <span className="font-mono">{t.codigo?.split('-').pop() || `#${idx + 1}`}</span>
                      <span className="ml-2 text-xs opacity-80">({t.cantidad_guias}/100)</span>
                      {t.id === tarima?.id && (
                        <motion.div
                          layoutId="active-tarima-indicator"
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                    </button>
                  ))}
                </div>
                {/* Add tarima button */}
                {tarimasActivas.length < 3 && (
                  <button
                    onClick={() => addTarimaMutation.mutate()}
                    disabled={addTarimaMutation.isPending}
                    className="p-2.5 rounded-xl bg-success-50 border-2 border-success-200 text-success-600 hover:bg-success-100 hover:border-success-300 transition-all shrink-0 disabled:opacity-50"
                    title={t('scan.addPallet')}
                  >
                    {addTarimaMutation.isPending ? (
                      <div className="w-5 h-5 border-2 border-success-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                )}
              </motion.div>
            )}

            {/* Tarima Status Card */}
            <motion.div
              className="card p-6 mb-6 bg-gradient-to-br from-white via-primary-50/30 to-accent-50/20 border-2 border-primary-100/50 shadow-lg"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-1">{t('scan.activePallet')}</p>
                  <h3 className="text-xl font-extrabold text-warm-800 tracking-tight">{tarima?.codigo || '—'}</h3>
                </div>
                <div className="text-right">
                  <p className="text-5xl font-black text-warm-800 tracking-tighter leading-none">
                    {tarima?.cantidad_guias || 0}
                  </p>
                  <p className="text-xs text-warm-400 font-semibold mt-1">{t('scan.of100Guides')}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-4 bg-gradient-to-r from-warm-100 to-warm-50 rounded-full overflow-hidden shadow-inner-soft border border-warm-200/50">
                <div className={`h-full bg-gradient-to-r ${progressGradient} rounded-full transition-all duration-500 ease-out shadow-sm
                                 ${progressPercent > 0 ? 'min-w-[8px]' : ''}`}
                  style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-warm-400 font-bold">0%</span>
                {progressPercent >= 90 && (
                  <span className="text-[10px] text-danger-500 font-bold animate-pulse">
                    {progressPercent >= 95 ? t('scan.almostFull') : t('scan.reachingCapacity')}
                  </span>
                )}
                <span className="text-[10px] text-warm-400 font-bold">100%</span>
              </div>

              {/* Session stats - 2 columns */}
              <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-primary-100/40">
                <div className="text-center p-2 rounded-xl bg-white/60">
                  <p className="text-2xl font-extrabold text-warm-800">{session?.total_guias || 0}</p>
                  <p className="text-[10px] text-warm-400 uppercase tracking-wider font-bold">{t('scan.totalGuides')}</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/60">
                  <p className="text-2xl font-extrabold text-danger-500">{session?.alertas_duplicados || 0}</p>
                  <p className="text-[10px] text-warm-400 uppercase tracking-wider font-bold">{t('scan.duplicates')}</p>
                </div>
              </div>
            </motion.div>

            {/* Scan Input */}
            <form onSubmit={handleScan} className="mb-5">
              <div className="relative">
                <ScanBarcode className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-warm-300" />
                <input ref={inputRef} type="text" value={scanInput} onChange={(e) => setScanInput(e.target.value)}
                  placeholder={t('scan.placeholder')} autoFocus autoComplete="off"
                  className={`w-full pl-14 pr-5 py-5 text-xl bg-white border-2 border-warm-200 rounded-2xl
                             focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:shadow-glow
                             transition-all outline-none placeholder:text-warm-300 font-mono tracking-wide
                             ${flashType === 'success' ? 'animate-scan-success' : flashType === 'error' ? 'animate-scan-error' : ''}`} />
                {scanMutation.isPending && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </form>

            {/* Last scan feedback */}
            <AnimatePresence mode="wait">
              {lastScan && (
                <motion.div
                  key={lastScan.code || lastScan.message}
                  initial={{ opacity: 0, y: -10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className={`mb-5 p-4 rounded-2xl flex items-center gap-3 ${
                    lastScan.type === 'success' ? 'bg-success-50/80 border border-success-200 backdrop-blur-sm' : 'bg-danger-50/80 border border-danger-200 backdrop-blur-sm'
                  }`}>
                  {lastScan.type === 'success'
                    ? <CheckCircle className="w-5 h-5 text-success-500 shrink-0" />
                    : <XCircle className="w-5 h-5 text-danger-500 shrink-0" />}
                  <p className={`text-sm font-semibold ${lastScan.type === 'success' ? 'text-success-700' : 'text-danger-700'}`}>
                    {lastScan.type === 'success' ? `${t('scan.guideRegistered')} ${lastScan.code} · ${t('scan.position')} ${lastScan.pos}` : lastScan.message}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Historial lateral con tabs */}
            <div className="card overflow-hidden">
              {/* Tab headers */}
              <div className="flex border-b border-warm-100">
                <button
                  onClick={() => setHistoryTab('guias')}
                  className={`flex-1 px-4 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    historyTab === 'guias'
                      ? 'text-primary-700 bg-primary-50/50 border-b-2 border-primary-500'
                      : 'text-warm-500 hover:text-warm-700 hover:bg-warm-50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {t('scan.correctGuides')}
                  <span className={`badge text-xs ${historyTab === 'guias' ? 'bg-primary-100 text-primary-700' : 'bg-warm-100 text-warm-500'}`}>
                    {guias.length}
                  </span>
                </button>
                <button
                  onClick={() => setHistoryTab('duplicados')}
                  className={`flex-1 px-4 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    historyTab === 'duplicados'
                      ? 'text-danger-700 bg-danger-50/50 border-b-2 border-danger-500'
                      : 'text-warm-500 hover:text-warm-700 hover:bg-warm-50'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  {t('scan.duplicates')}
                  <span className={`badge text-xs ${historyTab === 'duplicados' ? 'bg-danger-100 text-danger-600' : 'bg-warm-100 text-warm-500'}`}>
                    {duplicados.length}
                  </span>
                </button>
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                {historyTab === 'guias' ? (
                  <motion.div
                    key="guias-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {guias.length === 0 ? (
                      <div className="p-10 text-center text-sm text-warm-400">{t('scan.firstScan')}</div>
                    ) : (
                      <div className="divide-y divide-warm-50 max-h-80 overflow-y-auto scrollbar-thin">
                        {guias.map((g, i) => (
                          <div key={g.id} className={`flex items-center gap-4 px-5 py-3 hover:bg-warm-50/50 transition-colors ${i === 0 ? 'bg-primary-50/30' : ''}`}>
                            <span className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {g.posicion}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-mono font-semibold text-warm-700 truncate">{g.codigo_guia}</p>
                              <p className="text-[10px] text-warm-400 font-medium">{new Date(g.timestamp_escaneo).toLocaleTimeString('zh-CN')}</p>
                            </div>
                            {canDelete('dropscan.escaneo') && (isSupervisor || i === 0) && (
                              <button onClick={() => { if (confirm(t('scan.deleteGuideConfirm'))) deleteMutation.mutate(g.id) }}
                                className="p-2 rounded-xl hover:bg-danger-50 text-warm-300 hover:text-danger-500 transition-all"
                                title={i === 0 ? t('scan.deleteLastGuide') : t('scan.deleteGuide')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="duplicados-tab"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {duplicados.length === 0 ? (
                      <div className="p-10 text-center text-sm text-warm-400">{t('scan.noDuplicates')}</div>
                    ) : (
                      <div className="divide-y divide-warm-50 max-h-80 overflow-y-auto scrollbar-thin">
                        {duplicados.map((d, i) => (
                          <div key={`dup-${i}-${d.timestamp.getTime()}`} className="flex items-center gap-4 px-5 py-3 hover:bg-danger-50/30 transition-colors">
                            <span className="w-9 h-9 rounded-xl bg-danger-100 text-danger-600 flex items-center justify-center shrink-0">
                              {d.posicion_original ? (
                                <span className="text-xs font-bold">#{d.posicion_original}</span>
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-mono font-semibold text-warm-700 truncate">{d.codigo_guia}</p>
                              <p className="text-[10px] text-danger-500 font-medium truncate">
                                {d.posicion_original ? (
                                  d.duplicado_en === 'tarima_actual' 
                                    ? `${t('scan.position')} #${d.posicion_original} (${d.tarima_original})`
                                    : `${t('scan.position')} #${d.posicion_original} → ${d.tarima_original}`
                                ) : d.message}
                              </p>
                              <p className="text-[10px] text-warm-400 font-medium">{d.timestamp.toLocaleTimeString('zh-CN')}</p>
                            </div>
                            {(isSupervisor || i === 0) && (
                              <button onClick={() => handleDeleteDuplicado(i)}
                                className="p-2 rounded-xl hover:bg-danger-50 text-warm-300 hover:text-danger-500 transition-all"
                                title={t('scan.removeFromList')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right side panel - session tarimas (desktop only) */}
        {showPanel && (
          <div className="hidden lg:flex w-80 border-l border-warm-100 bg-white flex-col shrink-0 animate-fade-in">
            <div className="px-4 py-3.5 border-b border-warm-100 bg-warm-50/50">
              <h4 className="text-sm font-bold text-warm-700 mb-2">{t('scan.sessionPallets')}</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-400" />
                <input value={panelSearch} onChange={e => setPanelSearch(e.target.value)}
                  placeholder={t('scan.searchPallet')} className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-warm-200 outline-none focus:border-primary-400" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
              {filteredPanel.length === 0 ? (
                <div className="py-8 text-center text-xs text-warm-400">{t('scan.noPalletsYet')}</div>
              ) : (
                filteredPanel.map(t => (
                  <div key={t.id} onClick={() => setPanelDetailId(t.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer
                      ${t.isCurrent
                        ? 'border-primary-200 bg-primary-50/50 shadow-sm'
                        : t.estado === 'CANCELADA'
                          ? 'border-danger-100 bg-danger-50/30 hover:border-danger-200'
                          : 'border-warm-100 hover:border-warm-200 hover:bg-warm-50'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-warm-700 font-mono">{t.codigo}</span>
                      {t.isCurrent ? (
                        <span className="badge bg-primary-100 text-primary-700 text-[9px]">ACTIVA</span>
                      ) : (
                        <span className={`badge text-[9px] ${estadoBadgeClass(t.estado)}`}>{t.estado}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-warm-400 font-medium">{t.cantidad_guias}/100 guias</span>
                      {t.completedAt && (
                        <span className="text-[10px] text-warm-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{new Date(t.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {/* Mini progress */}
                    <div className="w-full h-1.5 bg-warm-100 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full rounded-full ${
                        t.isCurrent ? 'bg-gradient-to-r from-primary-400 to-accent-500'
                        : t.estado === 'CANCELADA' ? 'bg-danger-400'
                        : 'bg-success-400'
                      }`}
                        style={{ width: `${(t.cantidad_guias / 100) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Panel detail modal */}
      <Modal isOpen={!!panelDetailId} onClose={() => setPanelDetailId(null)}
        title={panelDetailData?.tarima ? `${t('history.palletDetail')} ${panelDetailData.tarima.codigo}` : t('common.loading')} icon={Package} size="xl">
        {panelDetailData?.tarima && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { l: t('history.guides'), v: `${panelDetailData.tarima.cantidad_guias}/100` },
                { l: t('common.status'), v: panelDetailData.tarima.estado },
                { l: t('history.operator'), v: panelDetailData.tarima.operador_nombre },
                { l: t('history.company'), v: panelDetailData.tarima.empresa_nombre },
              ].map(f => (
                <div key={f.l} className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-warm-50 border border-purple-100">
                  <p className="text-[10px] text-warm-400 uppercase tracking-wider font-bold">{f.l}</p>
                  <p className="text-sm font-semibold text-warm-700 mt-0.5">{f.v}</p>
                </div>
              ))}
            </div>
            <h4 className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-3">{t('history.scannedGuides')} ({panelDetailData.guias?.length || 0})</h4>
            <div className="max-h-96 overflow-y-auto rounded-xl border border-warm-200 shadow-inner">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-warm-50 to-purple-50 sticky top-0 z-10 border-b border-warm-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-warm-600">#</th>
                    <th className="text-left px-4 py-3 font-bold text-warm-600">{t('history.guideCode')}</th>
                    <th className="text-left px-4 py-3 font-bold text-warm-600">{t('history.scanTime')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100">
                  {(panelDetailData.guias || []).map(g => (
                    <tr key={g.id} className="hover:bg-purple-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-warm-500 font-medium">{g.posicion}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-warm-700">{g.codigo_guia}</td>
                      <td className="px-4 py-2.5 text-warm-500">{new Date(g.timestamp_escaneo).toLocaleTimeString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel tarima modal */}
      <Modal isOpen={showCancelModal} onClose={() => { setShowCancelModal(false); setCancelReason('') }}
        title={t('scan.cancelPalletTitle')} icon={Ban}
        footer={<>
          <button onClick={() => { setShowCancelModal(false); setCancelReason('') }} className="btn-ghost">{t('common.back')}</button>
          <button onClick={handleCancelTarima}
            disabled={!cancelReason.trim() || cancelTarimaMutation.isPending}
            className="btn-danger inline-flex items-center gap-2">
            {cancelTarimaMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('scan.cancelling')}
              </>
            ) : (
              <>
                <Ban className="w-4 h-4" />
                {t('scan.cancelPallet')}
              </>
            )}
          </button>
        </>}>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-warning-50 border border-warning-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning-800">{t('scan.cancelPalletWarning')}</p>
              <p className="text-xs text-warning-600 mt-1">
                {t('history.palletCode')}: <span className="font-mono font-bold">{tarima?.codigo}</span> ({tarima?.cantidad_guias || 0} {t('dashboard.guides')})
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1.5">{t('scan.cancelReason')} *</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('scan.cancelReasonPlaceholder')}
              rows={3}
              className="w-full px-4 py-3 text-sm bg-white border-2 border-warm-200 rounded-xl
                         focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                         transition-all outline-none placeholder:text-warm-300 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
