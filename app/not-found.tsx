import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('errors.notFound')

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-md text-center">
        <p className="text-6xl font-bold text-zinc-300 dark:text-zinc-700">404</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t('description')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {t('goHome')}
        </Link>
      </div>
    </div>
  )
}
