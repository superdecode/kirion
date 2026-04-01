/**
 * Date formatting utilities — always uses America/Mexico_City timezone.
 * Import these instead of calling toLocaleString/toLocaleDateString/
 * toLocaleTimeString directly so all timestamps display consistently.
 */

const TZ = 'America/Mexico_City'
const LOCALE = 'es-MX'

/** "HH:MM:SS" */
export const fmtTime = (date) =>
  new Date(date).toLocaleTimeString(LOCALE, { timeZone: TZ })

/** "HH:MM" */
export const fmtTimeShort = (date) =>
  new Date(date).toLocaleTimeString(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

/** "DD/MM/YYYY" */
export const fmtDate = (date) =>
  new Date(date).toLocaleDateString(LOCALE, { timeZone: TZ })

/** "lun. 1 ene." */
export const fmtDateShort = (date) =>
  new Date(date).toLocaleDateString(LOCALE, { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })

/** "DD/MM/YYYY, HH:MM:SS" */
export const fmtDateTime = (date) =>
  new Date(date).toLocaleString(LOCALE, { timeZone: TZ })

/** "DD/MM, HH:MM" */
export const fmtDateTimeMini = (date) =>
  new Date(date).toLocaleString(LOCALE, { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Returns today as 'YYYY-MM-DD' in CDMX local time. */
export const getTodayMX = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())

/**
 * Returns a date string 'YYYY-MM-DD' in CDMX that is `days` before the
 * given CDMX date string. Safe across DST boundaries.
 */
export const subtractDaysMX = (cdmxDateStr, days) => {
  // Parse as noon UTC to avoid any DST/midnight edge cases
  const d = new Date(`${cdmxDateStr}T18:00:00Z`) // 18:00 UTC = noon CDMX (UTC-6)
  d.setUTCDate(d.getUTCDate() - days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}
