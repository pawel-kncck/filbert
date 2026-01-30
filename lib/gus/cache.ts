import type { GusFormattedResult } from './types'

type CacheEntry = {
  result: GusFormattedResult
  expiresAt: number
}

const TTL = 24 * 60 * 60 * 1000 // 24 hours
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

const cache = new Map<string, CacheEntry>()
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) {
      cache.delete(key)
    }
  }
}

export function getCached(nip: string): GusFormattedResult | null {
  cleanup()
  const entry = cache.get(nip)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(nip)
    return null
  }
  return entry.result
}

export function setCache(nip: string, result: GusFormattedResult): void {
  cache.set(nip, { result, expiresAt: Date.now() + TTL })
}
