'use client'

import { useTranslations } from 'next-intl'

import { Label } from '@/components/ui/label'
import { CertificateFileField, EnvironmentSelector, SecretField } from './fields'
import type { CertificateFormat, KsefEnvironment } from './types'

type Props = {
  format: CertificateFormat
  onFormatChange: (format: CertificateFormat) => void
  password: string
  onPasswordChange: (value: string) => void
  onCertificateFileChange: (file: File | null) => void
  onPrivateKeyFileChange: (file: File | null) => void
  certificateInputRef: React.RefObject<HTMLInputElement | null>
  privateKeyInputRef: React.RefObject<HTMLInputElement | null>
  environment: KsefEnvironment
  onEnvironmentChange: (value: KsefEnvironment) => void
}

/**
 * Step 2b — configure certificate authentication, in either PKCS#12 (one
 * password-protected bundle) or PEM (separate cert and key files) form.
 */
export function CertificateStep({
  format,
  onFormatChange,
  password,
  onPasswordChange,
  onCertificateFileChange,
  onPrivateKeyFileChange,
  certificateInputRef,
  privateKeyInputRef,
  environment,
  onEnvironmentChange,
}: Props) {
  const t = useTranslations('companySettings.ksef')

  return (
    <div className="space-y-4 py-4">
      <div>
        <Label>{t('certificateFormatLabel')}</Label>
        <div className="mt-2 flex gap-4">
          <FormatRadio
            value="pkcs12"
            checked={format === 'pkcs12'}
            label={t('formatPkcs12')}
            onSelect={onFormatChange}
          />
          <FormatRadio
            value="pem"
            checked={format === 'pem'}
            label={t('formatPem')}
            onSelect={onFormatChange}
          />
        </div>
      </div>

      {format === 'pkcs12' ? (
        <>
          <CertificateFileField
            id="ksef-certificate"
            label={t('certificateFile')}
            hint={t('certificateFileHint')}
            accept=".p12,.pfx"
            inputRef={certificateInputRef}
            onChange={onCertificateFileChange}
          />
          <SecretField
            id="ksef-cert-password"
            label={t('certificatePassword')}
            placeholder={t('certificatePasswordPlaceholder')}
            value={password}
            onChange={onPasswordChange}
          />
        </>
      ) : (
        <>
          <CertificateFileField
            id="ksef-certificate-pem"
            label={t('certificateFilePem')}
            hint={t('certificateFilePemHint')}
            accept=".crt,.pem,.cer"
            inputRef={certificateInputRef}
            onChange={onCertificateFileChange}
          />
          <CertificateFileField
            id="ksef-private-key"
            label={t('privateKeyFile')}
            hint={t('privateKeyFileHint')}
            accept=".key,.pem"
            inputRef={privateKeyInputRef}
            onChange={onPrivateKeyFileChange}
          />
          <SecretField
            id="ksef-pem-password"
            label={t('privateKeyPassword')}
            placeholder={t('privateKeyPasswordPlaceholder')}
            hint={t('privateKeyPasswordHint')}
            value={password}
            onChange={onPasswordChange}
          />
        </>
      )}

      <EnvironmentSelector environment={environment} onChange={onEnvironmentChange} />
    </div>
  )
}

function FormatRadio({
  value,
  checked,
  label,
  onSelect,
}: {
  value: CertificateFormat
  checked: boolean
  label: string
  onSelect: (format: CertificateFormat) => void
}) {
  return (
    <Label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        type="radio"
        name="certFormat"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="text-blue-600 focus:ring-blue-500"
      />
      {label}
    </Label>
  )
}
