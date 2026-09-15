import { normalizeCodeFast } from './normalizeCode'
import { extractBaseCode } from './extractBaseCode'

function baseOf(rawCode) {
  return extractBaseCode(normalizeCodeFast(rawCode || '')) || ''
}

// Relabel ("reetiquetado") detection, shared by ValidarPorDestino and ValidarPorOrden.
//
// The WMS column headers alone (logisticsTrackNo = "货件追踪码/Reference ID",
// thirdOrderNo = "Reference order No._参考单号") are ambiguous by name — this was
// flipped more than once based on the header text before checking real data. The
// remark field ("Remark_备注") settles it with literal prose for each order, e.g.:
//   "旧箱唛70718584换新箱唛76624422//换新产品标MPJE98111"
//   ("old box mark 70718584 -> new box mark 76624422 // change to new product
//   label MPJE98111")
// Matching those two numbers against the columns confirms: logisticsTrackNo holds
// the OLD label, thirdOrderNo (or fbaShipmentId when thirdOrderNo is missing or
// wasn't actually changed) holds the NEW one. There is no 1:1 box↔label
// relationship, so this compares by base code (extractBaseCode) — each box can
// carry its own suffix while sharing the same base as the order's label.
export function oldLabelBase(meta) {
  return baseOf(meta?.logisticsTrackNo)
}

// thirdOrderNo isn't always a trustworthy new-label source: some rows have it
// copied equal to the old label (logisticsTrackNo) instead of holding a genuinely
// distinct new value. When that happens, fall back to fbaShipmentId ("FBA货件ID/
// FBAShipmentID") as the alternate new-label source.
export function newLabelBase(meta) {
  const oldBase = baseOf(meta?.logisticsTrackNo)
  const thirdBase = baseOf(meta?.thirdOrderNo)
  if (thirdBase && thirdBase !== oldBase) return thirdBase
  return baseOf(meta?.fbaShipmentId)
}

export function orderNeedsRelabel(meta) {
  const oldBase = oldLabelBase(meta)
  const newBase = newLabelBase(meta)
  return !!oldBase && !!newBase && oldBase !== newBase
}
