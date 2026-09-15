import { normalizeCodeFast } from './normalizeCode'
import { extractBaseCode } from './extractBaseCode'

// Internal product-label (SKU) change detection and validation, driven entirely by
// the free-text "Remark_备注" column — there is no dedicated SKU column, the WMS
// embeds it inside the order remark, e.g.:
//   "旧箱唛68045939换新箱唛76524105//换新产品标SXMX39061"
//   (old box mark 68045939 -> new box mark 76524105 // change to new product label
//   SXMX39061)
// The old/new box marks in that string are NOT the SKU — they're the same values
// that already live in their own columns (logisticsTrackNo/thirdOrderNo/
// fbaShipmentId or a per-box customizeCode). The SKU is whatever code-like token in
// the remark is NOT one of those already-known codes.

const PRODUCT_LABEL_KEYWORDS = /产品|SKU/i

// Does this order's remark mention a product/SKU label change at all?
export function orderNeedsProductLabel(meta) {
  return PRODUCT_LABEL_KEYWORDS.test(String(meta?.remark || ''))
}

function baseOf(rawCode) {
  return extractBaseCode(normalizeCodeFast(rawCode || '')) || ''
}

// Every code this order already has a dedicated column for — excluded from SKU
// extraction so the old/new box mark embedded in the remark text is never mistaken
// for the product label.
function knownCodeBases(meta) {
  const bases = new Set()
  const add = (raw) => { const base = baseOf(raw); if (base) bases.add(base) }
  add(meta?.logisticsTrackNo)
  add(meta?.thirdOrderNo)
  add(meta?.fbaShipmentId)
  add(meta?.outbound_order_no || meta?.outboundOrderNo)
  ;(Array.isArray(meta?.allCustomizeCodes) ? meta.allCustomizeCodes : []).forEach(add)
  return bases
}

// Pulls every alphanumeric code-like token out of the remark (Chinese characters and
// punctuation act as natural separators — no keyword-segment parsing needed), then
// drops anything that matches an already-known code for this order. Whatever's left
// is a candidate product/SKU code to validate a scan against.
export function productSkuCandidates(meta) {
  const remark = String(meta?.remark || '')
  if (!remark) return []
  const known = knownCodeBases(meta)
  const tokens = remark.match(/[A-Za-z0-9]{4,}/g) || []
  const candidates = new Set()
  tokens.forEach((token) => {
    const base = baseOf(token)
    if (base && !known.has(base)) candidates.add(base)
  })
  return [...candidates]
}

// True when the scanned code exactly matches (by base code) one of the SKU
// candidates extracted from this order's remark — a real validation against the
// order's own data, not just a stored flag.
export function matchesProductSku(meta, scannedRawCode) {
  const scannedBase = baseOf(scannedRawCode)
  if (!scannedBase) return false
  return productSkuCandidates(meta).includes(scannedBase)
}
