// Strips sequential-unit suffixes from WMS box barcodes.
// Pattern 1: separator (/ - _ . space) followed by digits → "52378103/5" → "52378103"
// Pattern 2: "U" + digits → "PLEC26012969105U0001" → "PLEC26012969105",
//            "XZH2608090358U100" → "XZH2608090358"
// Must match the backend's own base-code rule (rastreo.routes.js extractBaseCode:
// /^(.+?)U\d+$/) — that version requires only a "U" and digits, not a leading zero.
// This one used to require [A-Za-z]0\d+ (a zero right after the letter), which missed
// any "U" suffix not zero-padded (U100, not just U0100) and let two variants of the same
// box code show up as separate groups in lists like "Vista previa lista de recepción".
export function extractBaseCode(code) {
  if (!code) return null
  const str = String(code).trim()
  let r = str.replace(/[/\-_.\s]\d+$/, '')
  if (r.length > 0 && r.length < str.length) return r
  r = str.replace(/U\d+$/, '')
  if (r.length > 0 && r.length < str.length) return r
  return str
}
