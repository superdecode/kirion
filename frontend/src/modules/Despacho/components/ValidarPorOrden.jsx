import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, Plus, Trash2, CheckCircle2, XCircle, ScanLine, X,
  Check, PackageCheck, AlertCircle, ShieldCheck, ChevronDown, ChevronUp,
  Layers, MapPin, PartyPopper, ExternalLink, WifiOff, Barcode,
} from 'lucide-react'
import Modal from '../../../core/components/common/Modal'
import StatusPill from '../../../core/components/common/StatusPill'
import LoadingSpinner from '../../../core/components/common/LoadingSpinner'
import { useToastStore } from '../../../core/stores/toastStore'
import { useAuthStore } from '../../../core/stores/authStore'
import { useI18nStore } from '../../../core/stores/i18nStore'
import { fmtDateTime } from '../../../core/utils/dateFormat'
import { generateCodeVariations, normalizeCodeFast, normalizeScanCode } from '../../Shared/Wms/normalizeCode'
import { extractBaseCode } from '../../Shared/Wms/extractBaseCode'
import { playSound, initAudio } from '../../Shared/Wms/playSound'
import {
  getFolio, addOrder, updateOrder, removeOrder,
  cerrarFolio, cancelarFolio, findOrderByBarcode,
  addOrderScan, deleteLastOrderScan, setOrderScanSku,
} from '../services/despachoService'
import { getOutboundDetail } from '../../WmsHub/services/googleSheetsService'
import { orderNeedsRelabel, newLabelBase } from '../../Shared/Wms/relabelUtils'
import { orderNeedsProductLabel, productSkuCandidates, matchesProductSku } from '../../Shared/Wms/productLabelUtils'
import ScanInputBar from '../../Shared/Wms/ScanInputBar'
import { useOfflineStore } from '../../../core/stores/offlineStore'
import OfflineBlockedModal from '../../../core/components/common/OfflineBlockedModal'

const ORDER_ESTADO_META = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-warm-100 text-warm-600' },
  cargado:    { label: 'Cargado',    cls: 'bg-primary-100 text-primary-700' },
  entregado:  { label: 'Entregado',  cls: 'bg-success-100 text-success-700' },
  devolucion: { label: 'Devolución', cls: 'bg-danger-100 text-danger-700' },
}
const ORDER_ESTADOS = ['pendiente', 'cargado', 'entregado', 'devolucion']

function buildLookupCodeSet(rawCodes = []) {
  const codes = new Set()
  rawCodes.filter(Boolean).forEach((rawCode) => {
    const normalized = normalizeCodeFast(rawCode)
    if (!normalized) return
    generateCodeVariations(normalized, false).forEach((variant) => codes.add(variant))
  })
  return codes
}

// Same coverage as buildLookupCodeSet, but keeps which field each code variant came
// from — needed to tell "matched by the new label already" (logisticsTrackNo) apart
// from every other match for the relabel gate.
function buildLookupFieldMap(fieldSources = []) {
  const map = new Map()
  fieldSources.forEach(([field, rawCode]) => {
    if (!rawCode) return
    const normalized = normalizeCodeFast(rawCode)
    if (!normalized) return
    generateCodeVariations(normalized, false).forEach((variant) => {
      if (!map.has(variant)) map.set(variant, field)
    })
  })
  return map
}

