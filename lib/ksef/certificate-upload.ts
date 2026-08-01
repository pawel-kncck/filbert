import { parsePkcs12, parsePemCertificate, CertificateError } from './certificate-crypto'

/**
 * Fields of the multipart certificate-upload form shared by the
 * save and validate credential endpoints. Fields not sent by a given
 * caller are null/undefined.
 */
export type CertificateUploadFields = {
  certificateFormat: 'pkcs12' | 'pem'
  environment: string | null
  name: string | null
  validationStatus: string | null
  validationError: string | null
  grantedPermissions: string[] | undefined
}

export type CertificateUploadResult =
  | ({ ok: true; certificatePem: string; privateKeyPem: string } & CertificateUploadFields)
  | {
      ok: false
      reason: 'bad_request' | 'config_error' | 'parse_error'
      message: string
      code?: string
    }

/**
 * Extracts and validates the certificate-upload form fields, then parses the
 * uploaded PKCS#12 or PEM material into certificate + private key PEM strings.
 *
 * Returns a discriminated result instead of an HTTP response so callers decide
 * response shaping:
 * - `bad_request` — missing file/password/key file
 * - `config_error` — server missing KSEF_CERTIFICATE_ENCRYPTION_KEY
 * - `parse_error` — certificate/key could not be parsed (`code` set for CertificateError)
 *
 * The returned private key is plaintext PEM; callers that persist it must
 * encrypt it with `encryptPrivateKey` from certificate-crypto.
 */
export async function parseCertificateUpload(formData: FormData): Promise<CertificateUploadResult> {
  const certificateFile = formData.get('certificate') as File | null
  const certificateFormat = ((formData.get('certificateFormat') as string) || 'pkcs12') as
    | 'pkcs12'
    | 'pem'
  const password = formData.get('certificatePassword') as string | null
  const privateKeyPassword = formData.get('privateKeyPassword') as string | null
  const privateKeyFile = formData.get('privateKey') as File | null

  const fields: CertificateUploadFields = {
    certificateFormat,
    environment: formData.get('environment') as string | null,
    name: formData.get('name') as string | null,
    validationStatus: formData.get('validationStatus') as string | null,
    validationError: formData.get('validationError') as string | null,
    grantedPermissions: parseGrantedPermissions(
      formData.get('grantedPermissions') as string | null
    ),
  }

  if (!certificateFile) {
    return { ok: false, reason: 'bad_request', message: 'Certificate file is required' }
  }

  if (certificateFormat === 'pkcs12' && !password) {
    return {
      ok: false,
      reason: 'bad_request',
      message: 'Certificate password is required for PKCS#12 files',
    }
  }

  if (certificateFormat === 'pem' && !privateKeyFile) {
    return {
      ok: false,
      reason: 'bad_request',
      message: 'Private key file is required for PEM format',
    }
  }

  try {
    if (certificateFormat === 'pem') {
      // Parse PEM format (separate certificate and private key files)
      const certContent = await certificateFile.text()
      const keyContent = await privateKeyFile!.text()
      const parsed = parsePemCertificate(certContent, keyContent, privateKeyPassword || undefined)
      return {
        ok: true,
        ...fields,
        certificatePem: parsed.certificatePem,
        privateKeyPem: parsed.privateKeyPem,
      }
    }
    // Parse PKCS#12 format
    const buffer = Buffer.from(await certificateFile.arrayBuffer())
    const parsed = parsePkcs12(buffer, password!)
    return {
      ok: true,
      ...fields,
      certificatePem: parsed.certificatePem,
      privateKeyPem: parsed.privateKeyPem,
    }
  } catch (err) {
    if (err instanceof CertificateError) {
      if (err.code === 'MISSING_ENCRYPTION_KEY') {
        return {
          ok: false,
          reason: 'config_error',
          message: 'Server is not configured for certificate authentication',
        }
      }
      return { ok: false, reason: 'parse_error', message: err.message, code: err.code }
    }
    return {
      ok: false,
      reason: 'parse_error',
      message:
        certificateFormat === 'pem'
          ? 'Failed to parse certificate or private key file.'
          : 'Failed to parse certificate file. Check the file and password.',
    }
  }
}

function parseGrantedPermissions(raw: string | null): string[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}
