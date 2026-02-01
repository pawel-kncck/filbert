import { X509Certificate } from 'node:crypto'
import { extractPublicKeyFromCert } from './crypto'
import type { KsefEnvironment } from './types'
import { V2_BASE_URLS } from './types'

type CachedCert = {
  publicKeyPem: string
  fetchedAt: number
  notAfter: Date
}

const cache = new Map<KsefEnvironment, CachedCert>()

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CERT_EXPIRY_BUFFER_MS = 24 * 60 * 60 * 1000 // 1 day before NotAfter

/**
 * Fetches and caches the KSeF token encryption public key.
 * Refreshes when: no cache, cache >24h old, or cert NotAfter within 1 day.
 */
export async function getKsefPublicKey(environment: KsefEnvironment): Promise<string> {
  const cached = cache.get(environment)
  const now = Date.now()

  if (cached) {
    const cacheAge = now - cached.fetchedAt
    const certExpiresIn = cached.notAfter.getTime() - now
    // Add 0-5 min jitter to avoid thundering herd
    const jitter = Math.random() * 5 * 60 * 1000

    if (cacheAge < CACHE_TTL_MS && certExpiresIn > CERT_EXPIRY_BUFFER_MS + jitter) {
      return cached.publicKeyPem
    }
  }

  const baseUrl = V2_BASE_URLS[environment]
  const response = await fetch(`${baseUrl}/v2/security/public-key-certificates`)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch KSeF public key certificates (${environment}): ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  const certs: Array<{ pem: string; usage: string }> = data.certificates || data

  const tokenCert = certs.find((c) => c.usage === 'KsefTokenEncryption')

  if (!tokenCert) {
    throw new Error(`No KsefTokenEncryption certificate found for environment: ${environment}`)
  }

  const pemCertificate = tokenCert.pem
  const publicKeyPem = extractPublicKeyFromCert(pemCertificate)
  const x509 = new X509Certificate(pemCertificate)
  const notAfter = new Date(x509.validTo)

  cache.set(environment, {
    publicKeyPem,
    fetchedAt: Date.now(),
    notAfter,
  })

  return publicKeyPem
}
