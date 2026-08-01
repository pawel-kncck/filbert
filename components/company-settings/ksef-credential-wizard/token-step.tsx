'use client'

import { useTranslations } from 'next-intl'

import { EnvironmentSelector, SecretField } from './fields'
import type { KsefEnvironment } from './types'

/** Step 2a — configure a KSeF API token. */
export function TokenStep({
  token,
  onTokenChange,
  environment,
  onEnvironmentChange,
}: {
  token: string
  onTokenChange: (value: string) => void
  environment: KsefEnvironment
  onEnvironmentChange: (value: KsefEnvironment) => void
}) {
  const t = useTranslations('companySettings.ksef')

  return (
    <div className="space-y-4 py-4">
      <SecretField
        id="ksef-token"
        label={t('token')}
        placeholder={t('tokenPlaceholder')}
        value={token}
        onChange={onTokenChange}
      />
      <EnvironmentSelector environment={environment} onChange={onEnvironmentChange} />
    </div>
  )
}
