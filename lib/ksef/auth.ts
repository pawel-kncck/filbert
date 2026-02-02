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
    body: JSON.stringify({ identifier: nip }),
  })

  const challenge = challengeRes.challenge as string | undefined
  const timestamp = challengeRes.timestamp as string | undefined
  if (!challenge || !timestamp) {
    throw new KsefAuthError('CHALLENGE_FAILED', 'Missing challenge or timestamp in response')
  }

  const timestampMs = new Date(timestamp).getTime()

  // Step 2: Encrypt token
  const publicKeyPem = await getKsefPublicKey(environment)
  const encryptedToken = encryptKsefToken(ksefToken, timestampMs, publicKeyPem)

  // Step 3: Submit encrypted token
  const tokenRes = await fetchJson(`${baseUrl}/v2/auth/ksef-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge,
      identifier: nip,
      encryptedToken,
    }),
  })

  const referenceNumber = tokenRes.referenceNumber as string | undefined
  if (!referenceNumber) {
    throw new KsefAuthError(
      'TOKEN_SUBMIT_FAILED',
      'No referenceNumber returned from auth/ksef-token'
    )
  }

  // Step 4: Poll for auth completion
  const startTime = Date.now()
  while (Date.now() - startTime < AUTH_POLL_TIMEOUT_MS) {
    const statusRes = await fetchJson(`${baseUrl}/v2/auth/${referenceNumber}`, {
      method: 'GET',
    })

    const processingCode = statusRes.processingCode as number | undefined
    if (processingCode === 200) {
      break
    }
    if (processingCode !== 100) {
      throw new KsefAuthError(
        'AUTH_PROCESSING_FAILED',
        `Auth processing failed with code ${processingCode}: ${(statusRes.processingDescription as string) || 'unknown'}`,
        processingCode ?? 0
      )
    }

    await sleep(AUTH_POLL_INTERVAL_MS)
  }

  if (Date.now() - startTime >= AUTH_POLL_TIMEOUT_MS) {
    throw new KsefAuthError('AUTH_TIMEOUT', 'KSeF authentication timed out after 2 minutes')
  }

  // Step 5: Redeem token (one-time call)
  const redeemRes = await fetchJson(`${baseUrl}/v2/auth/token/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referenceNumber }),
  })

  const accessToken = redeemRes.accessToken as string | undefined
  const refreshToken = redeemRes.refreshToken as string | undefined

  if (!accessToken || !refreshToken) {
    throw new KsefAuthError('REDEEM_FAILED', 'Missing accessToken or refreshToken from redeem')
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
    body: JSON.stringify({ identifier: nip }),
  })

  const challenge = challengeRes.challenge as string | undefined
  if (!challenge) {
    throw new KsefAuthError('CHALLENGE_FAILED', 'Missing challenge in response')
  }

  // Step 2-3: Build and sign the InitRequest XML
  const initRequestXml = buildAuthInitRequestXml(challenge, nip)
  const signedXml = signXmlWithXades(initRequestXml, certificatePem, privateKeyPem)

  // Step 4: Submit signed XML
  const certRes = await fetchJson(`${baseUrl}/v2/auth/certificate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
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
  const startTime = Date.now()
  while (Date.now() - startTime < AUTH_POLL_TIMEOUT_MS) {
    const statusRes = await fetchJson(`${baseUrl}/v2/auth/${referenceNumber}`, {
      method: 'GET',
    })

    const processingCode = statusRes.processingCode as number | undefined
    if (processingCode === 200) {
      break
    }
    if (processingCode !== 100) {
      throw new KsefAuthError(
        'AUTH_PROCESSING_FAILED',
        `Auth processing failed with code ${processingCode}: ${(statusRes.processingDescription as string) || 'unknown'}`,
        processingCode ?? 0
      )
    }

    await sleep(AUTH_POLL_INTERVAL_MS)
  }

  if (Date.now() - startTime >= AUTH_POLL_TIMEOUT_MS) {
    throw new KsefAuthError('AUTH_TIMEOUT', 'KSeF authentication timed out after 2 minutes')
  }

  // Step 6: Redeem token (same as token auth)
  const redeemRes = await fetchJson(`${baseUrl}/v2/auth/token/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referenceNumber }),
  })

  const accessToken = redeemRes.accessToken as string | undefined
  const refreshToken = redeemRes.refreshToken as string | undefined

  if (!accessToken || !refreshToken) {
    throw new KsefAuthError('REDEEM_FAILED', 'Missing accessToken or refreshToken from redeem')
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
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
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
