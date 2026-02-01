import { publicEncrypt, constants, X509Certificate, createPublicKey } from 'node:crypto'

/**
 * Encrypts a KSeF authorization token with RSA-OAEP for the v2 auth flow.
 * Plaintext format: `{token}|{timestampMs}` encoded as UTF-8.
 */
export function encryptKsefToken(token: string, timestampMs: number, publicKeyPem: string): string {
  const plaintext = Buffer.from(`${token}|${timestampMs}`, 'utf-8')

  const encrypted = publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    plaintext
  )

  return encrypted.toString('base64')
}

/**
 * Extracts a public key PEM from an X.509 certificate PEM.
 */
export function extractPublicKeyFromCert(pemCertificate: string): string {
  const cert = new X509Certificate(pemCertificate)
  const pubKey = createPublicKey(cert.publicKey)
  return pubKey.export({ type: 'spki', format: 'pem' }) as string
}
