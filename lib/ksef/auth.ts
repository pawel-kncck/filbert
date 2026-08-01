import { encryptKsefToken } from './crypto'
import { ksefDebug, describeSecret, redactHeaders } from './logger'
import { getKsefPublicKey } from './public-key-cache'
import { buildAuthInitRequestXml, signXmlWithXades } from './xades'
import type { KsefEnvironment } from './types'
import { V2_BASE_URLS } from './types'

export type KsefAuthTokens = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
}

export class KsefAuthError extends Error {
  code: string
  statusCode: number

  constructor(code: string, message: string, statusCode: number = 0) {
    super(message)
    this.name = 'KsefAuthError'
    this.code = code
    this.statusCode = statusCode
  }
}

const AUTH_POLL_INTERVAL_MS = 1000
const AUTH_POLL_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes
const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000 // 15 min fallback

/**
 * Implements the 6-step KSeF v2 authentication flow.
 *
 * 1. POST /auth/challenge → challenge + timestamp
 * 2. Encrypt {ksefToken}|{timestampMs} with RSA-OAEP
 * 3. POST /auth/ksef-token with challenge, NIP, encrypted token
 * 4. GET /auth/{referenceNumber} — poll until success
 * 5. POST /auth/token/redeem → accessToken + refreshToken
 * 6. Parse JWT exp claim for expiry
 */
export async function authenticateWithKsef(
  environment: KsefEnvironment,
  nip: string,
  ksefToken: string
): Promise<KsefAuthTokens> {
  const baseUrl = V2_BASE_URLS[environment]

  // Step 1: Get challenge
  const challengeRes = await fetchJson(`${baseUrl}/v2/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextIdentifier: {
        type: 'Nip',
        value: nip,
      },
    }),
  })

  const challenge = challengeRes.challenge as string | undefined
  // API v2 returns timestampMs (Unix ms) directly, fallback to timestamp (ISO string) for compatibility
  const timestampMs =
    (challengeRes.timestampMs as number | undefined) ??
    (challengeRes.timestamp ? new Date(challengeRes.timestamp as string).getTime() : undefined)

  // The challenge itself is a single-use nonce that pairs with the encrypted
  // token below — log its presence and the timestamp, not its value.
  ksefDebug(
    'KSeF Auth',
    'Challenge received:',
    describeSecret(challenge),
    'timestampMs:',
    timestampMs
  )

  if (!challenge || !timestampMs) {
    throw new KsefAuthError('CHALLENGE_FAILED', 'Missing challenge or timestamp in response')
  }

  // Step 2: Encrypt token
  const publicKeyPem = await getKsefPublicKey(environment)
  const encryptedToken = encryptKsefToken(ksefToken, timestampMs, publicKeyPem)
  ksefDebug(
    'KSeF Auth',
    'Encrypted token with timestamp:',
    timestampMs,
    '| ciphertext length:',
    encryptedToken.length
  )

  // Step 3: Submit encrypted token
  const tokenRequestBody = {
    challenge,
    contextIdentifier: {
      type: 'Nip',
      value: nip,
    },
    encryptedToken,
  }
  // Body deliberately not logged: it carries the encrypted token, which is the
  // exact payload KSeF accepts and is replayable until the challenge expires.
  ksefDebug('KSeF Auth', 'Submitting encrypted token to:', `${baseUrl}/v2/auth/ksef-token`)

  const tokenRes = await fetchJson(`${baseUrl}/v2/auth/ksef-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokenRequestBody),
  })

  const referenceNumber = tokenRes.referenceNumber as string | undefined
  const authToken = (tokenRes.authenticationToken as { token?: string } | undefined)?.token

  // authToken is a live bearer credential — report presence, never the value.
  ksefDebug(
    'KSeF Auth',
    'Token accepted. Reference number:',
    referenceNumber,
    '| authenticationToken:',
    describeSecret(authToken)
  )

  if (!referenceNumber) {
    throw new KsefAuthError(
      'TOKEN_SUBMIT_FAILED',
      'No referenceNumber returned from auth/ksef-token'
    )
  }

  if (!authToken) {
    throw new KsefAuthError(
      'TOKEN_SUBMIT_FAILED',
      'No authenticationToken returned from auth/ksef-token'
    )
  }

  // Step 4: Poll for auth completion (requires Bearer token)
  await pollAuthStatus(baseUrl, referenceNumber, authToken, 'KSeF Auth')

  // Steps 5-6: Redeem token (one-time call, requires Bearer token) and parse expiry
  ksefDebug('KSeF Auth', 'Redeeming token for referenceNumber:', referenceNumber)
  return redeemTokens(baseUrl, referenceNumber, authToken, 'KSeF Auth')
}

