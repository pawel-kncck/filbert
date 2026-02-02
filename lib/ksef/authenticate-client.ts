import { KsefApiClient } from './api-client'
import { decryptPrivateKey } from './certificate-crypto'
import type { KsefCredentials } from '@/lib/types/database'

/**
 * Creates a KsefApiClient and authenticates using the stored credentials,
 * handling both token-based and certificate-based authentication methods.
 */
export async function authenticateKsefClient(
  credentials: KsefCredentials,
  nip: string
): Promise<KsefApiClient> {
  const client = new KsefApiClient(credentials.environment)

  if (credentials.auth_method === 'certificate') {
    if (!credentials.certificate_pem || !credentials.encrypted_private_key) {
      throw new Error('Certificate credentials are incomplete')
    }

    const privateKeyPem = decryptPrivateKey(credentials.encrypted_private_key)
    await client.authenticateWithCert(nip, credentials.certificate_pem, privateKeyPem)
  } else {
    if (!credentials.token) {
      throw new Error('Token credential is missing')
    }

    await client.authenticate(nip, credentials.token)
  }

  return client
}
