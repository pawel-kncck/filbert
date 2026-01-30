export type GusErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_NIP'
  | 'RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'SESSION_FAILED'
  | 'CONNECTION_ERROR'
  | 'PARSE_ERROR'
  | 'API_ERROR'

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