/**
 * Implements KSeF v2 certificate-based authentication flow.
 *
 * 1. POST /auth/challenge → challenge + timestamp
 * 2. Build InitRequest XML with challenge + NIP
 * 3. Sign XML with XAdES-BES using the qualified certificate
 * 4. POST /auth/certificate with signed XML
 * 5. GET /auth/{referenceNumber} — poll until success
 * 6. POST /auth/token/redeem → accessToken + refreshToken
 */
export async function authenticateWithCertificate(
  environment: KsefEnvironment,
  nip: string,
  certificatePem: string,
  privateKeyPem: string
): Promise<KsefAuthTokens> {
  const baseUrl = V2_BASE_URLS[environment]

  // Step 1: Get challenge (same as token auth)
  const challengeRes = await fetchJson(`${baseUrl}/v2/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contextIdentifier: {
        type: 'Nip',
        value: nip,
      },
    }),
  })

  const challenge = challengeRes.challenge as string | undefined
  if (!challenge) {
    throw new KsefAuthError('CHALLENGE_FAILED', 'Missing challenge in response')
  }

  // Step 2-3: Build and sign the AuthTokenRequest XML
  const initRequestXml = buildAuthInitRequestXml(challenge, nip)
  const signedXml = signXmlWithXades(initRequestXml, certificatePem, privateKeyPem)
  // The signed XML embeds the signing certificate and is a complete, replayable
  // auth artifact for this challenge — only dumped under KSEF_DEBUG, where the
  // exact bytes matter for diagnosing canonicalization problems (see xades.ts).
  ksefDebug('KSeF Auth Cert', 'Unsigned XML:\n', initRequestXml)
  ksefDebug('KSeF Auth Cert', 'Signed XML:\n', signedXml)

  // Step 4: Submit signed XML
  const certRes = await fetchJson(`${baseUrl}/v2/auth/xades-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: signedXml,
  })

  const referenceNumber = certRes.referenceNumber as string | undefined
  if (!referenceNumber) {
    throw new KsefAuthError(
      'CERT_SUBMIT_FAILED',
      'No referenceNumber returned from auth/certificate'
    )
  }

  // Step 5: Poll for auth completion (same as token auth)
  // Note: Certificate auth may also return authenticationToken - extract if present
  const certAuthToken = (certRes.authenticationToken as { token?: string } | undefined)?.token

  await pollAuthStatus(baseUrl, referenceNumber, certAuthToken, 'KSeF Auth Cert')

  // Step 6: Redeem token (same as token auth)
  return redeemTokens(baseUrl, referenceNumber, certAuthToken, 'KSeF Auth Cert')
}

/**
 * Polls GET /auth/{referenceNumber} until the authentication completes.
 * Resolves on success (or unknown status, which may mean already complete);
 * throws AUTH_TIMEOUT after AUTH_POLL_TIMEOUT_MS.
 *
 * @param scope Log scope tag distinguishing token auth from certificate auth.
 */