// ── Validation panel (per order) ─────────────────────────────────────────────
function ValidationPanel({ order, folioId, onUpdate, canEdit, onAutoConfirm, onClose, validarPorTarimas, validarEtiquetado, detailCache }) {
  const { addToast } = useToastStore()
  const { t } = useI18nStore()
  const scanRef = useRef(null)
  const [orderDetail, setOrderDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [currentTarimaNum, setCurrentTarimaNum] = useState(1)
  const [pendingOfflineScans, setPendingOfflineScans] = useState([])
  const [forceModal, setForceModal] = useState({ open: false, code: '' })
  // Two-scan relabel flow — same shape and flow as ValidarPorDestino's pendingRelabel.
  const [pendingRelabel, setPendingRelabel] = useState(null)
  // SKU gate — same shape and flow as ValidarPorDestino's pendingSku.
  const [pendingSku, setPendingSku] = useState(null)
  const pendingOnlineRef = useRef(new Set())
  const isOffline = useOfflineStore((s) => s.status === 'offline')

  const scans = order.scans ?? []
  // SKU-cascade scans document a box already counted right before them — never a
  // box of their own, so every "cajas" count below excludes them.
  const boxScans = useMemo(() => scans.filter(s => !s.es_sku), [scans])

  // Relabel and SKU are separate scan records for the same physical box when both
  // apply — this cross-references them so either row can show both icons instead of
  // only the one it recorded itself.
  const relabelSkuLinks = useMemo(() => {
    const relabelKeys = new Set() // codigo_caja for reetiquetado rows
    const skuByPrevio = new Map() // codigo_caja_previo -> sku code
    scans.forEach(s => {
      if (s.reetiquetado) relabelKeys.add(s.codigo_caja)
      if (s.es_sku && s.codigo_caja_previo) skuByPrevio.set(s.codigo_caja_previo, s.codigo_caja)
    })
    return { relabelKeys, skuByPrevio }
  }, [scans])

  useEffect(() => {
    if (!validarPorTarimas) { setCurrentTarimaNum(1); return }
    const refs = scans.map(s => s.tarima_ref).filter(Boolean)
    if (refs.length === 0) { setCurrentTarimaNum(1); return }
    const max = Math.max(...refs.map(r => parseInt(r.replace('T', '')) || 0))
    setCurrentTarimaNum(max > 0 ? max : 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, validarPorTarimas])

  const currentTarimaRef = validarPorTarimas
    ? 'T' + String(currentTarimaNum).padStart(2, '0')
    : null

  useEffect(() => {
    setCompleted(false)
    const cached = detailCache?.current?.get(order.outbound_order_no)
    if (cached !== undefined) {
      setOrderDetail(cached)
      setDetailLoading(false)
      return
    }
    let cancelled = false
    if (!order.outbound_order_no) {
      setOrderDetail(null)
      setDetailLoading(false)
      return () => { cancelled = true }
    }
    setDetailLoading(true)
    getOutboundDetail(order.outbound_order_no)
      .then((detail) => {
        if (cancelled) return
        const resolved = detail?.data ?? null
        setOrderDetail(resolved)
        if (detailCache?.current) detailCache.current.set(order.outbound_order_no, resolved)
      })
      .catch(() => {
        if (!cancelled) setOrderDetail(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.outbound_order_no])

  useEffect(() => {
    if (!canEdit || completed) return
    // The panel expands inside the orders table, so on a phone the scan field can
    // open below the fold. Center it before focusing so the operator sees where
    // the PDA is typing.
    const timer = setTimeout(() => {
      scanRef.current?.focus()
      scanRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, canEdit, completed])

  // Built once per order detail instead of on every shot: a PDA burst on a large
  // order was regenerating the whole variant set per scan.
  // Accept any of the identifiers that reference this order: per-box customize code,
  // the order-level logisticsTrackNo (NEW label — "货件追踪码/Reference ID") or
  // thirdOrderNo (OLD label — "Reference order No._参考单号"), or the OBC order number
  // itself. allCustomizeCodes is spread defensively for callers that pass an
  // aggregated order; getOutboundDetail already lists every box in packageList.
  // The map form (field per code) drives the relabel gate below; validCodes stays a
  // flat Set for the existing "known code at all?" check.
  const validCodeFields = useMemo(() => {
    if (!orderDetail) return new Map()
    const fieldSources = []
    ;(orderDetail.packageList ?? orderDetail.outboundBoxList ?? []).forEach((p) => {
      fieldSources.push(['customizeCode', p.customizeCode], ['boxType', p.boxType], ['customizeCode', p.boxCode])
    })
    fieldSources.push(
      ['thirdOrderNo', orderDetail.thirdOrderNo],
      ['logisticsTrackNo', orderDetail.logisticsTrackNo],
      ['fbaShipmentId', orderDetail.fbaShipmentId],
      ['outboundOrderNo', orderDetail.outboundOrderNo],
      ...((orderDetail.allCustomizeCodes ?? []).map(c => ['customizeCode', c])),
      ...(orderNeedsProductLabel(orderDetail) ? productSkuCandidates(orderDetail).map(c => ['productSku', c]) : []),
    )
    return buildLookupFieldMap(fieldSources)
  }, [orderDetail])

  const validCodes = useMemo(() => {
    if (!orderDetail) return new Set()
    const rawCodes = []
    ;(orderDetail.packageList ?? orderDetail.outboundBoxList ?? []).forEach((p) => {
      rawCodes.push(p.customizeCode, p.boxType, p.boxCode)
    })
    rawCodes.push(
      orderDetail.thirdOrderNo,
      orderDetail.logisticsTrackNo,
      orderDetail.fbaShipmentId,
      orderDetail.outboundOrderNo,
      ...(orderDetail.allCustomizeCodes ?? []),
      ...(orderNeedsProductLabel(orderDetail) ? productSkuCandidates(orderDetail) : []),
    )
    return buildLookupCodeSet(rawCodes)
  }, [orderDetail])

  const alreadyScanned = useMemo(() => {
    const scanned = new Set()
    scans.forEach((s) => {
      const normalized = normalizeCodeFast(s.codigo_caja)
      if (!normalized) return
      generateCodeVariations(normalized, false).forEach((variant) => scanned.add(variant))
    })
    return scanned
  }, [scans])
  const expected = Math.max(
    Number(order.bultos_esperados ?? orderDetail?.outboundBoxCount ?? order.bultos ?? 0),
    boxScans.length
  ) || null

  const { mutate: doAddScan, isPending: scanning } = useMutation({
    mutationFn: ({ code, tarimaRef, codigoCajaPrevio, reetiquetado, esSku }) => addOrderScan(folioId, order.id, {
      codigo_caja: code,
      tarima_ref: tarimaRef,
      ...(codigoCajaPrevio ? { codigo_caja_previo: codigoCajaPrevio, reetiquetado: !!reetiquetado, es_sku: !!esSku } : {}),
      ...(!codigoCajaPrevio && reetiquetado ? { reetiquetado: true } : {}),
    }),
    onSuccess: (data, { code }) => {
      pendingOnlineRef.current.delete(code)
      onUpdate(data)
      const updatedOrder = data?.orders?.find(o => o.id === order.id)
      // SKU-cascade scans document a box already counted right before them.
      const newScansCount = (updatedOrder?.scans ?? []).filter(s => !s.es_sku).length
      const baseExpectedCount = Number(order.bultos_esperados ?? orderDetail?.outboundBoxCount ?? order.bultos ?? 0)
      const expectedCount = Math.max(
        baseExpectedCount,
        newScansCount
      )
      if (expectedCount > 0 && newScansCount >= expectedCount) {
        setCompleted(true)
        onAutoConfirm({ bultos: newScansCount, estado: 'cargado' })
        playSound('complete')
        addToast(`Validación completa — ${newScansCount} cajas confirmadas`, 'success')
        setTimeout(() => onClose(), 2000)
      } else {
        playSound('success')
        scanRef.current?.focus()
      }
    },
    onError: (err, { code }) => {
      pendingOnlineRef.current.delete(code)
      playSound('error')
      addToast(err?.response?.data?.error || 'Error registrando escaneo', 'error')
      scanRef.current?.focus()
    },
  })

  const { mutate: doDeleteLast, isPending: deletingLast } = useMutation({
    mutationFn: () => deleteLastOrderScan(folioId, order.id),
    onSuccess: (data) => { onUpdate(data); setCompleted(false) },
    onError: (err) => addToast(err?.response?.data?.error || 'Error eliminando escaneo', 'error'),
  })

  const { mutate: doSetSku } = useMutation({
    mutationFn: ({ scanId, skuValor }) => setOrderScanSku(folioId, order.id, scanId, { sku_valor: skuValor }),
    onSuccess: (data) => { onUpdate(data) },
    onError: (err) => addToast(err?.response?.data?.error || 'Error registrando SKU', 'error'),
  })

  const cancelPendingRelabel = useCallback(() => {
    setPendingRelabel(null)
    setTimeout(() => scanRef.current?.focus(), 80)
  }, [])

  const cancelPendingSku = useCallback(() => {
    setPendingSku(null)
    setTimeout(() => scanRef.current?.focus(), 80)
  }, [])

  const handleScan = useCallback((rawInput) => {
    const code = normalizeScanCode(rawInput)
    if (!code) return

    // Second scan of a pending SKU request: this input must be the product's SKU
    // code, not a fresh box. Stored directly on the box's own scan record (never a
    // separate row) so it never touches duplicate detection or box counts.
    if (pendingSku) {
      if (!orderDetail || !matchesProductSku(orderDetail, code)) {
        playSound('error')
        addToast(t('desp.validar.destino.skuNoCoincide'), 'error')
        return
      }
      const alreadyUsed = scans.some(s => normalizeCodeFast(s.sku_valor || '') === code)
      if (alreadyUsed) {
        playSound('duplicate')
        addToast('Código ya escaneado en esta orden', 'warning')
        return
      }
      scanRef.current?.focus()
      if (pendingSku.scanId) {
        doSetSku({ scanId: pendingSku.scanId, skuValor: code })
      } else if (isOffline) {
        // The box scan itself is still queued offline (no server id yet) — fall
        // back to the legacy cascaded record so the SKU isn't lost.
        useOfflineStore.getState().enqueueModule({
          type: 'despacho_order_scan',
          payload: {
            folioId, orderId: order.id, codigo_caja: code, tarima_ref: currentTarimaRef,
            codigo_caja_previo: pendingSku.rawCode, es_sku: true,
          },
        })
        setPendingOfflineScans(p => [...p, code])
        addToast(`Offline: ${code} — se enviará al recuperar conexión`, 'info')
      }
      setPendingSku(null)
      return
    }

    // Second scan of a pending relabel: this input is now dedicated to matching the
    // new-label code, not to picking up a fresh box.
    if (pendingRelabel) {
      const scannedBase = extractBaseCode(code) || code
      if (!scannedBase || scannedBase !== pendingRelabel.expectedNewBase) {
        playSound('error')
        addToast(t('desp.validar.destino.etiquetaNoCoincide'), 'error')
        return
      }
      const allScannedCodes = new Set([...Array.from(alreadyScanned), ...pendingOfflineScans])
      if (allScannedCodes.has(code) || pendingOnlineRef.current.has(code)) {
        playSound('duplicate')
        addToast('Código ya escaneado en esta orden', 'warning')
        return
      }
      scanRef.current?.focus()
      // The relabel scan just submitted is its own complete record. If this order
      // also still needs the SKU, chain straight into that request next instead of
      // making the operator scan a fresh box first.
      const skuAlreadySatisfied = orderDetail && scans.some(s => matchesProductSku(orderDetail, s.sku_valor || s.codigo_caja))
      const needsSkuNext = !!(orderDetail && orderNeedsProductLabel(orderDetail) && !skuAlreadySatisfied)
      if (isOffline) {
        useOfflineStore.getState().enqueueModule({
          type: 'despacho_order_scan',
          payload: {
            folioId, orderId: order.id, codigo_caja: code, tarima_ref: currentTarimaRef,
            codigo_caja_previo: pendingRelabel.rawCode, reetiquetado: true,
          },
        })
        setPendingOfflineScans(p => [...p, code])
        addToast(`Offline: ${code} — se enviará al recuperar conexión`, 'info')
        if (needsSkuNext) setPendingSku({ rawCode: code })
      } else {
        pendingOnlineRef.current.add(code)
        if (needsSkuNext) {
          doAddScan({ code, tarimaRef: currentTarimaRef, codigoCajaPrevio: pendingRelabel.rawCode, reetiquetado: true }, {
            onSuccess: (data) => {
              const updatedOrder = data?.orders?.find(o => o.id === order.id)
              const inserted = (updatedOrder?.scans ?? []).find(s => s.codigo_caja === code)
              setPendingSku({ rawCode: code, scanId: inserted?.id })
            },
          })
        } else {
          doAddScan({ code, tarimaRef: currentTarimaRef, codigoCajaPrevio: pendingRelabel.rawCode, reetiquetado: true })
        }
      }
      setPendingRelabel(null)
      return
    }

    const allScannedCodes = new Set([...Array.from(alreadyScanned), ...pendingOfflineScans])
    if (allScannedCodes.has(code) || pendingOnlineRef.current.has(code)) {
      playSound('duplicate')
      addToast('Código ya escaneado en esta orden', 'warning')
      scanRef.current?.focus()
      return
    }
    const codes = validCodes
    if (codes.size > 0 && !codes.has(code)) {
      setForceModal({ open: true, code })
      return
    }

    const matchedField = validCodeFields.get(code)

    // Relabel gate: checked first — a box that still needs its new label must get
    // that confirmed before anything else, including the SKU. Only when the folio
    // requires it, the match did NOT come from the new-label field itself
    // (logisticsTrackNo) or the product/SKU code, and the order actually needs
    // relabeling (old/new label bases differ). A box already scanned on its new
    // label passes straight through — there's nothing left to compare it against.
    if (validarEtiquetado && matchedField !== 'logisticsTrackNo' && matchedField !== 'productSku' && orderDetail && orderNeedsRelabel(orderDetail)) {
      setPendingRelabel({ rawCode: code, expectedNewBase: newLabelBase(orderDetail) })
      return
    }

    // A box scanned directly by its new-label code already satisfies the relabel
    // requirement in one step (no old-label prompt needed) — flag it the same as a
    // two-step relabel so the Validación icon shows it as done.
    const directNewLabelMatch = !!(
      validarEtiquetado && matchedField === 'logisticsTrackNo' && orderDetail && orderNeedsRelabel(orderDetail)
    )

    // SKU gate: the box scan itself is recorded as its own normal scan first — never
    // discarded — then this chains into asking for the SKU as a second, separate
    // record. Keeping the box's own code as a real scan (instead of replacing it
    // with the SKU) is what keeps a later duplicate scan of that same box caught.
    if (matchedField !== 'productSku' && orderDetail && orderNeedsProductLabel(orderDetail)) {
      const skuAlreadySatisfied = scans.some(s => matchesProductSku(orderDetail, s.sku_valor || s.codigo_caja))
      if (!skuAlreadySatisfied) {
        scanRef.current?.focus()
        if (isOffline) {
          useOfflineStore.getState().enqueueModule({
            type: 'despacho_order_scan',
            payload: { folioId, orderId: order.id, codigo_caja: code, tarima_ref: currentTarimaRef, ...(directNewLabelMatch ? { reetiquetado: true } : {}) },
          })
          setPendingOfflineScans(p => [...p, code])
          addToast(`Offline: ${code} — se enviará al recuperar conexión`, 'info')
          setPendingSku({ rawCode: code })
        } else {
          pendingOnlineRef.current.add(code)
          doAddScan({ code, tarimaRef: currentTarimaRef, reetiquetado: directNewLabelMatch }, {
            onSuccess: (data) => {
              const updatedOrder = data?.orders?.find(o => o.id === order.id)
              const inserted = (updatedOrder?.scans ?? []).find(s => s.codigo_caja === code)
              setPendingSku({ rawCode: code, scanId: inserted?.id })
            },
          })
        }
        return
      }
    }

    scanRef.current?.focus()
    if (isOffline) {
      useOfflineStore.getState().enqueueModule({
        type: 'despacho_order_scan',
        payload: { folioId, orderId: order.id, codigo_caja: code, tarima_ref: currentTarimaRef, ...(directNewLabelMatch ? { reetiquetado: true } : {}) },
      })
      setPendingOfflineScans(p => [...p, code])
      addToast(`Offline: ${code} — se enviará al recuperar conexión`, 'info')
      return
    }
    pendingOnlineRef.current.add(code)
    doAddScan({ code, tarimaRef: currentTarimaRef, reetiquetado: directNewLabelMatch })
  }, [pendingSku, pendingRelabel, scans, validCodes, validCodeFields, validarEtiquetado, orderDetail, alreadyScanned, pendingOfflineScans, isOffline, doAddScan, addToast, folioId, order.id, currentTarimaRef, t])

  const pct = expected && expected > 0 ? Math.round((boxScans.length / expected) * 100) : null

  const scansByTarima = useMemo(() => (
    validarPorTarimas
      ? scans.reduce((acc, s) => {
          const key = s.tarima_ref || '__none'
          if (!acc[key]) acc[key] = []
          acc[key].push(s)
          return acc
        }, {})
      : null
  ), [scans, validarPorTarimas])

  const handleForceAccept = () => {
    const code = forceModal.code
    setForceModal({ open: false, code: '' })
    if (!code) return
    pendingOnlineRef.current.add(code)
    doAddScan({ code, tarimaRef: currentTarimaRef })
    setTimeout(() => scanRef.current?.focus(), 100)
  }

  const closeForceModal = () => {
    setForceModal({ open: false, code: '' })
    setTimeout(() => scanRef.current?.focus(), 100)
  }

  if (completed) {
    return (
      <div className="bg-success-50 border-t border-success-100 px-5 py-6 flex flex-col items-center gap-2">
        <CheckCircle2 className="w-8 h-8 text-success-500" />
        <p className="text-sm font-bold text-success-700">{t('desp.validar.orden.valCompleta')}</p>
        <p className="text-xs text-success-600 tabular-nums">
          {boxScans.length} caja{boxScans.length !== 1 ? 's' : ''} confirmada{boxScans.length !== 1 ? 's' : ''} — orden marcada como Cargada
        </p>
      </div>
    )
  }

  return (
    <>
    <Modal
      isOpen={forceModal.open}
      onClose={closeForceModal}
      title={t('desp.validar.unrecognizedCodeTitle')}
      icon={AlertCircle}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={closeForceModal} className="btn-secondary text-sm">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleForceAccept}
            disabled={scanning}
            className="btn-danger text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {scanning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Forzar en esta orden
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-warm-700">
          Este código no está en la lista de paquetes esperados para esta orden. Puedes forzar su ingreso o cancelar.
        </p>
        <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-danger-500">Código escaneado</p>
          <p className="font-mono text-sm font-bold text-danger-800 break-all">{forceModal.code}</p>
        </div>
        <div className="rounded-xl border border-warm-200 bg-warm-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-warm-500">Orden</p>
          <p className="font-mono text-xs font-semibold text-warm-700">{order.outbound_order_no}</p>
        </div>
        <p className="text-xs text-warm-400">
          El ingreso forzado queda registrado y puede requerir conciliación manual.
        </p>
      </div>
    </Modal>
      <div className="bg-primary-50/60 border-t border-primary-100 px-3 sm:px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-semibold text-primary-700">Validación · {order.outbound_order_no}</span>
          {detailLoading && <Loader2 className="w-3 h-3 animate-spin text-primary-400" />}
          {validarPorTarimas && currentTarimaRef && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 border border-accent-200 text-[11px] font-bold text-accent-700">
              <Layers className="w-3 h-3" />{currentTarimaRef}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {validarPorTarimas && canEdit && (
            <button
              type="button"
              onClick={() => setCurrentTarimaNum(n => n + 1)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-accent-300 bg-accent-50 text-accent-700 text-[11px] font-semibold hover:bg-accent-100 transition-colors"
            >
              <Layers className="w-3 h-3" />{t('desp.validar.destino.sigTarima')}
            </button>
          )}
          <div className="flex items-center gap-3 text-xs text-primary-600">
            <span className="font-bold tabular-nums">
              {boxScans.length}/{expected ?? '?'}{pct !== null ? ` · ${pct}%` : ''}
            </span>
            {pct !== null && (
              <div className="w-24 h-1.5 bg-primary-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success-500' : 'bg-primary-500'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingRelabel && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-warning-300 bg-warning-50 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-warning-600 shrink-0" />
          <p className="min-w-0 flex-1 text-xs font-bold text-warning-800">{t('desp.validar.destino.esperandoEtiquetaNueva')}</p>
          <button
            type="button"
            onClick={cancelPendingRelabel}
            className="shrink-0 inline-flex h-8 items-center gap-1 rounded-lg border border-warning-300 bg-white px-2.5 text-[11px] font-semibold text-warning-700 hover:bg-warning-100 transition-colors"
          >
            <X className="w-3 h-3" />{t('common.cancel')}
          </button>
        </div>
      )}

      {pendingSku && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-accent-300 bg-accent-50 px-3 py-2.5">
          <Barcode className="w-4 h-4 text-accent-600 shrink-0" />
          <p className="min-w-0 flex-1 text-xs font-bold text-accent-800">{t('desp.validar.destino.solicitarSku')}</p>
          <button
            type="button"
            onClick={cancelPendingSku}
            className="shrink-0 inline-flex h-8 items-center gap-1 rounded-lg border border-accent-300 bg-white px-2.5 text-[11px] font-semibold text-accent-700 hover:bg-accent-100 transition-colors"
          >
            <X className="w-3 h-3" />{t('common.cancel')}
          </button>
        </div>
      )}

      {canEdit && (
        <div className="mb-3 space-y-2">
          <ScanInputBar
            inputRef={scanRef}
            onSubmit={handleScan}
            placeholder={pendingSku ? t('desp.validar.destino.ingresaSkuPlaceholder') : (detailLoading ? 'Cargando datos WMS...' : t('desp.validar.orden.scanPlaceholderPanel'))}
            loading={scanning}
            badge={pendingSku ? { icon: <Barcode className="h-3 w-3" />, label: t('desp.validar.destino.escanearSku'), code: `${t('desp.validar.destino.cajaLabel')}: ${pendingSku.rawCode}` } : null}
            buttonLabel={t('desp.validar.orden.validarBtn')}
          />
          {scans.length > 0 && (
            <button onClick={() => doDeleteLast()} disabled={deletingLast}
              className="btn-ghost text-xs flex w-full items-center justify-center gap-1.5 h-10 px-3 text-danger-600 hover:bg-danger-50 border border-danger-200 sm:w-auto">
              {deletingLast ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {t('desp.validar.orden.borrarUltimo')}
            </button>
          )}
        </div>
      )}

      {isOffline && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Offline — escaneos guardados localmente
          {pendingOfflineScans.length > 0 && <span className="ml-auto font-bold">{pendingOfflineScans.length} pendientes</span>}
        </div>
      )}

      {!detailLoading && orderDetail && !orderDetail.packageList?.length && (
        <p className="text-[11px] text-warm-400 mb-2">{t('desp.validar.orden.sinDetalle')}</p>
      )}

      {!detailLoading && !orderDetail && (
        <div className="mb-2 rounded-xl border border-warm-100 bg-warm-50 px-3 py-2 text-[11px] text-warm-500">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-mono font-semibold text-warm-700">{order.outbound_order_no}</span>
            {order.destinatario ? <span>{order.destinatario}</span> : null}
            {order.bultos_esperados != null ? <span>{t('desp.validar.destino.esperadas')}: {order.bultos_esperados}</span> : null}
            {order.bultos != null ? <span>{t('desp.validar.destino.escaneadas')}: {order.bultos}</span> : null}
          </div>
        </div>
      )}

      {pendingOfflineScans.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {pendingOfflineScans.map((code, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs bg-amber-50 border border-amber-200">
              <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="font-mono text-amber-700 font-medium">{code}</span>
              <span className="ml-auto text-amber-500 text-[10px]">pendiente</span>
            </div>
          ))}
        </div>
      )}

      {scans.length > 0 ? (
        validarPorTarimas && scansByTarima ? (
          <div className="space-y-2">
            {Object.entries(scansByTarima).map(([tarima, tarScans]) => (
              <div key={tarima}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <Layers className="w-3 h-3 text-accent-500 shrink-0" />
                  <span className="text-[11px] font-bold text-accent-700">{tarima === '__none' ? t('desp.validar.destino.sinOrden') : tarima}</span>
                  <span className="text-[10px] text-warm-400">({tarScans.length} caja{tarScans.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="space-y-0.5">
                  {[...tarScans]
                    .sort((a, b) => new Date(a.validated_at || a.created_at || 0) - new Date(b.validated_at || b.created_at || 0))
                    .map((s, scanIndex) => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs bg-accent-50/40 border border-accent-100/50">
                      <span className="w-5 text-right text-[10px] font-black tabular-nums text-accent-600 shrink-0">{scanIndex + 1}</span>
                      <Check className="w-3 h-3 text-success-500 shrink-0" />
                      {s.es_sku ? (
                        <span className="flex-1 font-mono font-semibold">
                          <span className="text-warm-800">{s.codigo_caja_previo || 'SKU'}</span>
                          <span className="text-warm-300 mx-1">·</span>
                          <span className="text-success-700">SKU: {s.codigo_caja}</span>
                        </span>
                      ) : (
                        <span className="flex-1 font-mono font-semibold">
                          <span className="text-warm-800">{s.codigo_caja}</span>
                          {s.sku_valor && (
                            <>
                              <span className="text-warm-300 mx-1">·</span>
                              <span className="text-success-700">SKU: {s.sku_valor}</span>
                            </>
                          )}
                        </span>
                      )}
                      {(s.reetiquetado || (s.es_sku && relabelSkuLinks.relabelKeys.has(s.codigo_caja_previo))) && (
                        <span className="badge bg-success-100 text-success-700 text-[9px] font-semibold">
                          {t('desp.validar.destino.reetiquetada')}
                        </span>
                      )}
                      {(s.es_sku || s.sku_valor || (s.reetiquetado && relabelSkuLinks.skuByPrevio.has(s.codigo_caja))) && (
                        <span className="badge bg-success-100 text-success-700 text-[9px] font-semibold">SKU</span>
                      )}
                      <span className="hidden sm:inline text-warm-400">{s.validated_by_nombre || '—'}</span>
                      <span className="text-warm-400 tabular-nums">{fmtDateTime(s.validated_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {[...scans]
              .sort((a, b) => new Date(a.validated_at || a.created_at || 0) - new Date(b.validated_at || b.created_at || 0))
              .map((s, i) => (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                i === scans.length - 1 ? 'bg-white border border-primary-100' : 'bg-transparent'
              }`}>
                <span className="w-5 text-right text-[10px] font-black tabular-nums text-primary-500 shrink-0">{i + 1}</span>
                <Check className="w-3 h-3 text-success-500 shrink-0" />
                {s.es_sku ? (
                  <span className="flex-1 font-mono font-semibold">
                    <span className="text-warm-800">{s.codigo_caja_previo || 'SKU'}</span>
                    <span className="text-warm-300 mx-1">·</span>
                    <span className="text-success-700">SKU: {s.codigo_caja}</span>
                  </span>
                ) : (
                  <span className="flex-1 font-mono font-semibold">
                    <span className="text-warm-800">{s.codigo_caja}</span>
                    {s.sku_valor && (
                      <>
                        <span className="text-warm-300 mx-1">·</span>
                        <span className="text-success-700">SKU: {s.sku_valor}</span>
                      </>
                    )}
                  </span>
                )}
                {(s.reetiquetado || (s.es_sku && relabelSkuLinks.relabelKeys.has(s.codigo_caja_previo))) && (
                  <span className="badge bg-success-100 text-success-700 text-[9px] font-semibold">
                    {t('desp.validar.destino.reetiquetada')}
                  </span>
                )}
                {(s.es_sku || s.sku_valor || (s.reetiquetado && relabelSkuLinks.skuByPrevio.has(s.codigo_caja))) && (
                  <span className="badge bg-success-100 text-success-700 text-[9px] font-semibold">SKU</span>
                )}
                <span className="hidden sm:inline text-warm-400">{s.validated_by_nombre || '—'}</span>
                <span className="text-warm-400 tabular-nums">{fmtDateTime(s.validated_at)}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        !detailLoading && <p className="text-xs text-primary-500/70">{t('desp.validar.orden.sinEscaneos')}</p>
      )}
    </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ValidarPorOrden({ folioId }) {
  const navigate = useNavigate()
  const { addToast } = useToastStore()
  const { t } = useI18nStore()
  const { canWrite, canDelete } = useAuthStore()
  const canUpdate = useAuthStore(s => {
    const lvl = s.getPermissionLevel('despacho.folios')
    return lvl === 'actualizar' || lvl === 'eliminar'
  })
  const qc = useQueryClient()
  const detailCacheRef = useRef(new Map())

  // Add-order state
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState(null)
  const [addForm, setAddForm] = useState({ outbound_order_no: '', destinatario: '', bultos: '', bultos_esperados: null, notas: '' })
  const lookupRef = useRef(null)
  const inlineScanRef = useRef(null)
  const pendingOrderNoRef = useRef(null)
  const pendingScansRef = useRef([])
  const autoValidateRef = useRef(false)
  const [autoValidate, setAutoValidate] = useState(false)
  const [localScans, setLocalScans] = useState([])
  const [lookupDetail, setLookupDetail] = useState(null)
  const [validatingOrderId, setValidatingOrderId] = useState(null)
  const [showConfirmCancel, setShowConfirmCancel] = useState(false)
  const [showConfirmCerrar, setShowConfirmCerrar] = useState(false)
  const [folioCerradoNum, setFolioCerradoNum] = useState(null)
  const isOfflineMain = useOfflineStore((s) => s.status === 'offline')

  useEffect(() => {
    const handler = () => initAudio()
    document.addEventListener('click', handler, { once: true })
    return () => document.removeEventListener('click', handler)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['despacho-folio', folioId],
    queryFn: () => getFolio(folioId),
    enabled: !!folioId,
    staleTime: 30_000,
  })

  const folio = data?.folio
  const orders = data?.orders ?? []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['despacho-folio', folioId] })
    qc.invalidateQueries({ queryKey: ['despacho-folios'] })
  }

  const applyUpdate = useCallback((freshData) => {
    if (freshData?.folio || freshData?.orders) {
      qc.setQueryData(['despacho-folio', folioId], freshData)
    }
  }, [qc, folioId])

  const { mutate: doCerrar, isPending: cerrando } = useMutation({
    mutationFn: () => cerrarFolio(folioId),
    onSuccess: () => {
      playSound('complete')
      invalidate()
      setShowConfirmCerrar(false)
      setFolioCerradoNum(folio?.folio_numero ?? folio?.folio ?? folioId)
    },
    onError: (err) => addToast(err?.response?.data?.error || 'Error cerrando folio', 'error'),
  })

  const { mutate: doCancelar, isPending: cancelando } = useMutation({
    mutationFn: () => cancelarFolio(folioId),
    onSuccess: () => { invalidate(); setShowConfirmCancel(false); addToast('Folio cancelado', 'success') },
    onError: (err) => addToast(err?.response?.data?.error || 'Error cancelando folio', 'error'),
  })

  const { mutate: doAddOrder, isPending: addingOrder } = useMutation({
    mutationFn: (body) => addOrder(folioId, body),
    onSuccess: async (respData) => {
      applyUpdate(respData)
      const newOrders = respData?.orders ?? []
      const addedOrder = newOrders.find(o => o.outbound_order_no === pendingOrderNoRef.current)
      if (addedOrder && pendingScansRef.current.length > 0) {
        let lastData = respData
        for (const code of pendingScansRef.current) {
          try { lastData = await addOrderScan(folioId, addedOrder.id, { codigo_caja: code }) } catch {}
        }
        applyUpdate(lastData)
        const expectedCount = Number(addedOrder.bultos_esperados)
        const scanned = pendingScansRef.current.length
        if (expectedCount > 0 && scanned >= expectedCount) {
          try { await updateOrder(folioId, addedOrder.id, { bultos: scanned, estado: 'cargado' }) } catch {}
          addToast(`Validación completa — ${scanned} cajas confirmadas`, 'success')
          invalidate()
        } else {
          if (autoValidateRef.current) setValidatingOrderId(addedOrder.id)
          invalidate()
        }
      } else if (addedOrder && autoValidateRef.current) {
        setValidatingOrderId(addedOrder.id)
      }
      setShowAddOrder(false)
      setLookupResult(null)
      setLookupDetail(null)
      setLocalScans([])
      setAddForm({ outbound_order_no: '', destinatario: '', bultos: '', bultos_esperados: null, notas: '' })
      addToast('Orden agregada', 'success')
    },
    onError: (err) => addToast(err?.response?.data?.error || 'Error agregando orden', 'error'),
  })

  const { mutate: doRemoveOrder } = useMutation({
    mutationFn: ({ orderId }) => removeOrder(folioId, orderId),
    onSuccess: (d) => { applyUpdate(d); addToast('Orden eliminada', 'success') },
    onError: (err) => addToast(err?.response?.data?.error || 'Error eliminando orden', 'error'),
  })

  const { mutate: doUpdateOrder } = useMutation({
    mutationFn: ({ orderId, body }) => updateOrder(folioId, orderId, body),
    onSuccess: (d) => applyUpdate(d),
    onError: (err) => addToast(err?.response?.data?.error || 'Error actualizando orden', 'error'),
  })

  const isActive = folio && ['borrador', 'en_proceso'].includes(folio.estado)
  const editable = !!isActive && canWrite('despacho.folios')
  const canCancelFolio = !!isActive && canUpdate
  const totalBultos = orders.reduce((s, o) => s + (o.bultos || 0), 0)
  const primaryDestinatario = orders.find(o => o.destinatario)?.destinatario ?? null

  const addOrderNo = addForm.outbound_order_no.trim()
  const isDuplicateInFolio = !!addOrderNo && orders.some(o => o.outbound_order_no === addOrderNo)

  const handleLookup = useCallback(async (code) => {
    const raw = String(code || '').trim()
    if (!raw) return
    const q = normalizeScanCode(raw)
    setLookupLoading(true)
    setLookupResult(null)
    try {
      let found = null
      for (const variant of generateCodeVariations(q, false)) {
        // Try scanner-safe variants so slash/dash mismatches behave like Surtido.
        found = await findOrderByBarcode(variant)
        if (found) break
      }
      if (found) {
        const detail = await getOutboundDetail(found.outboundOrderNo || q)
        const boxCount = detail?.data?.outboundBoxCount || found.outboundBoxCount || null
        const enriched = { ...found, outboundBoxCount: boxCount }
        setLookupResult(enriched)
        setLookupDetail(detail?.data ?? null)
        setAddForm({
          outbound_order_no: enriched.outboundOrderNo || q,
          destinatario: enriched.receiverName || enriched.logisticsChannel || '',
          bultos: '',
          bultos_esperados: boxCount,
          notas: '',
        })
      } else {
        addToast('Orden no encontrada en hojas — completa manualmente', 'warning')
        setAddForm(f => ({ ...f, outbound_order_no: raw }))
      }
    } finally {
      setLookupLoading(false)
    }
  }, [addToast])

  const openAddOrder = () => {
    setShowAddOrder(true)
    setLookupResult(null)
    setLookupDetail(null)
    setLocalScans([])
    setAutoValidate(false)
    autoValidateRef.current = false
    setAddForm({ outbound_order_no: '', destinatario: '', bultos: '', bultos_esperados: null, notas: '' })
    setTimeout(() => lookupRef.current?.focus(), 100)
  }

  const handleInlineScan = useCallback((rawInput) => {
    const code = normalizeScanCode(rawInput)
    if (!code) return
    const alreadyScanned = new Set()
    localScans.forEach((localCode) => {
      generateCodeVariations(localCode, false).forEach((variant) => alreadyScanned.add(variant))
    })
    if (alreadyScanned.has(code)) {
      addToast('Código ya escaneado', 'warning')
      inlineScanRef.current?.focus()
      return
    }
    if (lookupDetail) {
      const rawCodes = []
      ;(lookupDetail.packageList ?? lookupDetail.outboundBoxList ?? []).forEach(p => {
        rawCodes.push(p.customizeCode, p.boxType, p.boxCode)
      })
      rawCodes.push(
        lookupDetail.thirdOrderNo,
        lookupDetail.logisticsTrackNo,
        lookupDetail.outboundOrderNo,
        ...(lookupDetail.allCustomizeCodes ?? []),
      )
      const codes = buildLookupCodeSet(rawCodes)
      if (codes.size > 0 && !codes.has(code)) {
        playSound('error')
        addToast('Código no corresponde a esta orden — rechazado', 'error')
        inlineScanRef.current?.focus()
        return
      }
    }
    playSound('success')
    setLocalScans(prev => [...prev, code])
    inlineScanRef.current?.focus()
  }, [localScans, lookupDetail, addToast])

  const handleConfirmAdd = () => {
    pendingOrderNoRef.current = addForm.outbound_order_no
    if (autoValidateRef.current && localScans.length > 0) {
      pendingScansRef.current = [...localScans]
      doAddOrder({ ...addForm, bultos: localScans.length })
    } else {
      pendingScansRef.current = []
      doAddOrder({ ...addForm, bultos: parseInt(addForm.bultos) || 0 })
    }
  }

  if (isLoading && !isOfflineMain) {
    return <div className="flex justify-center py-16"><LoadingSpinner /></div>
  }

  if (isOfflineMain && !data) {
    return <OfflineBlockedModal isBlocked message="Los datos del folio no han sido cargados. Restablece la conexión para continuar." />
  }

  if (folioCerradoNum) {
    return (
      <div className="flex flex-col min-h-[60vh] items-center justify-center gap-6 bg-warm-50/40 rounded-2xl px-6 py-12">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-success-100 text-success-600">
          <PartyPopper className="w-10 h-10" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-warm-800 mb-1">{t('desp.validar.folioCerrado.title')}</p>
          <p className="text-sm text-warm-500">
            El folio <span className="font-mono font-semibold text-warm-700">{folioCerradoNum}</span> ha sido cerrado y registrado.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/despacho/validar')}
            className="btn-primary flex items-center gap-2 px-6 py-2.5">
            <Plus className="w-4 h-4" />
            {t('desp.validar.folioCerrado.nuevaValidacion')}
          </button>
          <button
            onClick={() => navigate(`/despacho/folios/${folioId}`)}
            className="btn-secondary flex items-center gap-2 px-6 py-2.5">
            <ExternalLink className="w-4 h-4" />
            {t('desp.validar.folioCerrado.verFolio')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Orders block */}
      <div className="bg-white rounded-2xl border border-warm-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-warm-100 flex-wrap">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
            <h3 className="text-sm font-semibold text-warm-800 shrink-0">{t('desp.validar.orden.ordenesAsignadas')}</h3>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 text-primary-700 text-xs font-bold shrink-0">
              {orders.length}
            </span>
            {orders.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warm-200 bg-warm-50 px-2.5 py-0.5 text-xs font-bold text-warm-800">
                {totalBultos} {t('desp.validar.orden.cajas')}
              </span>
            )}
            {primaryDestinatario && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 max-w-[180px] truncate">
                <MapPin className="w-3 h-3 shrink-0" />{primaryDestinatario}
              </span>
            )}
          </div>
          <div className="flex w-full items-center gap-2 shrink-0 sm:w-auto">
            {editable && (
              <button
                onClick={showAddOrder ? () => { setShowAddOrder(false); setLookupResult(null) } : openAddOrder}
                className="btn-primary text-xs flex flex-1 items-center justify-center gap-1.5 h-9 sm:h-8 sm:flex-none">
                {showAddOrder ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showAddOrder ? t('desp.validar.orden.cerrar') : t('desp.validar.orden.agregarOrden')}
              </button>
            )}
            {folio?.estado === 'en_proceso' && canWrite('despacho.folios') && (
              <button onClick={() => setShowConfirmCerrar(true)} disabled={cerrando}
                className="btn-success text-xs flex flex-1 items-center justify-center gap-1.5 h-9 sm:h-8 sm:flex-none">
                {cerrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {t('desp.validar.orden.cerrarFolio')}
              </button>
            )}
            {canCancelFolio && (
              <button onClick={() => setShowConfirmCancel(true)} disabled={cancelando}
                className="btn-danger text-xs flex items-center justify-center gap-1.5 h-9 px-3 sm:h-8">
                <XCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('desp.validar.orden.cancelar')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Add order panel */}
        <AnimatePresence>
          {showAddOrder && editable && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-primary-50/60 px-6 py-5 border-b border-primary-100">
                <p className="text-xs font-semibold text-primary-700 mb-3">{t('desp.validar.orden.buscarOrden')}</p>
                <div className="mb-4">
                  <ScanInputBar
                    inputRef={lookupRef}
                    onSubmit={handleLookup}
                    placeholder={t('desp.validar.orden.scanPlaceholderLookup')}
                    loading={lookupLoading}
                    buttonLabel={t('desp.validar.orden.buscar')}
                  />
                </div>

                {lookupResult ? (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border border-primary-100 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <PackageCheck className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-primary-700 text-sm">{lookupResult.outboundOrderNo}</span>
                            {lookupResult.status && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warm-100 text-warm-600 capitalize">
                                {lookupResult.status}
                              </span>
                            )}
                          </div>
                          {lookupResult.receiverName && (
                            <p className="text-xs text-warm-700 font-medium mt-0.5">{lookupResult.receiverName}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {lookupResult.logisticsChannel && (
                              <span className="text-[10px] bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full font-medium">{lookupResult.logisticsChannel}</span>
                            )}
                            {lookupResult.logisticsTrackNo && (
                              <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-mono">{lookupResult.logisticsTrackNo}</span>
                            )}
                            {lookupResult.thirdOrderNo && (
                              <span className="text-[10px] bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full font-mono">Ref: {lookupResult.thirdOrderNo}</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-stretch gap-3 text-right">
                          <div>
                            <p className="text-[9px] text-warm-400 uppercase tracking-wider font-semibold mb-0.5">Esperadas</p>
                            <p className="text-sm font-bold text-warm-800 tabular-nums">{lookupResult.outboundBoxCount ?? '—'}</p>
                          </div>
                          <div className="w-px bg-warm-100" />
                          <div>
                            <p className="text-[9px] text-warm-400 uppercase tracking-wider font-semibold mb-0.5">Validadas</p>
                            <p className={`text-sm font-bold tabular-nums ${localScans.length > 0 ? 'text-success-600' : 'text-warm-300'}`}>
                              {localScans.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isDuplicateInFolio && (
                      <div className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-danger-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-semibold text-danger-700">{t('desp.validar.orden.duplicadoFolio')}</p>
                          <p className="text-[11px] text-danger-600 leading-snug">
                            <span className="font-mono font-semibold">{addOrderNo}</span> {t('desp.validar.orden.duplicadoFolioDesc')}
                          </p>
                        </div>
                      </div>
                    )}

                    {primaryDestinatario && addForm.destinatario && addForm.destinatario !== primaryDestinatario && (
                      <div className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-warning-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-semibold text-warning-700">{t('desp.validar.orden.destDiferente')}</p>
                          <div className="flex flex-col gap-0.5 text-[11px] text-warning-600">
                            <span><span className="font-semibold">Folio:</span> {primaryDestinatario}</span>
                            <span><span className="font-semibold">Esta orden:</span> {addForm.destinatario}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-warm-600 shrink-0">
                        {t('desp.validar.orden.cantDespachar')} {!autoValidate && '*'}
                      </label>
                      <input
                        type="number" min="1"
                        value={autoValidate ? (localScans.length > 0 ? localScans.length : '') : addForm.bultos}
                        onChange={e => !autoValidate && setAddForm(f => ({ ...f, bultos: e.target.value }))}
                        disabled={autoValidate}
                        className={`input-field w-20 text-sm ${autoValidate ? 'bg-warm-50 text-warm-400 cursor-not-allowed' : ''}`}
                        placeholder={autoValidate ? 'Auto' : '0'}
                        autoFocus={!autoValidate}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = !autoValidate
                          setAutoValidate(next)
                          autoValidateRef.current = next
                          if (next) setTimeout(() => inlineScanRef.current?.focus(), 200)
                        }}
                        className={`h-10 flex items-center gap-2 px-3 rounded-xl border transition-all text-xs font-semibold shrink-0 ${
                          autoValidate
                            ? 'bg-primary-50 border-primary-300 text-primary-700'
                            : 'bg-warm-50 border-warm-200 text-warm-500 hover:border-warm-300 hover:text-warm-700'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>{autoValidate ? t('desp.validar.orden.validarActiva') : t('desp.validar.orden.validarDetalle')}</span>
                        <div className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors shrink-0 ${
                          autoValidate ? 'bg-primary-500' : 'bg-warm-300'
                        }`}>
                          <span className={`inline-block w-4 h-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            autoValidate ? 'translate-x-[22px]' : 'translate-x-[2px]'
                          }`} />
                        </div>
                      </button>
                    </div>

                    <AnimatePresence>
                      {autoValidate && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-white border border-primary-100 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <ScanLine className="w-3.5 h-3.5 text-primary-600" />
                                <span className="text-xs font-semibold text-primary-700">{t('desp.validar.orden.validacionDetalle')}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {[
                                  { label: t('desp.validar.destino.esperadas'), value: lookupResult.outboundBoxCount ?? '—', cls: 'text-warm-700' },
                                  { label: t('desp.validar.destino.escaneadas'), value: localScans.length, cls: localScans.length > 0 ? 'text-success-600' : 'text-warm-400' },
                                  lookupResult.outboundBoxCount != null && {
                                    label: t('desp.validar.destino.pendientes'),
                                    value: Math.max(0, lookupResult.outboundBoxCount - localScans.length),
                                    cls: localScans.length >= lookupResult.outboundBoxCount ? 'text-success-600' : 'text-danger-500',
                                  },
                                ].filter(Boolean).map(({ label, value, cls }) => (
                                  <div key={label} className="text-center">
                                    <p className="text-[9px] font-semibold text-warm-400 uppercase tracking-wider">{label}</p>
                                    <p className={`text-sm font-bold tabular-nums ${cls}`}>{value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {lookupResult.outboundBoxCount > 0 && (
                              <div className="w-full h-1.5 bg-warm-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    localScans.length >= lookupResult.outboundBoxCount ? 'bg-success-500' : 'bg-primary-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (localScans.length / lookupResult.outboundBoxCount) * 100)}%` }}
                                />
                              </div>
                            )}
                            <div className="space-y-2">
                              <ScanInputBar
                                inputRef={inlineScanRef}
                                onSubmit={handleInlineScan}
                                placeholder={t('desp.validar.orden.scanPlaceholder')}
                                buttonLabel="OK"
                              />
                              {localScans.length > 0 && (
                                <button onClick={() => setLocalScans(prev => prev.slice(0, -1))}
                                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-danger-200 text-xs font-semibold text-danger-500 hover:bg-danger-50 transition-colors sm:w-auto sm:px-3">
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {t('desp.validar.orden.borrarUltimo')}
                                </button>
                              )}
                            </div>
                            {localScans.length > 0 ? (
                              <div className="space-y-1 max-h-36 overflow-y-auto">
                                {[...localScans].reverse().map((code, i) => (
                                  <div key={code} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                                    i === 0 ? 'bg-primary-50 border border-primary-100' : 'bg-transparent'
                                  }`}>
                                    <Check className="w-3 h-3 text-success-500 shrink-0" />
                                    <span className="font-mono font-semibold text-warm-800 flex-1">{code}</span>
                                    <span className="text-warm-400 tabular-nums">#{localScans.length - i}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-primary-400/70 text-center py-1">{t('desp.validar.orden.scanHint')}</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-semibold text-warm-600 mb-1.5">{t('desp.validar.orden.noOrden')} *</label>
                      <input value={addForm.outbound_order_no}
                        onChange={e => setAddForm(f => ({ ...f, outbound_order_no: e.target.value }))}
                        className="input-field w-full text-sm font-mono" placeholder="OBC-12345" />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-semibold text-warm-600 mb-1.5">{t('desp.validar.orden.destinatarioLabel')}</label>
                      <input value={addForm.destinatario}
                        onChange={e => setAddForm(f => ({ ...f, destinatario: e.target.value }))}
                        className="input-field w-full text-sm" placeholder="Receptor o canal..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-warm-600 mb-1.5">
                        Cant. a despachar
                        {addForm.bultos_esperados ? <span className="ml-1 font-normal text-warm-400">(esp: {addForm.bultos_esperados})</span> : null}
                      </label>
                      <input type="number" min="1" value={addForm.bultos}
                        onChange={e => setAddForm(f => ({ ...f, bultos: e.target.value }))}
                        className="input-field w-full text-sm" placeholder="Cantidad..." />
                    </div>
                  </div>
                )}

                {!lookupResult && isDuplicateInFolio && (
                  <div className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 mt-3">
                    <AlertCircle className="w-4 h-4 text-danger-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-danger-700">{t('desp.validar.orden.duplicadoFolio')}</p>
                      <p className="text-[11px] text-danger-600 leading-snug">
                        <span className="font-mono font-semibold">{addOrderNo}</span> {t('desp.validar.orden.duplicadoFolioDesc')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleConfirmAdd}
                    disabled={
                      addingOrder || isDuplicateInFolio || !addForm.outbound_order_no.trim() ||
                      (!autoValidate && (!String(addForm.bultos).trim() || parseInt(addForm.bultos) < 1))
                    }
                    className="btn-primary text-sm flex items-center gap-1.5">
                    {addingOrder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {autoValidate && localScans.length > 0
                      ? `${t('desp.validar.orden.confirmar')} (${localScans.length})`
                      : t('desp.validar.orden.confirmar')}
                  </button>
                  <button
                    onClick={() => { setShowAddOrder(false); setLookupResult(null); setLocalScans([]) }}
                    className="btn-secondary text-sm">{t('common.cancel')}</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orders table — secondary columns collapse below sm so a PDA sees the essentials */}
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-warm-50 sticky top-0 z-[5] border-b border-warm-100">
            <tr>
              <th className="table-header w-10"></th>
              <th className="table-header">{t('desp.validar.orden.col.orden')}</th>
              <th className="table-header hidden sm:table-cell">{t('desp.validar.orden.col.destinatario')}</th>
              <th className="table-header text-center">{t('desp.validar.orden.col.esperadas')}</th>
              <th className="table-header text-center hidden sm:table-cell">{t('desp.validar.orden.col.validadas')}</th>
              <th className="table-header text-center">{t('desp.validar.orden.col.despachadas')}</th>
              <th className="table-header hidden sm:table-cell">{t('desp.validar.orden.col.estado')}</th>
              {editable && <th className="table-header w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={editable ? 8 : 7} className="py-14 text-center text-warm-300 text-xs">
                  {t('desp.validar.orden.sinOrdenes')}
                </td>
              </tr>
            ) : orders.map((order) => (
              <Fragment key={order.id}>
                <motion.tr
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => editable && setValidatingOrderId(id => id === order.id ? null : order.id)}
                  className={`transition-colors group ${editable ? 'cursor-pointer' : ''} ${
                    validatingOrderId === order.id
                      ? 'bg-primary-50/50 border-l-[3px] border-l-primary-400'
                      : 'hover:bg-primary-100'
                  }`}>
                  <td className="pl-3 pr-1 py-3.5">
                    {editable && (
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-all ${
                        validatingOrderId === order.id
                          ? 'bg-primary-100 text-primary-600'
                          : 'text-warm-300 group-hover:text-primary-500 group-hover:bg-primary-50'
                      }`}>
                        {validatingOrderId === order.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className={`w-3 h-3 shrink-0 ${validatingOrderId === order.id ? 'text-primary-500' : 'text-warm-200'}`} />
                      <span className="font-mono font-semibold text-primary-700 text-xs">{order.outbound_order_no}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    {order.destinatario ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-warm-300 shrink-0" />
                        <span className="text-xs text-warm-700 font-medium truncate max-w-[160px]">{order.destinatario}</span>
                      </div>
                    ) : <span className="text-xs text-warm-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-xs text-warm-500 tabular-nums">{order.bultos_esperados ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                    <span className={`text-xs font-semibold tabular-nums ${(order.surtido_validadas ?? 0) > 0 ? 'text-success-600' : 'text-warm-300'}`}>
                      {order.surtido_validadas ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-xs font-semibold text-warm-800 tabular-nums">{order.bultos}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                    {editable ? (
                      <select value={order.estado}
                        onChange={e => doUpdateOrder({ orderId: order.id, body: { estado: e.target.value } })}
                        className="text-xs border border-warm-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400">
                        {ORDER_ESTADOS.map(e => (
                          <option key={e} value={e}>{ORDER_ESTADO_META[e]?.label}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusPill className={ORDER_ESTADO_META[order.estado]?.cls ?? ORDER_ESTADO_META.pendiente.cls}>
                        {ORDER_ESTADO_META[order.estado]?.label ?? 'Pendiente'}
                      </StatusPill>
                    )}
                  </td>
                  {editable && (
                    <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setValidatingOrderId(id => id === order.id ? null : order.id)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all sm:h-auto sm:w-auto sm:p-1.5 ${
                            validatingOrderId === order.id
                              ? 'bg-primary-100 text-primary-600'
                              : 'text-warm-400 hover:text-primary-600 hover:bg-primary-50 sm:text-warm-300'
                          }`}>
                          <ShieldCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                        {canDelete('despacho.folios') && (
                          <button
                            onClick={() => doRemoveOrder({ orderId: order.id })}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-warm-400 hover:text-danger-500 hover:bg-danger-50 transition-all sm:h-auto sm:w-auto sm:p-1.5 sm:text-warm-200">
                            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </motion.tr>

                {validatingOrderId === order.id && (
                  <tr>
                    <td colSpan={editable ? 8 : 7} className="p-0">
                      <AnimatePresence>
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          <ValidationPanel
                            order={order}
                            folioId={folioId}
                            onUpdate={applyUpdate}
                            canEdit={editable}
                            onAutoConfirm={(body) => doUpdateOrder({ orderId: order.id, body })}
                            onClose={() => setValidatingOrderId(null)}
                            validarPorTarimas={true}
                            validarEtiquetado={!!folio?.validar_etiquetado}
                            detailCache={detailCacheRef}
                          />
                        </motion.div>
                      </AnimatePresence>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Cerrar folio confirm modal */}
      <Modal
        isOpen={showConfirmCerrar}
        onClose={() => setShowConfirmCerrar(false)}
        title={t('desp.validar.cerrarFolioTitle')}
        icon={CheckCircle2}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowConfirmCerrar(false)} className="btn-secondary text-sm">
              {t('common.back')}
            </button>
            <button onClick={() => doCerrar()} disabled={cerrando}
              className="btn-success text-sm flex items-center gap-1.5">
              {cerrando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('desp.validar.confirmarCierre')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-warm-700">
          {t('desp.validar.cerrarConfirmPre')} <span className="font-mono font-semibold">{folio?.folio_numero ?? folio?.folio}</span>{t('desp.validar.cerrarConfirmPost')}
        </p>
      </Modal>

      {/* Cancel confirm modal */}
      <Modal
        isOpen={showConfirmCancel}
        onClose={() => setShowConfirmCancel(false)}
        title={t('desp.validar.cancelarFolioTitle')}
        icon={AlertCircle}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowConfirmCancel(false)} className="btn-secondary text-sm">{t('common.back')}</button>
            <button onClick={() => doCancelar()} disabled={cancelando}
              className="btn-danger text-sm flex items-center gap-1.5">
              {cancelando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('desp.validar.confirmarCancelacion')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-warm-700">
          {t('desp.validar.orden.cancelConfirm')}
        </p>
      </Modal>
    </div>
  )
}
