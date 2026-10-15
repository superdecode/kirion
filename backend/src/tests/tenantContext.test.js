import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../config/database.js', () => ({
  isDatabaseUnavailableError: vi.fn((error) => error?.code === 'ECHECKOUTTIMEOUT'),
  query: vi.fn(),
}))

vi.mock('../config/env.js', () => ({
  default: { NODE_ENV: 'production', TENANT_BASE_DOMAIN: 'kirion.co', LEGACY_TENANT_ID: '' },
}))

const { query } = await import('../config/database.js')
const { tenantContext, clearTenantCache } = await import('../modules/middleware/tenantContext.js')

const TENANT = {
  id: 'tenant-uuid-1',
  slug: 'upapex',
  status: 'active',
  trial_expires_at: null,
  subscription_expires_at: null,
  current_plan_id: null,
}

function makeReq(host = 'upapex.kirion.co') {
  return { headers: { host } }
}

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this },
    json(body) { this._body = body; return this },
  }
}

describe('tenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    query.mockReset()
    clearTenantCache()
  })

  it('resolves the tenant from the subdomain and calls next', async () => {
    query.mockResolvedValueOnce({ rows: [TENANT] })
    const req = makeReq()
    const next = vi.fn()

    await tenantContext(req, makeRes(), next)

    expect(req.tenantId).toBe('tenant-uuid-1')
    expect(req.tenantReadOnly).toBe(false)
    expect(next).toHaveBeenCalled()
  })

  it('serves repeat requests for the same tenant from cache', async () => {
    query.mockResolvedValueOnce({ rows: [TENANT] })

    await tenantContext(makeReq(), makeRes(), vi.fn())
    const req = makeReq()
    const next = vi.fn()
    await tenantContext(req, makeRes(), next)

    expect(query).toHaveBeenCalledTimes(1)
    expect(req.tenantId).toBe('tenant-uuid-1')
    expect(next).toHaveBeenCalled()
  })

  it('shares a frozen tenant object so a mutation cannot poison the cache', async () => {
    query.mockResolvedValueOnce({ rows: [TENANT] })
    const req = makeReq()

    await tenantContext(req, makeRes(), vi.fn())

    expect(Object.isFrozen(req.tenant)).toBe(true)
    expect(() => { req.tenant.status = 'suspended' }).toThrow(TypeError)
  })

  it('does not cache a missing tenant', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    query.mockResolvedValueOnce({ rows: [TENANT] })

    const missing = makeRes()
    await tenantContext(makeReq(), missing, vi.fn())
    const next = vi.fn()
    await tenantContext(makeReq(), makeRes(), next)

    expect(missing._status).toBe(404)
    expect(query).toHaveBeenCalledTimes(2)
    expect(next).toHaveBeenCalled()
  })

  it('blocks a suspended tenant, including when served from cache', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...TENANT, status: 'suspended' }] })

    const first = makeRes()
    await tenantContext(makeReq(), first, vi.fn())
    const second = makeRes()
    const next = vi.fn()
    await tenantContext(makeReq(), second, next)

    expect(first._status).toBe(403)
    expect(second._status).toBe(403)
    expect(query).toHaveBeenCalledTimes(1)
    expect(next).not.toHaveBeenCalled()
  })

  it('marks an expired tenant as read-only', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...TENANT, status: 'trial_expired' }] })
    const req = makeReq()

    await tenantContext(req, makeRes(), vi.fn())

    expect(req.tenantReadOnly).toBe(true)
  })

  it('returns 503 and does not cache when the database is unavailable', async () => {
    const error = new Error('unable to check out connection from the pool')
    error.code = 'ECHECKOUTTIMEOUT'
    query.mockRejectedValueOnce(error)
    query.mockResolvedValueOnce({ rows: [TENANT] })

    const failed = makeRes()
    await tenantContext(makeReq(), failed, vi.fn())
    const next = vi.fn()
    await tenantContext(makeReq(), makeRes(), next)

    expect(failed._status).toBe(503)
    expect(next).toHaveBeenCalled()
  })

  it('returns 400 when no tenant can be identified', async () => {
    const res = makeRes()

    await tenantContext(makeReq('kirion.co'), res, vi.fn())

    expect(res._status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})
