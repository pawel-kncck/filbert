export const KSEF_ENVIRONMENTS = ['test', 'demo', 'prod'] as const

export type KsefEnvironment = (typeof KSEF_ENVIRONMENTS)[number]

export function isKsefEnvironment(value: unknown): value is KsefEnvironment {
  return KSEF_ENVIRONMENTS.includes(value as KsefEnvironment)
}

export type KsefAuthMethod = 'token' | 'certificate'

export const V2_BASE_URLS: Record<KsefEnvironment, string> = {
  test: 'https://api-test.ksef.mf.gov.pl',
  demo: 'https://api-demo.ksef.mf.gov.pl',
  prod: 'https://api.ksef.mf.gov.pl',
}

export const KSEF_PERMISSION_SCOPES = [
  'InvoiceRead',
  'InvoiceWrite',
  'CredentialsRead',
  'CredentialsManage',
  'Introspection',
  'SubunitManage',
  'EnforcementOperations',
  'VatUeManage',
] as const

export type KsefPermissionScope = (typeof KSEF_PERMISSION_SCOPES)[number]
