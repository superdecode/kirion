import { describe, it, expect, vi } from 'vitest'
import { isRetryablePesoError, saveGuiaPesoResilient } from './pesoSync'

const httpErr = (status) => Object.assign(new Error('x'), { response: { status } })
const netErr = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })

describe('isRetryablePesoError', () => {
  it('retries network, timeout, 429 and 5xx', () => {
    expect(isRetryablePesoError(netErr())).toBe(true)
    expect(isRetryablePesoError(Object.assign(new Error('t'), { code: 'ECONNABORTED' }))).toBe(true)
    expect(isRetryablePesoError(httpErr(503))).toBe(true)
    expect(isRetryablePesoError(httpErr(500))).toBe(true)
    expect(isRetryablePesoError(httpErr(429))).toBe(true)
  })
  it('does not retry definitive client errors', () => {
    expect(isRetryablePesoError(httpErr(400))).toBe(false)
    expect(isRetryablePesoError(httpErr(404))).toBe(false)
  })
})

describe('saveGuiaPesoResilient', () => {
  const base = { sessionId: 1, guiaId: 9, pesoKg: 2.5 }
  const sleep = vi.fn().mockResolvedValue()

  it('returns saved on first success', async () => {
    const send = vi.fn().mockResolvedValue({})
    const enqueue = vi.fn()
    expect(await saveGuiaPesoResilient(base, { send, enqueue, sleep, isOffline: () => false })).toBe('saved')
    expect(enqueue).not.toHaveBeenCalled()
  })
  it('retries a 503 and then succeeds', async () => {
    const send = vi.fn().mockRejectedValueOnce(httpErr(503)).mockResolvedValue({})
    const enqueue = vi.fn()
    expect(await saveGuiaPesoResilient(base, { send, enqueue, sleep, isOffline: () => false })).toBe('saved')
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('queues the weight after retries are exhausted', async () => {
    const send = vi.fn().mockRejectedValue(httpErr(503))
    const enqueue = vi.fn()
    expect(await saveGuiaPesoResilient(base, { send, enqueue, sleep, isOffline: () => false })).toBe('queued')
    expect(send).toHaveBeenCalledTimes(3)
    expect(enqueue).toHaveBeenCalledWith({ type: 'dropscan_peso_update', payload: { sessionId: 1, guiaId: 9, pesoKg: 2.5 } })
  })
  it('queues immediately without calling the API when offline', async () => {
    const send = vi.fn()
    const enqueue = vi.fn()
    expect(await saveGuiaPesoResilient(base, { send, enqueue, sleep, isOffline: () => true })).toBe('queued')
    expect(send).not.toHaveBeenCalled()
  })
  it('reports rejected (no queue) on a definitive 404', async () => {
    const send = vi.fn().mockRejectedValue(httpErr(404))
    const enqueue = vi.fn()
    expect(await saveGuiaPesoResilient(base, { send, enqueue, sleep, isOffline: () => false })).toBe('rejected')
    expect(enqueue).not.toHaveBeenCalled()
  })
})
