import { publicEncrypt, constants, X509Certificate } from 'node:crypto'

/**
 * Encrypts a KSeF authorization token with RSA-OAEP for the v2 auth flow.
 * Plaintext format: `{token}|{timestampMs}` encoded as UTF-8.
 */
export function encryptKsefToken(token: string, timestampMs: number, publicKeyPem: string): string {
  // Format: token|timestamp (standard KSeF format)
  const plaintext = Buffer.from(`${token}|${timestampMs}`, 'utf-8')
  console.log('[KSeF Crypto] Plaintext format:', `${token.substring(0, 10)}...|${timestampMs}`)
  console.log('[KSeF Crypto] Plaintext length:', plaintext.length)

  console.log('[KSeF Crypto] Public key starts with:', publicKeyPem.substring(0, 60))

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
  console.log('[KSeF Crypto] Encrypted result starts with:', result.substring(0, 40))
  return result
}

/**
 * Extracts a public key PEM from an X.509 certificate PEM.
 */
export function extractPublicKeyFromCert(pemCertificate: string): string {
  const cert = new X509Certificate(pemCertificate)
  // cert.publicKey is already a KeyObject, export it directly as PEM
  return cert.publicKey.export({ type: 'spki', format: 'pem' }) as string
}
