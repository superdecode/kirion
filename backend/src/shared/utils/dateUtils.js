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
 * Only accept values Intl recognizes as a valid IANA timezone, falling back to
 * the default otherwise. `tz` here is almost always `req.fullUser?.zona_horaria`,
 * which is validated with this exact same Intl check at write time (both the
 * tenant self-service preferences endpoint and the admin tenant-settings
 * endpoint) — but that's no guarantee for every row: legacy data written
 * before validation existed, a direct DB edit, or some future write path that
 * doesn't go through either endpoint. dateInTZ/instantDateInTZ/hourInTZ below
 * interpolate `tz` directly into a SQL string literal (`AT TIME ZONE '${tz}'`)
 * with no further escaping, so an unrecognized value doesn't just silently
 * misbehave — Postgres throws on it, turning every date-filtered query for
 * that user/tenant into a hard 500 across every module that filters by date.
 * Sanitizing at the point of use, not just at write time, closes that.
 */
function safeTz(tz) {
  if (!tz || typeof tz !== 'string') return DEFAULT_TZ
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
    return tz
  } catch {
    return DEFAULT_TZ
  }
}

/**
 * Returns today's date as 'YYYY-MM-DD' in the given timezone.
 */
export function getToday(tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: safeTz(tz) }).format(new Date())
}

/** @deprecated Use getToday() instead */
export const getTodayMX = () => getToday(DEFAULT_TZ)

/**
 * SQL expression to cast a UTC value stored in a TIMESTAMP (without tz)
 * column to a DATE in the user's timezone.
 *
 * Because the columns are `TIMESTAMP` (not `TIMESTAMPTZ`), PostgreSQL
 * doesn't know they hold UTC.  We must first declare them as UTC, then
 * convert to the target timezone:
 *   col AT TIME ZONE 'UTC'          → interprets as UTC → returns TIMESTAMPTZ
 *   ... AT TIME ZONE 'user_tz'      → converts to local  → returns TIMESTAMP
 */
export function dateInTZ(col, tz = DEFAULT_TZ) {
  return `(${col} AT TIME ZONE 'UTC' AT TIME ZONE '${safeTz(tz)}')::DATE`
}

/**
 * SQL expression to convert a TIMESTAMPTZ instant to a calendar date in a timezone.
 * Unlike TIMESTAMP columns, TIMESTAMPTZ already identifies an absolute instant.
 */
export function instantDateInTZ(col, tz = DEFAULT_TZ) {
  return `(${col} AT TIME ZONE '${safeTz(tz)}')::DATE`
}

/** @deprecated Use dateInTZ() instead */
export const dateMX = (col) => dateInTZ(col, DEFAULT_TZ)

/**
 * SQL expression to extract hour (0-23) in the given timezone.
 */
export function hourInTZ(col, tz = DEFAULT_TZ) {
  return `EXTRACT(HOUR FROM (${col} AT TIME ZONE 'UTC' AT TIME ZONE '${safeTz(tz)}'))`
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
