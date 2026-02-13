import { encryptKsefToken } from './crypto'
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

  console.log('[KSeF Auth] Challenge response:', JSON.stringify(challengeRes, null, 2))
  console.log('[KSeF Auth] Using timestampMs:', timestampMs)

  if (!challenge || !timestampMs) {
    throw new KsefAuthError('CHALLENGE_FAILED', 'Missing challenge or timestamp in response')
  }

  // Step 2: Encrypt token
  const publicKeyPem = await getKsefPublicKey(environment)
  console.log('[KSeF Auth] Encrypting token with timestamp:', timestampMs)
  const encryptedToken = encryptKsefToken(ksefToken, timestampMs, publicKeyPem)
  console.log('[KSeF Auth] Encrypted token length:', encryptedToken.length)

  // Step 3: Submit encrypted token
  const tokenRequestBody = {
    challenge,
    contextIdentifier: {
      type: 'Nip',
      value: nip,
    },
    encryptedToken,
  }
  console.log('[KSeF Auth] Token request body:', JSON.stringify(tokenRequestBody, null, 2))
  console.log('[KSeF Auth] Posting to:', `${baseUrl}/v2/auth/ksef-token`)

  const tokenRes = await fetchJson(`${baseUrl}/v2/auth/ksef-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokenRequestBody),
  })

  console.log('[KSeF Auth] Token response:', JSON.stringify(tokenRes, null, 2))

  const referenceNumber = tokenRes.referenceNumber as string | undefined
  const authToken = (tokenRes.authenticationToken as { token?: string } | undefined)?.token

  console.log('[KSeF Auth] Reference number:', referenceNumber)
  console.log('[KSeF Auth] Auth token:', authToken ? `${authToken.substring(0, 30)}...` : 'none')

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
  const startTime = Date.now()
  while (Date.now() - startTime < AUTH_POLL_TIMEOUT_MS) {
    const statusRes = await fetchJson(`${baseUrl}/v2/auth/${referenceNumber}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    console.log('[KSeF Auth] Poll response:', JSON.stringify(statusRes, null, 2))

    // Status may be a direct number/string or a nested object { code: 200, ... }
    const rawStatus = statusRes.processingCode ?? statusRes.status ?? statusRes.authenticationStatus
    const processingCode =
      typeof rawStatus === 'object' && rawStatus !== null
        ? (rawStatus as { code?: number | string }).code
        : (rawStatus as number | string | undefined)
    console.log('[KSeF Auth] Processing code:', processingCode)

    // Check for success - might be 200, "200", "completed", etc.
    if (
      processingCode === 200 ||
      processingCode === '200' ||
      processingCode === 'completed' ||
      statusRes.completed === true
    ) {
      console.log('[KSeF Auth] Polling complete!')
      break
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

    // If we get here with an unknown status, log it and break (might already be complete)
    console.log('[KSeF Auth] Unknown status, assuming complete')
    break
  }

  if (Date.now() - startTime >= AUTH_POLL_TIMEOUT_MS) {
    throw new KsefAuthError('AUTH_TIMEOUT', 'KSeF authentication timed out after 2 minutes')
  }

  // Step 5: Redeem token (one-time call, requires Bearer token)
  console.log('[KSeF Auth] Redeeming token for referenceNumber:', referenceNumber)
  const redeemRes = await fetchJson(`${baseUrl}/v2/auth/token/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ referenceNumber }),
  })

  console.log('[KSeF Auth] Redeem response:', JSON.stringify(redeemRes, null, 2))
  console.log('[KSeF Auth] Redeem response keys:', Object.keys(redeemRes))

  // v2 API may return tokens in different formats - check common patterns
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

  console.log(
    '[KSeF Auth] Extracted accessToken:',
    accessToken ? `${accessToken.substring(0, 50)}...` : 'MISSING'
  )
  console.log(
    '[KSeF Auth] Extracted refreshToken:',
    refreshToken ? `${refreshToken.substring(0, 50)}...` : 'MISSING'
  )

  if (!accessToken || !refreshToken) {
    throw new KsefAuthError(
      'REDEEM_FAILED',
      `Missing accessToken or refreshToken from redeem. Response keys: ${Object.keys(redeemRes).join(', ')}`
    )
  }

  // Step 6: Parse JWT exp for expiry
  const accessTokenExpiresAt = parseJwtExpiry(accessToken)

  return { accessToken, refreshToken, accessTokenExpiresAt }
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
  console.log('[KSeF Auth Cert] Unsigned XML:\n', initRequestXml)
  const signedXml = signXmlWithXades(initRequestXml, certificatePem, privateKeyPem)
  console.log('[KSeF Auth Cert] Signed XML:\n', signedXml)

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

  const startTime = Date.now()
  while (Date.now() - startTime < AUTH_POLL_TIMEOUT_MS) {
    const pollHeaders: Record<string, string> = {}
    if (certAuthToken) {
      pollHeaders['Authorization'] = `Bearer ${certAuthToken}`
    }

    const statusRes = await fetchJson(`${baseUrl}/v2/auth/${referenceNumber}`, {
      method: 'GET',
      headers: pollHeaders,
    })

    console.log('[KSeF Auth Cert] Poll response:', JSON.stringify(statusRes, null, 2))

    // Status may be a direct number/string or a nested object { code: 200, ... }
    const rawStatus = statusRes.processingCode ?? statusRes.status ?? statusRes.authenticationStatus
    const processingCode =
      typeof rawStatus === 'object' && rawStatus !== null
        ? (rawStatus as { code?: number | string }).code
        : (rawStatus as number | string | undefined)
    console.log('[KSeF Auth Cert] Processing code:', processingCode)

    if (
      processingCode === 200 ||
      processingCode === '200' ||
      processingCode === 'completed' ||
      statusRes.completed === true
    ) {
      console.log('[KSeF Auth Cert] Polling complete!')
      break
    }

    if (
      processingCode === 100 ||
      processingCode === '100' ||
      processingCode === 'pending' ||
      statusRes.pending === true
    ) {
      await sleep(AUTH_POLL_INTERVAL_MS)
      continue
    }

    console.log('[KSeF Auth Cert] Unknown status, assuming complete')
    break
  }

  if (Date.now() - startTime >= AUTH_POLL_TIMEOUT_MS) {
    throw new KsefAuthError('AUTH_TIMEOUT', 'KSeF authentication timed out after 2 minutes')
  }

  // Step 6: Redeem token (same as token auth)
  const redeemHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (certAuthToken) {
    redeemHeaders['Authorization'] = `Bearer ${certAuthToken}`
  }

  const redeemRes = await fetchJson(`${baseUrl}/v2/auth/token/redeem`, {
    method: 'POST',
    headers: redeemHeaders,
    body: JSON.stringify({ referenceNumber }),
  })

  console.log('[KSeF Auth Cert] Redeem response:', JSON.stringify(redeemRes, null, 2))

  // v2 API may return tokens in different formats — check common patterns
  let accessToken: string | undefined
  let refreshToken: string | undefined

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

  console.log(
    '[KSeF Auth Cert] Extracted accessToken:',
    accessToken ? `${accessToken.substring(0, 50)}...` : 'MISSING'
  )
  console.log(
    '[KSeF Auth Cert] Extracted refreshToken:',
    refreshToken ? `${refreshToken.substring(0, 50)}...` : 'MISSING'
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
  console.log('[KSeF fetchJson] Request URL:', url)
  console.log('[KSeF fetchJson] Request method:', init.method)
  console.log('[KSeF fetchJson] Request headers:', JSON.stringify(init.headers))

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })

  console.log('[KSeF fetchJson] Response status:', response.status)
  console.log(
    '[KSeF fetchJson] Response headers:',
    JSON.stringify(Object.fromEntries(response.headers.entries()))
  )

  if (!response.ok) {
    const body = await response.text()
    console.log('[KSeF fetchJson] Error body:', body)
    console.log('[KSeF fetchJson] Error body length:', body.length)
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
