import { describe, it, expect } from 'vitest'
import { orderNeedsProductLabel, productSkuCandidates, matchesProductSku } from './productLabelUtils'

const REMARK = '旧箱唛68045939换新箱唛76524105//换新产品标SXMX39061'

describe('productLabelUtils', () => {
  it('detects a product-label change from the 产品/SKU keywords', () => {
    expect(orderNeedsProductLabel({ remark: REMARK })).toBe(true)
    expect(orderNeedsProductLabel({ remark: 'sin cambios' })).toBe(false)
    expect(orderNeedsProductLabel({ remark: '' })).toBe(false)
    expect(orderNeedsProductLabel({})).toBe(false)
  })

  it('extracts the SKU token, excluding the old/new box marks already known from other columns', () => {
    const meta = { remark: REMARK, thirdOrderNo: '68045939', logisticsTrackNo: '76524105' }
    expect(productSkuCandidates(meta)).toEqual(['SXMX39061'])
  })

  it('matches a scan of the real SKU', () => {
    const meta = { remark: REMARK, thirdOrderNo: '68045939', logisticsTrackNo: '76524105' }
    expect(matchesProductSku(meta, 'SXMX39061')).toBe(true)
  })

  it('rejects a scan of the old or new box mark — those are not the SKU', () => {
    const meta = { remark: REMARK, thirdOrderNo: '68045939', logisticsTrackNo: '76524105' }
    expect(matchesProductSku(meta, '68045939')).toBe(false)
    expect(matchesProductSku(meta, '76524105')).toBe(false)
  })

  it('rejects an unrelated scan', () => {
    const meta = { remark: REMARK, thirdOrderNo: '68045939', logisticsTrackNo: '76524105' }
    expect(matchesProductSku(meta, 'ZZZ00000')).toBe(false)
  })

  it('excludes the fbaShipmentId fallback code too when it appears in the remark', () => {
    const meta = {
      remark: '旧箱唛68045939换新箱唛76524105//换新产品标SXMX39061',
      logisticsTrackNo: '76524105',
      thirdOrderNo: '76524105', // duplicated (untrustworthy old value, see relabelUtils)
      fbaShipmentId: '68045939',
    }
    expect(productSkuCandidates(meta)).toEqual(['SXMX39061'])
  })
})