async function pollAuthStatus(
  baseUrl: string,
  referenceNumber: string,
  bearerToken: string | undefined,
  scope: string
): Promise<void> {
  const headers: Record<string, string> = {}
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`
  }

  const startTime = Date.now()
  while (Date.now() - startTime < AUTH_POLL_TIMEOUT_MS) {
    const statusRes = await fetchJson(`${baseUrl}/v2/auth/${referenceNumber}`, {
      method: 'GET',
      headers,
    })

    // Status may be a direct number/string or a nested object { code: 200, ... }
    const rawStatus = statusRes.processingCode ?? statusRes.status ?? statusRes.authenticationStatus
    const processingCode =
      typeof rawStatus === 'object' && rawStatus !== null
        ? (rawStatus as { code?: number | string }).code
        : (rawStatus as number | string | undefined)
    ksefDebug(scope, 'Poll processing code:', processingCode)

    // Check for success - might be 200, "200", "completed", etc.
    if (
      processingCode === 200 ||
      processingCode === '200' ||
      processingCode === 'completed' ||
      statusRes.completed === true
    ) {
      ksefDebug(scope, 'Polling complete')
      return
    }

    // Check for in-progress
    if (
      processingCode === 100 ||
      processingCode === '100' ||
      processingCode === 'pending' ||
      statusRes.pending === true
    ) {
      await sleep(AUTH_POLL_INTERVAL_MS)
      continue
    }

    // Unknown status: might already be complete
    ksefDebug(scope, 'Unknown status, assuming complete. Processing code:', processingCode)
    return
  }

  throw new KsefAuthError('AUTH_TIMEOUT', 'KSeF authentication timed out after 2 minutes')
}

/**
 * Redeems the one-time token at POST /auth/token/redeem and extracts
 * access/refresh tokens, tolerating the several response shapes the
 * v2 API has been observed to return.
 *
 * @param scope Log scope tag distinguishing token auth from certificate auth.
 */
async function redeemTokens(
  baseUrl: string,
  referenceNumber: string,
  bearerToken: string | undefined,
  scope: string
): Promise<KsefAuthTokens> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`
  }

  const redeemRes = await fetchJson(`${baseUrl}/v2/auth/token/redeem`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ referenceNumber }),
  })

  // The redeem body contains the access and refresh tokens in full — never log
  // it. The shape ambiguity handled below is diagnosable from the key names,
  // which carry no secret.
  ksefDebug(scope, 'Redeem response keys:', Object.keys(redeemRes).join(', '))

  let accessToken: string | undefined
  let refreshToken: string | undefined

  // Try direct string fields first
  if (typeof redeemRes.accessToken === 'string') {
    accessToken = redeemRes.accessToken
  } else if (typeof (redeemRes.accessToken as { token?: string })?.token === 'string') {
    accessToken = (redeemRes.accessToken as { token: string }).token
  } else if (typeof redeemRes.token === 'string') {
    accessToken = redeemRes.token as string
  } else if (typeof (redeemRes.tokens as { access?: string })?.access === 'string') {
    accessToken = (redeemRes.tokens as { access: string }).access
  }

  if (typeof redeemRes.refreshToken === 'string') {
    refreshToken = redeemRes.refreshToken
  } else if (typeof (redeemRes.refreshToken as { token?: string })?.token === 'string') {
    refreshToken = (redeemRes.refreshToken as { token: string }).token
  } else if (typeof (redeemRes.tokens as { refresh?: string })?.refresh === 'string') {
    refreshToken = (redeemRes.tokens as { refresh: string }).refresh
  }

  ksefDebug(
    scope,
    'Extracted accessToken:',
    describeSecret(accessToken),
    '| refreshToken:',
    describeSecret(refreshToken)
  )

  if (!accessToken || !refreshToken) {
    throw new KsefAuthError(
      'REDEEM_FAILED',
      `Missing accessToken or refreshToken from redeem. Response keys: ${Object.keys(redeemRes).join(', ')}`
    )
  }

  const accessTokenExpiresAt = parseJwtExpiry(accessToken)

  return { accessToken, refreshToken, accessTokenExpiresAt }
}

function parseJwtExpiry(jwt: string): Date {
  try {
    const payload = jwt.split('.')[1]
    if (!payload) return new Date(Date.now() + DEFAULT_ACCESS_TOKEN_TTL_MS)
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    if (typeof decoded.exp === 'number') {
      return new Date(decoded.exp * 1000)
    }
  } catch {
    // Fall through to default
  }
  return new Date(Date.now() + DEFAULT_ACCESS_TOKEN_TTL_MS)
}

async function fetchJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  // Poll and redeem calls carry `Authorization: Bearer <token>` — redactHeaders
  // masks it unconditionally, so KSEF_DEBUG never exposes the bearer.
  ksefDebug(
    'KSeF fetchJson',
    `Request: ${init.method} ${url}`,
    '| headers:',
    JSON.stringify(redactHeaders(init.headers))
  )

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })

  ksefDebug(
    'KSeF fetchJson',
    `Response status: ${response.status}`,
    '| headers:',
    JSON.stringify(redactHeaders(response.headers))
  )

  if (!response.ok) {
    const body = await response.text()
    ksefDebug('KSeF fetchJson', `Error body (${body.length} chars):`, body)
    throw new KsefAuthError(
      'AUTH_HTTP_ERROR',
      `KSeF auth request failed: ${response.status} ${response.statusText} — ${body}`,
      response.status
    )
  }

  return response.json()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
