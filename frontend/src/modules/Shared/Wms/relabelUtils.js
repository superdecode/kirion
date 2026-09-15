import { normalizeCodeFast } from './normalizeCode'
import { extractBaseCode } from './extractBaseCode'

// Relabel ("reetiquetado") detection, shared by ValidarPorDestino and ValidarPorOrden.
// Confirmed against the real WMS column headers — the opposite of what the generic
// field names suggest: logisticsTrackNo ("货件追踪码/Reference ID") holds the OLD
// label, thirdOrderNo ("Reference order No._参考单号") holds the NEW label the box
// must carry before it can go out. There is no 1:1 box↔label relationship, so this
// compares by base code (extractBaseCode) — each box can carry its own suffix while
// sharing the same base as the order's label.
export function orderNeedsRelabel(meta) {
  const oldBase = extractBaseCode(normalizeCodeFast(meta?.logisticsTrackNo || ''))
  const newBase = extractBaseCode(normalizeCodeFast(meta?.thirdOrderNo || ''))
  return !!oldBase && !!newBase && oldBase !== newBase
}

// Base code the second scan must match to satisfy the relabel gate.
export function newLabelBase(meta) {
  return extractBaseCode(normalizeCodeFast(meta?.thirdOrderNo || '')) || ''
}
