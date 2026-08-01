/**
 * Minimal debug logger for the KSeF integration (`lib/ksef/`).
 *
 * The KSeF auth flow and API client are hard to debug without seeing the wire
 * traffic, but that traffic carries bearer tokens, refresh tokens, encrypted
 * credential material and counterparty PII. This module keeps that tension
 * manageable with two rules:
 *
 * 1. **Verbose tracing is off unless asked for.** {@link ksefDebug} is a no-op
 *    unless `KSEF_DEBUG` is set to a truthy value, so production server logs
 *    stay quiet. `ksefWarn`/`ksefError` always emit — they are operational
 *    signals, not tracing.
 * 2. **Secrets never reach the log, even with debugging on.** `KSEF_DEBUG` is a
 *    verbosity switch, not a "print my tokens" switch. Call sites must pass
 *    secret-bearing values through {@link redactHeaders} or
 *    {@link describeSecret} rather than logging them directly.
 *
 * Enable with `KSEF_DEBUG=1` in `.env.local` (server-side only — never set this
 * in a deployed environment).
 */

/** Header names whose values are redacted before logging, compared case-insensitively. */
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key'])

const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

/**
 * Whether verbose KSeF tracing is enabled via `KSEF_DEBUG`.
 *
 * Read per call rather than cached at module load so tests (and `next dev`
 * reloads) observe env changes without a fresh module instance.
 */
export function isKsefDebugEnabled(): boolean {
  return TRUTHY.has((process.env.KSEF_DEBUG ?? '').trim().toLowerCase())
}

/**
 * Verbose trace output. No-op unless `KSEF_DEBUG` is truthy.
 *
 * @param scope Subsystem tag, e.g. `'KSeF Auth'` — rendered as `[KSeF Auth]`.
 * @param message Human-readable message.
 * @param args Extra values. Must not contain token material; use
 *   {@link redactHeaders} / {@link describeSecret} for anything secret-bearing.
 */
export function ksefDebug(scope: string, message: string, ...args: unknown[]): void {
  if (!isKsefDebugEnabled()) return
  console.log(`[${scope}] ${message}`, ...args)
}

/**
 * Non-fatal problem worth surfacing in production logs. Always emits.
 * Subject to the same no-secrets rule as {@link ksefDebug}.
 */
export function ksefWarn(scope: string, message: string, ...args: unknown[]): void {
  console.warn(`[${scope}] ${message}`, ...args)
}

/**
 * Failure worth surfacing in production logs. Always emits.
 * Subject to the same no-secrets rule as {@link ksefDebug}.
 */
export function ksefError(scope: string, message: string, ...args: unknown[]): void {
  console.error(`[${scope}] ${message}`, ...args)
}

/**
 * Copies a header bag with sensitive values replaced by `'[redacted]'`.
 *
 * Accepts the shapes `RequestInit.headers` can take (plain object, `Headers`,
 * or entry tuples) plus `undefined`, so call sites can pass `init.headers`
 * straight through.
 *
 * Redaction is unconditional — enabling `KSEF_DEBUG` must never turn a bearer
 * token into log output.
 */
export function redactHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}

  const entries =
    headers instanceof Headers
      ? [...headers.entries()]
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers)

  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value,
    ])
  )
}

/**
 * Describes a secret by presence and length only, never by content.
 *
 * Use in place of the `token.substring(0, 30)` idiom: a truncated prefix still
 * discloses part of the secret (and for opaque, non-JWT credentials a
 * meaningful fraction of it), while "is it there, and is it the right sort of
 * size" is what the log is actually needed for.
 *
 * @returns e.g. `'present (1024 chars)'` or `'absent'`.
 */
export function describeSecret(value: string | null | undefined): string {
  return value ? `present (${value.length} chars)` : 'absent'
}
