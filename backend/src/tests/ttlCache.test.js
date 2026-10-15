import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTtlCache } from '../shared/utils/ttlCache.js'

describe('createTtlCache', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns undefined for a missing key', () => {
    const cache = createTtlCache(1000)
    expect(cache.get('a')).toBeUndefined()
  })

  it('returns a stored value before the ttl elapses', () => {
    const cache = createTtlCache(1000)
    cache.set('a', { v: 1 })
    vi.advanceTimersByTime(999)
    expect(cache.get('a')).toEqual({ v: 1 })
  })

  it('expires a value once the ttl elapses', () => {
    const cache = createTtlCache(1000)
    cache.set('a', 1)
    vi.advanceTimersByTime(1000)
    expect(cache.get('a')).toBeUndefined()
  })

  it('evicts the oldest entry when maxEntries is exceeded', () => {
    const cache = createTtlCache(1000, 2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  it('clear removes every entry', () => {
    const cache = createTtlCache(1000)
    cache.set('a', 1)
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
  })

  it('a ttl of 0 disables caching', () => {
    const cache = createTtlCache(0)
    cache.set('a', 1)
    expect(cache.get('a')).toBeUndefined()
  })
})
