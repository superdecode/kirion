/**
 * Date utilities for timezone-aware date handling.
 * All timestamps in the DB are stored as UTC; use these helpers so that
 * "today" and date comparisons reflect the user's local time, not UTC.
 *
 * Functions accept an optional `tz` parameter. When omitted, they fall
 * back to America/Mexico_City for backward compatibility.
 */

const DEFAULT_TZ = 'America/Mexico_City'

/**
 * Returns today's date as 'YYYY-MM-DD' in the given timezone.
 */
export function getToday(tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

/** @deprecated Use getToday() instead */
export const getTodayMX = () => getToday(DEFAULT_TZ)

/**
 * SQL expression to cast a UTC timestamp column to a date in `tz`.
 * Example: `${dateInTZ('t.fecha_inicio', tz)} BETWEEN $1 AND $2`
 */
export function dateInTZ(col, tz = DEFAULT_TZ) {
  return `(${col} AT TIME ZONE '${tz}')::DATE`
}

/** @deprecated Use dateInTZ() instead */
export const dateMX = (col) => dateInTZ(col, DEFAULT_TZ)

/**
 * SQL expression to extract hour (0-23) in the given timezone.
 */
export function hourInTZ(col, tz = DEFAULT_TZ) {
  return `EXTRACT(HOUR FROM (${col} AT TIME ZONE '${tz}'))`
}

/** @deprecated Use hourInTZ() instead */
export const hourMX = (col) => hourInTZ(col, DEFAULT_TZ)

/**
 * SQL WHERE helpers for date range filtering with dynamic timezone.
 */
export function dateFrom(col, paramNum, tz = DEFAULT_TZ) {
  return `${dateInTZ(col, tz)} >= $${paramNum}`
}

export function dateTo(col, paramNum, tz = DEFAULT_TZ) {
  return `${dateInTZ(col, tz)} <= $${paramNum}`
}

export function dateRange(col, startParam, endParam, tz = DEFAULT_TZ) {
  return `${dateInTZ(col, tz)} BETWEEN $${startParam} AND $${endParam}`
}

/** @deprecated Use dateFrom() */
export const dateFromMX = (col, paramNum) => dateFrom(col, paramNum, DEFAULT_TZ)
/** @deprecated Use dateTo() */
export const dateToMX = (col, paramNum) => dateTo(col, paramNum, DEFAULT_TZ)
/** @deprecated */
export function dateRangeMX(col, startParam, endParam = null) {
  if (endParam === null) return `${dateMX(col)} = $${startParam}`
  return dateRange(col, startParam, endParam, DEFAULT_TZ)
}

export const CDMX_TZ = DEFAULT_TZ
