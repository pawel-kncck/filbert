'use client'

import { useTranslations } from 'next-intl'
import { CheckCircleIcon, XCircleIcon, LoaderIcon } from 'lucide-react'

import type { AuthMethod, KsefEnvironment, VerifyResult } from './types'

/** Step 3 — the credentials are being checked against KSeF. */
export function VerifyingStep({ environment }: { environment: KsefEnvironment }) {
  const t = useTranslations('companySettings.ksef')

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <LoaderIcon className="h-8 w-8 animate-spin text-blue-600" />
      <div className="text-center">
        <p className="font-medium text-zinc-900 dark:text-white">{t('modal.verifying')}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('modal.connectingTo')} ({t(`environments.${environment}`)})
        </p>
      </div>
    </div>
  )
}

/** Step 4 — outcome of the verify-and-save round trip. */
export function ResultStep({
  result,
  environment,
  authMethod,
}: {
  result: VerifyResult
  environment: KsefEnvironment
  authMethod: AuthMethod | null
}) {
  const t = useTranslations('companySettings.ksef')

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      {result.success ? (
        <>
          <CheckCircleIcon className="h-12 w-12 text-green-600" />
          <div className="text-center">
            <p className="font-medium text-zinc-900 dark:text-white">{t('modal.success')}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('environment')}: {t(`environments.${environment}`)}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('table.type')}: {authMethod && t(`authMethods.${authMethod}`)}
            </p>
          </div>
        </>
      ) : (
        <>
          <XCircleIcon className="h-12 w-12 text-red-600" />
          <div className="text-center">
            <p className="font-medium text-zinc-900 dark:text-white">{t('testFailed')}</p>
            {result.message && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{result.message}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
