import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto'
import forge from 'node-forge'

export type ParsedCertificate = {
  certificatePem: string
  privateKeyPem: string
  commonName: string | null
  notAfter: Date
}

/**
 * Parses a PKCS#12 (.p12/.pfx) file and extracts the certificate and private key.
 */
export function parsePkcs12(p12Buffer: Buffer, password: string): ParsedCertificate {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString('binary')))
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

  // Extract certificate
  const certBagType = forge.pki.oids.certBag as string
  const certBags = p12.getBags({ bagType: certBagType })
  const certBagArr = certBags[certBagType]
  if (!certBagArr || certBagArr.length === 0 || !certBagArr[0]?.cert) {
    throw new CertificateError('NO_CERTIFICATE', 'No certificate found in PKCS#12 file')
  }
  const cert = certBagArr[0].cert

  // Extract private key
  const shroudedKeyBagType = forge.pki.oids.pkcs8ShroudedKeyBag
  const keyBags = p12.getBags({ bagType: shroudedKeyBagType })
  let privateKey = keyBags[shroudedKeyBagType as string]?.[0]?.key

  if (!privateKey) {
    const keyBagType = forge.pki.oids.keyBag
    const keyBags2 = p12.getBags({ bagType: keyBagType })
    privateKey = keyBags2[keyBagType as string]?.[0]?.key
  }

  if (!privateKey) {
    throw new CertificateError('NO_PRIVATE_KEY', 'No private key found in PKCS#12 file')
  }

  const certificatePem = forge.pki.certificateToPem(cert)
  const privateKeyPem = forge.pki.privateKeyToPem(privateKey)

  const cn = cert.subject.getField('CN')
  const commonName = cn ? String(cn.value) : null
  const notAfter = cert.validity.notAfter

  return { certificatePem, privateKeyPem, commonName, notAfter }
}

/**
 * Encrypts a private key PEM string using AES-256-GCM with the server-side encryption key.
 * Returns format: {iv_base64}:{auth_tag_base64}:{ciphertext_base64}
 */
export function encryptPrivateKey(privateKeyPem: string): string {
  const encryptionKey = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)

  let encrypted = cipher.update(privateKeyPem, 'utf-8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypts a private key from the stored encrypted format.
 */
export function decryptPrivateKey(encryptedData: string): string {
  const encryptionKey = getEncryptionKey()
  const parts = encryptedData.split(':')

  if (parts.length !== 3) {
    throw new CertificateError(
      'INVALID_ENCRYPTED_FORMAT',
      'Encrypted private key has invalid format'
    )
  }

  const [ivStr, authTagStr, ciphertext] = parts

  const iv = Buffer.from(ivStr!, 'base64')
  const authTag = Buffer.from(authTagStr!, 'base64')

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv)
  decipher.setAuthTag(authTag)

  let decrypted: string = decipher.update(ciphertext!, 'base64', 'utf-8')
  decrypted += decipher.final('utf-8')

  return decrypted
}

/**
 * Derives a 32-byte AES key from the KSEF_CERTIFICATE_ENCRYPTION_KEY env variable.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.KSEF_CERTIFICATE_ENCRYPTION_KEY
  if (!envKey) {
    throw new CertificateError(
      'MISSING_ENCRYPTION_KEY',
      'KSEF_CERTIFICATE_ENCRYPTION_KEY environment variable is required for certificate authentication'
    )
  }

  // Derive a consistent 32-byte key using SHA-256
  return createHash('sha256').update(envKey).digest()
}

export class CertificateError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CertificateError'
    this.code = code
  }
}
