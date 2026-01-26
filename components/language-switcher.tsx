'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { locales, localeNames, localeCookieName, type Locale } from '@/lib/i18n/config'

interface LanguageSwitcherProps {
  currentLocale: Locale
  className?: string
}

export function LanguageSwitcher({ currentLocale, className = '' }: LanguageSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const handleLocaleChange = (newLocale: Locale) => {
    // Set the locale cookie
    document.cookie = `${localeCookieName}=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`

    startTransition(() => {
      // Handle landing page prefix routing
      if (pathname === '/' || locales.some((locale) => pathname === `/${locale}`)) {
        // Redirect to locale-prefixed or root path
        if (newLocale === 'pl') {
          router.push('/')
        } else {
          router.push(`/${newLocale}`)
        }
      } else {
        // For other pages, just refresh to apply the new locale from cookie
        router.refresh()
      }
    })
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={currentLocale}
        onChange={(e) => handleLocaleChange(e.target.value as Locale)}
        disabled={isPending}
        className="appearance-none rounded-md border border-zinc-300 bg-white px-3 py-1.5 pr-8 text-sm text-zinc-700 hover:bg-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        aria-label="Select language"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg
          className="h-4 w-4 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}
