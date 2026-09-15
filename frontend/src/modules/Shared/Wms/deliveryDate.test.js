import { describe, it, expect } from 'vitest'
import { parseDeliveryDate } from './deliveryDate'

describe('parseDeliveryDate', () => {
  it('reads D/M/Y with no leading zeros as day-first (6/8/2026 = 6 de agosto)', () => {
    expect(parseDeliveryDate('6/8/2026 19:45:00')).toEqual({ dateKey: '2026-08-06', error: null })
  })

  it('reads D/M/Y with leading zeros the same way', () => {
    expect(parseDeliveryDate('06/08/2026')).toEqual({ dateKey: '2026-08-06', error: null })
  })

  it('never falls back to closest-to-today guessing when both parts are <= 12', () => {
    // Old behavior picked whichever of 2026-01-05 / 2026-05-01 was nearer to "now".
    // Fixed rule: day is always first.
    expect(parseDeliveryDate('5/1/2026')).toEqual({ dateKey: '2026-01-05', error: null })
  })

  it('resolves an unambiguous M/D/Y when the second value cannot be a month', () => {
    // 18 can't be a month, so this is forced (not guessed): month=7, day=18 (18 de julio).
    expect(parseDeliveryDate('7/18/2026 10:05:00')).toEqual({ dateKey: '2026-07-18', error: null })
  })

  it('resolves an unambiguous D/M/Y when the first value cannot be a month', () => {
    expect(parseDeliveryDate('25/7/2026')).toEqual({ dateKey: '2026-07-25', error: null })
  })

  it('flags a date as invalid only when neither value can be a month', () => {
    const result = parseDeliveryDate('15/13/2026')
    expect(result.dateKey).toBe('')
    expect(result.error).toMatch(/mes/i)
  })

  it('flags an ISO date with an out-of-range month', () => {
    const result = parseDeliveryDate('2026-13-05')
    expect(result.dateKey).toBe('')
    expect(result.error).toMatch(/mes/i)
  })

  it('reads ISO dates as YYYY-MM-DD with no swapping', () => {
    expect(parseDeliveryDate('2026-08-06 19:45:00')).toEqual({ dateKey: '2026-08-06', error: null })
  })

  it('returns empty with no error for blank input', () => {
    expect(parseDeliveryDate('')).toEqual({ dateKey: '', error: null })
    expect(parseDeliveryDate(null)).toEqual({ dateKey: '', error: null })
  })

  it('returns empty with no error for an unrecognized shape (caller falls back to a generic parser)', () => {
    expect(parseDeliveryDate('not a date')).toEqual({ dateKey: '', error: null })
  })
})
