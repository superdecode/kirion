import { describe, it, expect } from 'vitest'
import { parseDateValue } from './dateFormat'

describe('parseDateValue — D/M/Y ambiguity', () => {
  it('reads D/M/Y with no leading zeros as day-first (9/7/2026 = 9 de julio, not 7 de septiembre)', () => {
    const date = parseDateValue('9/7/2026 12:00:00')
    expect(date).not.toBeNull()
    expect(date.getMonth()).toBe(6) // July (0-indexed)
    expect(date.getDate()).toBe(9)
  })

  it('never falls back to closest-to-today guessing when both parts are <= 12', () => {
    const date = parseDateValue('5/1/2026')
    expect(date.getMonth()).toBe(0) // January
    expect(date.getDate()).toBe(5)
  })

  it('resolves an unambiguous M/D/Y when the second value cannot be a month', () => {
    // 25 can't be a month, so this is forced (not guessed): month=7, day=25 (July 25).
    const date = parseDateValue('7/25/2026')
    expect(date).not.toBeNull()
    expect(date.getMonth()).toBe(6) // July
    expect(date.getDate()).toBe(25)
  })

  it('resolves an unambiguous M/D/Y from a real WMS value (7/18/2026 = 18 de julio)', () => {
    // 18 can't be a month, so day=18, month=7 (July 18) — the exact case reported as a
    // bug when a prior fix wrongly treated this as invalid.
    const date = parseDateValue('7/18/2026 10:05:00')
    expect(date).not.toBeNull()
    expect(date.getMonth()).toBe(6) // July
    expect(date.getDate()).toBe(18)
  })

  it('returns null only when neither value can be a month', () => {
    expect(parseDateValue('20/25/2026')).toBeNull()
  })

  it('reads ISO dates as YYYY-MM-DD with no swapping', () => {
    const date = parseDateValue('2026-07-09 12:00:00')
    expect(date.getMonth()).toBe(6)
    expect(date.getDate()).toBe(9)
  })

  it('returns null for an out-of-range ISO month instead of guessing', () => {
    expect(parseDateValue('2026-13-05')).toBeNull()
  })
})
