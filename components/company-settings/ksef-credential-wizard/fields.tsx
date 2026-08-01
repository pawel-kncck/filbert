'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Input, SelectInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormField } from '@/components/ui/form-field'
import type { KsefEnvironment } from './types'

/** Password/token field with a show-hide toggle. Used three times in the wizard. */
export function SecretField({
  id,
  label,
  placeholder,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  hint?: string
  value: string
  onChange: (value: string) => void
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <FormField label={label} htmlFor={id} hint={hint}>
      <div className="relative mt-1">
        <Input
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="none"
          onClick={() => setRevealed(!revealed)}
          className="absolute inset-y-0 right-0 pr-3 text-zinc-500 hover:bg-transparent hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-transparent dark:hover:text-zinc-300"
        >
          <EyeIcon open={revealed} />
        </Button>
      </div>
    </FormField>
  )
}

/** File picker with the blue `file:` chrome. Used for both cert and key uploads. */
export function CertificateFileField({
  id,
  label,
  hint,
  accept,
  inputRef,
  onChange,
}: {
  id: string
  label: string
  hint: string
  accept: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (file: File | null) => void
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-zinc-300 dark:file:bg-blue-900/20 dark:file:text-blue-400"
      />
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
    </div>
  )
}

export function EnvironmentSelector({
  environment,
  onChange,
}: {
  environment: KsefEnvironment
  onChange: (value: KsefEnvironment) => void
}) {
  const t = useTranslations('companySettings.ksef')

  return (
    <FormField label={t('environment')} htmlFor="ksef-environment">
      <SelectInput
        id="ksef-environment"
        value={environment}
        onChange={(e) => onChange(e.target.value as KsefEnvironment)}
        className="mt-1"
      >
        <option value="test">{t('environments.test')}</option>
        <option value="demo">{t('environments.demo')}</option>
        <option value="prod">{t('environments.prod')}</option>
      </SelectInput>
    </FormField>
  )
}

export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {open ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      ) : (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </>
      )}
    </svg>
  )
}
