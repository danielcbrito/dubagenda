export function setCache(key: string, data: unknown, ttlMinutes: number) {
  const payload = {
    data,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000
  }
  sessionStorage.setItem(key, JSON.stringify(payload))
}

export function getCache<T>(key: string): T | null {
  const raw = sessionStorage.getItem(key)
  if (!raw) return null
  try {
    const payload = JSON.parse(raw)
    if (Date.now() > payload.expiresAt) {
      sessionStorage.removeItem(key)
      return null
    }
    return payload.data as T
  } catch {
    sessionStorage.removeItem(key)
    return null
  }
}