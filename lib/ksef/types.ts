export type KsefEnvironment = 'test' | 'demo' | 'prod'

export type KsefAuthMethod = 'token' | 'certificate'

export const V2_BASE_URLS: Record<KsefEnvironment, string> = {
  test: 'https://api-test.ksef.mf.gov.pl',
  demo: 'https://api-demo.ksef.mf.gov.pl',
  prod: 'https://api.ksef.mf.gov.pl',
}
