// Strict WMS delivery-date parsing, shared by Despacho and Surtido's data-load paths.
//
// Fixed positional rules — never "closest to today" guessing:
//   - ISO-like   "YYYY-MM-DD" / "YYYY/MM/DD": month is ALWAYS the 2nd group, day the 3rd.
//   - Slash/dash "D/M/YYYY" / "D-M-YYYY" / "D.M.YYYY": day is ALWAYS the 1st group,
//     month the 2nd — independent of whether either has a leading zero.
//     e.g. "6/8/2026 19:45:00" = 6 de agosto (day=6, month=8), never mes=6/dia=8.
//
// If the value sitting in the month position is out of 1-12, that is not an
// ambiguous date to resolve — it is bad source data. Parsing fails loudly (returns
// `error`) instead of silently falling back to a guess, so a bad row from the
// WMS/Google Sheet export surfaces before it corrupts a folio/lote date grouping.
export function parseDeliveryDate(raw) {
  const str = String(raw || '').trim()
  if (!str) return { dateKey: '', error: null }

  const isoLike = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoLike) {
    const [, y, m, d] = isoLike
    const month = Number(m)
    const day = Number(d)
    if (month < 1 || month > 12) {
      return {
        dateKey: '',
        error: `Fecha "${str}" invalida: el mes (posicion 2, formato AAAA-MM-DD) es ${month}, debe estar entre 1 y 12.`,
      }
    }
    if (day < 1 || day > 31) {
      return { dateKey: '', error: `Fecha "${str}" invalida: el dia (${day}) debe estar entre 1 y 31.` }
    }
    return { dateKey: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, error: null }
  }

  const slashDate = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
  if (slashDate) {
    const [, d, m, y] = slashDate
    const day = Number(d)
    const month = Number(m)
    if (month < 1 || month > 12) {
      return {
        dateKey: '',
        error: `Fecha "${str}" fuera de formato: el mes (posicion 2, formato DD/MM/AAAA) es ${month}, debe estar entre 1 y 12. Ejemplo correcto: 6/8/2026 = 6 de agosto. Corrige el dato en la base/hoja de origen.`,
      }
    }
    if (day < 1 || day > 31) {
      return { dateKey: '', error: `Fecha "${str}" invalida: el dia (${day}) debe estar entre 1 y 31. Formato esperado: DD/MM/AAAA.` }
    }
    return { dateKey: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, error: null }
  }

  // Unrecognized shape — not a D/M vs M/D ambiguity case, caller falls back to a
  // generic parser (toDateKey) rather than treating it as a format violation.
  return { dateKey: '', error: null }
}
