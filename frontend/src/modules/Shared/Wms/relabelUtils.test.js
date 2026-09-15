import { describe, it, expect } from 'vitest'
import { orderNeedsRelabel, newLabelBase, oldLabelBase } from './relabelUtils'

describe('relabelUtils', () => {
  it('needs relabel when thirdOrderNo (old) and logisticsTrackNo (new) have different bases', () => {
    const meta = { thirdOrderNo: 'REF123-1', logisticsTrackNo: 'TRK9999-2' }
    expect(orderNeedsRelabel(meta)).toBe(true)
    expect(newLabelBase(meta)).toBe('TRK9999')
    expect(oldLabelBase(meta)).toBe('REF123')
  })

  it('does not need relabel when thirdOrderNo and logisticsTrackNo share the same base', () => {
    const meta = { thirdOrderNo: 'TRK9999-1', logisticsTrackNo: 'TRK9999-2' }
    expect(orderNeedsRelabel(meta)).toBe(false)
  })

  it('falls back to fbaShipmentId when thirdOrderNo equals the new label instead of a distinct old value', () => {
    const meta = {
      logisticsTrackNo: 'TRK9999-2',
      thirdOrderNo: 'TRK9999-1', // copied equal to the new label — not a real old value
      fbaShipmentId: 'FBA555-3',
    }
    expect(oldLabelBase(meta)).toBe('FBA555')
    expect(orderNeedsRelabel(meta)).toBe(true)
    expect(newLabelBase(meta)).toBe('TRK9999')
  })

  it('does not need relabel when thirdOrderNo equals the new label and fbaShipmentId is also missing/equal', () => {
    const meta = { logisticsTrackNo: 'TRK9999-2', thirdOrderNo: 'TRK9999-1' }
    expect(orderNeedsRelabel(meta)).toBe(false)
  })

  it('does not need relabel when either field is missing', () => {
    expect(orderNeedsRelabel({ logisticsTrackNo: 'TRK9999-2' })).toBe(false)
    expect(orderNeedsRelabel({ thirdOrderNo: 'REF123-1' })).toBe(false)
    expect(orderNeedsRelabel({})).toBe(false)
  })
})
