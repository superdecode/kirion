import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../config/database.js', () => ({
  isDatabaseUnavailableError: vi.fn((error) => error?.code === 'ECHECKOUTTIMEOUT'),
  query: vi.fn(),
}))

const { query } = await import('../config/database.js')
const { moduleGuard, clearModuleAccessCache } = await import('../modules/middleware/moduleGuard.js')

function makeReq(overrides = {}) {
  return {
    tenantId: 'tenant-uuid-1',
    tenantReadOnly: false,
    method: 'GET',
    ...overrides,
  }
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this },
    json(body) { this._body = body; return this },
  }
  return res
}

describe('moduleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    query.mockReset()
    clearModuleAccessCache()
  })

  it('returns 401 when tenantId is missing', async () => {
    const guard = moduleGuard('dropscan')
    const req = makeReq({ tenantId: undefined })
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(res._status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 402 for write on read-only tenant', async () => {
    const guard = moduleGuard('dropscan')
    const req = makeReq({ tenantReadOnly: true, method: 'POST' })
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(res._status).toBe(402)
    expect(res._body.code).toBe('SUBSCRIPTION_EXPIRED')
    expect(next).not.toHaveBeenCalled()
  })

  it('allows read-only tenant to GET', async () => {
    query.mockResolvedValueOnce({ rows: [{ enabled: true }] })
    const guard = moduleGuard('dropscan')
    const req = makeReq({ tenantReadOnly: true, method: 'GET' })
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('calls next() when tenant_modules row is enabled', async () => {
    query.mockResolvedValueOnce({ rows: [{ enabled: true }] })
    const guard = moduleGuard('inventario')
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_modules'),
      ['tenant-uuid-1', 'inventario']
    )
    expect(next).toHaveBeenCalled()
  })

  it('returns 403 when tenant_modules row exists but disabled', async () => {
    query.mockResolvedValueOnce({ rows: [{ enabled: false }] })
    const guard = moduleGuard('surtido')
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(res._status).toBe(403)
    expect(res._body.code).toBe('MODULE_DISABLED')
    expect(next).not.toHaveBeenCalled()
  })

  it('falls back to plans.modules when no tenant_modules row exists', async () => {
    // No row in tenant_modules
    query.mockResolvedValueOnce({ rows: [] })
    // Active subscription with surtido in modules
    query.mockResolvedValueOnce({ rows: [{ modules: ['dropscan', 'surtido'] }] })

    const guard = moduleGuard('surtido')
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('returns 402 when no active subscription found (fallback path)', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    query.mockResolvedValueOnce({ rows: [] })

    const guard = moduleGuard('surtido')
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(res._status).toBe(402)
    expect(res._body.code).toBe('NO_ACTIVE_SUBSCRIPTION')
  })

  it('returns 403 when module not in plan (fallback path)', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    query.mockResolvedValueOnce({ rows: [{ modules: ['dropscan'] }] })

    const guard = moduleGuard('inventario')
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(res._status).toBe(403)
    expect(res._body.code).toBe('MODULE_NOT_INCLUDED')
  })

  it('returns 500 when query throws', async () => {
    query.mockRejectedValueOnce(new Error('DB connection lost'))
    const guard = moduleGuard('dropscan')
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(res._status).toBe(500)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 503 when database is temporarily unavailable', async () => {
    const error = new Error('unable to check out connection from the pool')
    error.code = 'ECHECKOUTTIMEOUT'
    query.mockRejectedValueOnce(error)
    const guard = moduleGuard('dropscan')
    const req = makeReq()
    const res = makeRes()
    const next = vi.fn()

    await guard(req, res, next)

    expect(res._status).toBe(503)
    expect(next).not.toHaveBeenCalled()
  })

  it('serves repeat requests from cache without hitting the database', async () => {
    query.mockResolvedValueOnce({ rows: [{ enabled: true }] })
    const guard = moduleGuard('dropscan')

    await guard(makeReq(), makeRes(), vi.fn())
    const next = vi.fn()
    await guard(makeReq(), makeRes(), next)

    expect(query).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalled()
  })

  it('caches a denial and replays the same status and body', async () => {
    query.mockResolvedValueOnce({ rows: [{ enabled: false }] })
    const guard = moduleGuard('surtido')

    await guard(makeReq(), makeRes(), vi.fn())
    const res = makeRes()
    await guard(makeReq(), res, vi.fn())

    expect(query).toHaveBeenCalledTimes(1)
    expect(res._status).toBe(403)
    expect(res._body.code).toBe('MODULE_DISABLED')
  })

  it('does not cache database errors', async () => {
    const error = new Error('unable to check out connection from the pool')
    error.code = 'ECHECKOUTTIMEOUT'
    query.mockRejectedValueOnce(error)
    query.mockResolvedValueOnce({ rows: [{ enabled: true }] })
    const guard = moduleGuard('dropscan')

    const failed = makeRes()
    await guard(makeReq(), failed, vi.fn())
    const next = vi.fn()
    await guard(makeReq(), makeRes(), next)

    expect(failed._status).toBe(503)
    expect(query).toHaveBeenCalledTimes(2)
    expect(next).toHaveBeenCalled()
  })

  it('caches per tenant and module independently', async () => {
    query.mockResolvedValue({ rows: [{ enabled: true }] })
    const guard = moduleGuard('dropscan')

    await guard(makeReq({ tenantId: 'tenant-a' }), makeRes(), vi.fn())
    await guard(makeReq({ tenantId: 'tenant-b' }), makeRes(), vi.fn())
    await moduleGuard('surtido')(makeReq({ tenantId: 'tenant-a' }), makeRes(), vi.fn())

    expect(query).toHaveBeenCalledTimes(3)
  })
})
