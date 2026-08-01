/**
 * In-process NIP → company cache for GUS lookups.
 *
 * Registry data changes rarely, and GUS meters requests, so results are held
 * for a day. Deliberately process-local and unbounded in size: entries are
 * small, the key space is the set of NIPs a deployment actually looks up, and
 * expired entries are swept lazily.
 *
 * Being per-process, each server instance keeps its own copy and a restart
 * empties it — acceptable for a read-through cache over public reference data.
 * A shared cache would be the answer if lookup volume ever approached the GUS
 * rate limit.
 *
 * @module
 */
import type { GusFormattedResult } from './types'

type CacheEntry = {
  result: GusFormattedResult
  /** Epoch ms; the entry is stale once `Date.now()` passes this. */
  expiresAt: number
}

const TTL = 24 * 60 * 60 * 1000 // 24 hours
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

const cache = new Map<string, CacheEntry>()
let lastCleanup = Date.now()

/**
 * Sweeps expired entries, at most once per {@link CLEANUP_INTERVAL}.
 *
 * Piggybacks on reads rather than running on a timer, so an idle process holds
 * no interval handle. Reads also check expiry individually, so a stale entry is
 * never served just because the sweep has not run.
 */
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

/**
 * Returns the cached result for a NIP, or `null` if absent or expired.
 * An expired entry is dropped on the way out.
 */
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

/** Caches a lookup result for 24 hours, replacing any existing entry. */
export function setCache(nip: string, result: GusFormattedResult): void {
  cache.set(nip, { result, expiresAt: Date.now() + TTL })
}
