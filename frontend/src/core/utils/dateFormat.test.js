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

  it('does not reinterpret a second value over 12 as day-first-month-second (M/D/Y)', () => {
    // Old behavior treated this as month=7, day=25 (July 25). Fixed rule: day=7, month=25
    // is invalid, so it must fail instead of silently guessing an M/D/Y interpretation.
    expect(parseDateValue('7/25/2026')).toBeNull()
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
