/**
 * Public entry point for GUS REGON company lookups.
 *
 * Import from here rather than reaching into the submodules — `lookupNip`
 * handles session lifecycle and caching, which callers otherwise have to get
 * right themselves.
 *
 * @module
 */
export { GusApiClient } from './api-client'
export { GusApiError, GUS_ERROR_HTTP_STATUS } from './errors'
export type { GusErrorCode } from './errors'
export type { GusEnvironment, GusEntityType, GusCompanyData, GusFormattedResult } from './types'
export { formatGusResult } from './format'
export { getCached, setCache } from './cache'

import type { GusEnvironment, GusFormattedResult } from './types'
import { GusApiClient } from './api-client'
import { GusApiError } from './errors'
import { formatGusResult } from './format'
import { getCached, setCache } from './cache'

/**
 * Looks up a company in the GUS registry by NIP.
 *
 * Serves from the in-process cache when warm; otherwise runs the full sequence
 * — login → search → full report → logout — and caches the formatted result.
 * The session is closed in a `finally`, and a failing logout is swallowed so it
 * cannot mask the real error or discard a successful lookup.
 *
 * @param nip Polish tax ID, 10 digits, no separators. Validate before calling —
 *   this does not check the checksum.
 * @param apiKey GUS user key, from `GUS_API_KEY`.
 * @param environment `'test'` or `'prod'`, from `GUS_ENVIRONMENT`.
 * @throws {GusApiError} `NOT_FOUND` when the NIP is unknown or has no detailed
 *   record; other codes for auth, connectivity and parse failures. Each carries
 *   a `statusCode` for the route to return — see `GUS_ERROR_HTTP_STATUS`.
 */
export async function lookupNip(
  nip: string,
  apiKey: string,
  environment: GusEnvironment
): Promise<GusFormattedResult> {
  const cached = getCached(nip)
  if (cached) return cached

  const client = new GusApiClient(environment)

  try {
    await client.login(apiKey)

    const searchResult = await client.searchByNip(nip)
    if (!searchResult) {
      throw new GusApiError('NOT_FOUND', `No company found for NIP ${nip}`, 404)
    }

    const report = await client.getFullReport(searchResult.regon, searchResult.entityType)
    if (!report) {
      throw new GusApiError('NOT_FOUND', `No detailed data found for NIP ${nip}`, 404)
    }

    const formatted = formatGusResult(report)
    setCache(nip, formatted)

    return formatted
  } finally {
    await client.logout().catch(() => {})
  }
}
