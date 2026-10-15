// Per-instance in-memory cache with a fixed TTL. A ttlMs of 0 disables it.
export function createTtlCache(ttlMs, maxEntries = 500) {
  const store = new Map()

  return {
    get(key) {
      const entry = store.get(key)
      if (!entry) return undefined
      if (Date.now() - entry.at >= ttlMs) {
        store.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key, value) {
      if (ttlMs <= 0) return
      store.delete(key)
      store.set(key, { value, at: Date.now() })
      if (store.size > maxEntries) store.delete(store.keys().next().value)
    },
    clear() {
      store.clear()
    },
  }
}
