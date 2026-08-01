'use client'

import { useTranslations } from 'next-intl'
import { KeyIcon, FileTextIcon } from 'lucide-react'

import type { AuthMethod } from './types'

/** Step 1 — pick between token and certificate authentication. */
export function SelectTypeStep({ onSelect }: { onSelect: (method: AuthMethod) => void }) {
  const t = useTranslations('companySettings.ksef')

  return (
    <div className="grid grid-cols-2 gap-4 py-4">
      <AuthMethodCard
        icon={<KeyIcon className="h-8 w-8 text-blue-600" />}
        title={t('modal.tokenOption')}
        description={t('modal.tokenDescription')}
        onClick={() => onSelect('token')}
      />
      <AuthMethodCard
        icon={<FileTextIcon className="h-8 w-8 text-blue-600" />}
        title={t('modal.certificateOption')}
        description={t('modal.certificateDescription')}
        onClick={() => onSelect('certificate')}
      />
    </div>
  )
}

/**
 * A selection card rather than a button in the `ui/button` sense — it has its
 * own border/hover treatment and stacks an oversized icon above two lines of
 * text, so it stays raw markup.
 */
function AuthMethodCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-6 hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
    >
      {icon}
      <span className="font-medium text-zinc-900 dark:text-white">{title}</span>
      <span className="text-center text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
    </button>
  )
}
