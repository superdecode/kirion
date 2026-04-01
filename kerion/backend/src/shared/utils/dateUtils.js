/**
 * Date utilities for America/Mexico_City (CDMX) timezone.
 * All timestamps in the DB are stored as UTC; use these helpers so that
 * "today" and date comparisons reflect CDMX local time, not UTC.
 */

export const CDMX_TZ = 'America/Mexico_City'

/**
 * Returns today's date as 'YYYY-MM-DD' in CDMX timezone.
 * Use instead of `new Date().toISOString().slice(0, 10)` which gives UTC date.
 */
export function getTodayMX() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CDMX_TZ }).format(new Date())
}

/**
 * SQL expression to cast a UTC timestamp column to CDMX date.
 * Use instead of `DATE(col)` so that midnight-boundary records are assigned
 * to the correct CDMX calendar day.
 *
 * Example: `${dateMX('t.fecha_inicio')} BETWEEN $1 AND $2`
 */
export function dateMX(col) {
  return `(${col} AT TIME ZONE '${CDMX_TZ}')::DATE`
}

/**
 * SQL expression to extract hour (0-23) in CDMX local time.
 * Use instead of `EXTRACT(HOUR FROM col)`.
 */
export function hourMX(col) {
  return `EXTRACT(HOUR FROM (${col} AT TIME ZONE '${CDMX_TZ}'))`
}
