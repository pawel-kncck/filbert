export { GusApiClient } from './api-client'
export { GusApiError } from './errors'
export type { GusErrorCode } from './errors'
export type { GusEnvironment, GusEntityType, GusCompanyData, GusFormattedResult } from './types'
export { formatGusResult } from './format'
export { getCached, setCache } from './cache'

import type { GusEnvironment, GusFormattedResult } from './types'
import { GusApiClient } from './api-client'
import { GusApiError } from './errors'
import { formatGusResult } from './format'
import { getCached, setCache } from './cache'

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
