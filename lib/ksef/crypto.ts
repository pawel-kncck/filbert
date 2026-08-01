import { publicEncrypt, constants, createHash, X509Certificate } from 'node:crypto'

import { ksefDebug, describeSecret } from './logger'

/**
 * Encrypts a KSeF authorization token with RSA-OAEP for the v2 auth flow.
 * Plaintext format: `{token}|{timestampMs}` encoded as UTF-8.
 *
 * @param token The raw KSeF authorization token. This is the long-lived
 *   user-supplied credential (stored encrypted at rest) — it must never be
 *   logged, not even truncated.
 */
export function encryptKsefToken(token: string, timestampMs: number, publicKeyPem: string): string {
  // Format: token|timestamp (standard KSeF format)
  const plaintext = Buffer.from(`${token}|${timestampMs}`, 'utf-8')
  ksefDebug(
    'KSeF Crypto',
    'Encrypting token:',
    describeSecret(token),
    '| timestampMs:',
    timestampMs,
    '| plaintext length:',
    plaintext.length
  )

  // KSeF uses RSA-OAEP with SHA-256
  const encrypted = publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    plaintext
  )

  const result = encrypted.toString('base64')
  ksefDebug('KSeF Crypto', 'Ciphertext length:', result.length)
  return result
}

/**
 * SHA-256 of UTF-8 content as unpadded base64url — the hash format
 * KSeF invoice QR codes expect.
 */
export function sha256Base64Url(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('base64url')
}

/**
 * Extracts a public key PEM from an X.509 certificate PEM.
 */
export function extractPublicKeyFromCert(pemCertificate: string): string {
  const cert = new X509Certificate(pemCertificate)
  // cert.publicKey is already a KeyObject, export it directly as PEM
  return cert.publicKey.export({ type: 'spki', format: 'pem' }) as string
}
