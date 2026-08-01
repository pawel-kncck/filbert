'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export default function ProtectedError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('title')}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('description')}</p>
        <Button variant="inverse" onClick={reset} className="mt-6 rounded-lg">
          {t('tryAgain')}
        </Button>
      </div>
    </div>
  )
}
