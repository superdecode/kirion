// Persists DropScan's config catalogs (empresas, canales, parámetros, operadores
// activos) to localStorage so a cold app load while offline still has something
// to seed the "start session" flow with, instead of an empty/blocking picker.
// Same pattern already used for the outbound sheet cache in
// WmsHub/services/googleSheetsService.js (OUTBOUND_ROWS_CACHE_KEY).
//
// localStorage is already origin-scoped per tenant subdomain, so no explicit
// tenant key is needed here — matches the existing precedent.
const CACHE_PREFIX = 'kirion_dropscan_config_'
const CACHE_TTL = 24 * 60 * 60 * 1000

export function readConfigCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null')
    if (!cached || Date.now() - cached.ts > CACHE_TTL) return undefined
    return cached.data
  } catch {
    return undefined
  }
}

export function writeConfigCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // Storage quota should never block the app — this cache is best-effort.
  }
}
