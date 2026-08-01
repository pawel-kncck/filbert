/**
 * Error taxonomy for GUS lookups and its mapping onto HTTP statuses.
 *
 * @module
 */

/**
 * Failure modes of a GUS lookup.
 *
 * `NOT_FOUND` and `INVALID_NIP` are the caller's problem; `AUTH_FAILED`,
 * `SESSION_FAILED` and `CONNECTION_ERROR` mean the registry is unusable right
 * now; `PARSE_ERROR` and `API_ERROR` mean it answered unusably.
 */
export type GusErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_NIP'
  | 'RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'SESSION_FAILED'
  | 'CONNECTION_ERROR'
  | 'PARSE_ERROR'
  | 'API_ERROR'

/** HTTP status to return to our API clients for each GUS error code. */
export const GUS_ERROR_HTTP_STATUS: Record<GusErrorCode, number> = {
  NOT_FOUND: 404,
  INVALID_NIP: 400,
  RATE_LIMITED: 429,
  AUTH_FAILED: 503,
  SESSION_FAILED: 503,
  CONNECTION_ERROR: 503,
  PARSE_ERROR: 502,
  API_ERROR: 502,
}

/**
 * Error carrying a {@link GusErrorCode} and the HTTP status a route should
 * return for it.
 *
 * `statusCode` is passed explicitly rather than derived, so a call site can
 * deviate; {@link GUS_ERROR_HTTP_STATUS} is the default mapping.
 */
export class GusApiError extends Error {
  code: GusErrorCode
  statusCode: number

  constructor(code: GusErrorCode, message: string, statusCode: number) {
    super(message)
    this.name = 'GusApiError'
    this.code = code
    this.statusCode = statusCode
  }
}
