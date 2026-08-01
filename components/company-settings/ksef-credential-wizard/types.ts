import type { KsefEnvironment } from '@/lib/ksef/types'

export type AuthMethod = 'token' | 'certificate'
export type CertificateFormat = 'pkcs12' | 'pem'
export type WizardStep = 'select-type' | 'configure' | 'verifying' | 'result'

export type VerifyResult = { success: boolean; message?: string }

export type { KsefEnvironment }
