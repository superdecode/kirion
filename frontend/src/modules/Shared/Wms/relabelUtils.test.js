import { describe, it, expect } from 'vitest'
import { orderNeedsRelabel, newLabelBase, oldLabelBase } from './relabelUtils'

describe('relabelUtils', () => {
  it('needs relabel when logisticsTrackNo (old) and thirdOrderNo (new) have different bases', () => {
    const meta = { logisticsTrackNo: 'TRK9999-2', thirdOrderNo: 'REF123-1' }
    expect(orderNeedsRelabel(meta)).toBe(true)
    expect(oldLabelBase(meta)).toBe('TRK9999')
    expect(newLabelBase(meta)).toBe('REF123')
  })

  it('does not need relabel when logisticsTrackNo and thirdOrderNo share the same base', () => {
    const meta = { logisticsTrackNo: 'TRK9999-2', thirdOrderNo: 'TRK9999-1' }
    expect(orderNeedsRelabel(meta)).toBe(false)
  })

  it('falls back to fbaShipmentId when thirdOrderNo equals the old label instead of a distinct new value', () => {
    const meta = {
      logisticsTrackNo: 'TRK9999-2',
      thirdOrderNo: 'TRK9999-1', // copied equal to the old label — not a real new value
      fbaShipmentId: 'FBA555-3',
    }
    expect(newLabelBase(meta)).toBe('FBA555')
    expect(orderNeedsRelabel(meta)).toBe(true)
    expect(oldLabelBase(meta)).toBe('TRK9999')
  })

  it('does not need relabel when thirdOrderNo equals the old label and fbaShipmentId is also missing/equal', () => {
    const meta = { logisticsTrackNo: 'TRK9999-2', thirdOrderNo: 'TRK9999-1' }
    expect(orderNeedsRelabel(meta)).toBe(false)
  })

  it('does not need relabel when either field is missing', () => {
    expect(orderNeedsRelabel({ logisticsTrackNo: 'TRK9999-2' })).toBe(false)
    expect(orderNeedsRelabel({ thirdOrderNo: 'REF123-1' })).toBe(false)
    expect(orderNeedsRelabel({})).toBe(false)
  })

  it('matches the real WMS remark example: old=logisticsTrackNo, new=thirdOrderNo', () => {
    // Remark: "旧箱唛70718584换新箱唛76624422//换新产品标MPJE98111"
    // ("old box mark 70718584 -> new box mark 76624422")
    const meta = {
      logisticsTrackNo: '70718584',
      thirdOrderNo: '76624422',
      fbaShipmentId: '76624422',
      remark: '旧箱唛70718584换新箱唛76624422//换新产品标MPJE98111',
    }
    expect(oldLabelBase(meta)).toBe('70718584')
    expect(newLabelBase(meta)).toBe('76624422')
    expect(orderNeedsRelabel(meta)).toBe(true)
  })
})
