import { toDateKey } from '../../../core/utils/dateFormat'
import { parseDeliveryDate } from '../../Shared/Wms/deliveryDate'

/** Returns the raw WMS datetime string (preserving time component) for storage. */
export function getOrderDateTimeRaw(order) {
  return String(order?.outboundTime || order?.expectedTime || order?.orderCreateTime || '').trim()
}

function rawOrderDate(order) {
  return String(order?.outboundTime || order?.expectedTime || order?.orderCreateTime || '').trim()
}

/** Returns "YYYY-MM-DD" from WMS order date fields, or '' if none available or invalid. */
export function getOrderDateKey(order) {
  const str = rawOrderDate(order)
  if (!str) return ''

  const { dateKey, error } = parseDeliveryDate(str)
  if (error) return '' // bad data — see getOrderDateError() for the message
  if (dateKey) return dateKey

  try { const k = toDateKey(str); return (k && k !== '—') ? k : '' } catch { return '' }
}

/** Returns a human-readable format-violation message for this order's date, or null if valid/absent. */
export function getOrderDateError(order) {
  const str = rawOrderDate(order)
  if (!str) return null
  return parseDeliveryDate(str).error
}
