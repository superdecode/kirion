/**
 * Date formatting utilities — uses configurable timezone.
 * Import these instead of calling toLocaleString/toLocaleDateString/
 * toLocaleTimeString directly so all timestamps display consistently.
 *
 * Call setTimezone() when the user logs in or changes their preference.
 */

let _tz = 'America/Mexico_City'
const LOCALE = 'es-MX'

/** Set the active timezone for all formatting functions. */
export const setTimezone = (tz) => { _tz = tz }

/** Get the current active timezone. */
export const getTimezone = () => _tz

/** "HH:MM:SS" */
export const fmtTime = (date) =>
  new Date(date).toLocaleTimeString(LOCALE, { timeZone: _tz })

/** "HH:MM" */
export const fmtTimeShort = (date) =>
  new Date(date).toLocaleTimeString(LOCALE, { timeZone: _tz, hour: '2-digit', minute: '2-digit' })

/** "DD/MM/YYYY" */
export const fmtDate = (date) =>
  new Date(date).toLocaleDateString(LOCALE, { timeZone: _tz, day: '2-digit', month: '2-digit', year: 'numeric' })

/** "lun. 1 ene." */
export const fmtDateShort = (date) =>
  new Date(date).toLocaleDateString(LOCALE, { timeZone: _tz, weekday: 'short', day: 'numeric', month: 'short' })

/** "DD/MM/YYYY, HH:MM:SS" */
export const fmtDateTime = (date) =>
  new Date(date).toLocaleString(LOCALE, { timeZone: _tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** "DD/MM, HH:MM" */
export const fmtDateTimeMini = (date) =>
  new Date(date).toLocaleString(LOCALE, { timeZone: _tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Returns today as 'YYYY-MM-DD' in the active timezone. */
export const getToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: _tz }).format(new Date())

/** @deprecated Use getToday() */
export const getTodayMX = getToday

/**
 * Returns a date string 'YYYY-MM-DD' in the active timezone that is `days`
 * before the given date string. Safe across DST boundaries.
 */
export const subtractDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T18:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: _tz }).format(d)
}

/** @deprecated Use subtractDays() */
export const subtractDaysMX = subtractDays
