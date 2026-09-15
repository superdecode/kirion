import { normalizeCodeFast } from './normalizeCode'
import { extractBaseCode } from './extractBaseCode'

function baseOf(rawCode) {
  return extractBaseCode(normalizeCodeFast(rawCode || '')) || ''
}

// Relabel ("reetiquetado") detection, shared by ValidarPorDestino and ValidarPorOrden.
// Confirmed against the real WMS column headers: logisticsTrackNo ("货件追踪码/
// Reference ID") holds the NEW label the box must carry before it can go out,
// thirdOrderNo ("Reference order No._参考单号") normally holds the OLD label. There is
// no 1:1 box↔label relationship, so this compares by base code (extractBaseCode) —
// each box can carry its own suffix while sharing the same base as the order's label.
//
// thirdOrderNo isn't always a trustworthy old-label source: some rows have it copied
// equal to the new label (logisticsTrackNo) instead of holding a genuinely distinct
// old value. When that happens, fall back to fbaShipmentId ("FBA货件ID/
// FBAShipmentID") as the alternate old-label source — it exists only to let the
// relabel gate recognize that code as "this is the old one", not as a second
// authoritative source of truth (logisticsTrackNo always wins for the new label).
export function oldLabelBase(meta) {
  const newBase = baseOf(meta?.logisticsTrackNo)
  const thirdBase = baseOf(meta?.thirdOrderNo)
  if (thirdBase && thirdBase !== newBase) return thirdBase
  return baseOf(meta?.fbaShipmentId)
}

export function orderNeedsRelabel(meta) {
  const oldBase = oldLabelBase(meta)
  const newBase = baseOf(meta?.logisticsTrackNo)
  return !!oldBase && !!newBase && oldBase !== newBase
}

// Base code the second scan must match to satisfy the relabel gate.
export function newLabelBase(meta) {
  return baseOf(meta?.logisticsTrackNo)
}
