import { describe, it, expect, vi } from 'vitest'
import { parsePeso, saveGuiaPeso, pesoErrorResponse } from '../modules/dropscan/utils/peso.js'

describe('parsePeso', () => {
  it('accepts numbers and numeric strings in range', () => {
    expect(parsePeso(1.5)).toBe(1.5)
    expect(parsePeso('0.001')).toBe(0.001)
    expect(parsePeso('9999.999')).toBe(9999.999)
  })
  it('returns null for out-of-range or non numeric values', () => {
    expect(parsePeso(0)).toBeNull()
    expect(parsePeso(10000)).toBeNull()
    expect(parsePeso('abc')).toBeNull()
    expect(parsePeso(undefined)).toBeNull()
    expect(parsePeso(null)).toBeNull()
  })
})

describe('saveGuiaPeso', () => {
  it('runs a single query (one pool checkout) and returns the row', async () => {
    const tQuery = vi.fn().mockResolvedValue({ rows: [{ id: 7, peso_kg: '2.5' }] })
    const row = await saveGuiaPeso(tQuery, { sessionId: 1, guiaId: 7, operadorId: 3, tenantId: 't', peso: 2.5 })
    expect(tQuery).toHaveBeenCalledTimes(1)
    expect(row).toEqual({ id: 7, peso_kg: '2.5' })
  })
  it('returns null when guia or session does not match', async () => {
    const tQuery = vi.fn().mockResolvedValue({ rows: [] })
    expect(await saveGuiaPeso(tQuery, { sessionId: 1, guiaId: 7, operadorId: 3, tenantId: 't', peso: 2.5 })).toBeNull()
  })
})

describe('pesoErrorResponse', () => {
  it('maps transient DB errors to a retryable 503', () => {
    const r = pesoErrorResponse(Object.assign(new Error('x'), { code: 'ECHECKOUTTIMEOUT' }))
    expect(r.status).toBe(503)
    expect(r.body.code).toBe('DB_BUSY')
    expect(r.retryAfterSeconds).toBeGreaterThan(0)
  })
  it('maps unknown errors to 500', () => {
    expect(pesoErrorResponse(new Error('boom')).status).toBe(500)
  })
})
