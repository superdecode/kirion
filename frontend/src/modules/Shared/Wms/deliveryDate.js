// Strict WMS delivery-date parsing, shared by Despacho and Surtido's data-load paths.
//
// Slash/dash dates ("D/M/YYYY", "D-M-YYYY", "D.M.YYYY") resolve in three tiers:
//   1. Unambiguous — one of the two values is > 12, so it can only be the day.
//      e.g. "7/18/2026" → 18 can't be a month, so it's the day: 18 de julio (day=18,
//      month=7). This is forced by validity, not a guess.
//   2. Ambiguous — both values are <= 12 (e.g. "6/8/2026"). Fixed rule: day is
//      ALWAYS the first group, month the second, independent of leading zeros.
//      "6/8/2026 19:45:00" = 6 de agosto (day=6, month=8), never mes=6/dia=8. No
//      "closest to today" guessing — always this same reading.
//   3. Invalid — both values are > 12 (or the resolved month/day is out of range
//      some other way). Not ambiguous, not resolvable: bad source data.
// ISO-like "YYYY-MM-DD" / "YYYY/MM/DD" stays fixed: month is ALWAYS the 2nd group,
// day the 3rd, no swapping.
//
// Whenever the source data can't be resolved to a valid date (case 3, or an
// out-of-range ISO month/day), parsing fails loudly (returns `error`) instead of
// falling back to any guess, so a bad row from the WMS/Google Sheet export surfaces
// before it corrupts a folio/lote date grouping.
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
    const [, p1, p2, y] = slashDate
    const first = Number(p1)
    const second = Number(p2)

    if (first > 12 && second > 12) {
      return {
        dateKey: '',
        error: `Fecha "${str}" invalida: ni ${first} ni ${second} pueden ser mes (ambos mayores a 12).`,
      }
    }

    // second > 12 → second can't be a month, so it's the day (unambiguous, forced).
    // first > 12  → same logic the other way (unambiguous, forced).
    // Neither     → genuinely ambiguous: fixed rule, day is always first.
    const day = second > 12 ? second : first
    const month = second > 12 ? first : second

    if (month < 1 || month > 12) {
      return {
        dateKey: '',
        error: `Fecha "${str}" fuera de formato: el mes resuelto es ${month}, debe estar entre 1 y 12. Ejemplo correcto: 6/8/2026 = 6 de agosto. Corrige el dato en la base/hoja de origen.`,
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
