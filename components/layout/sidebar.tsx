'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

export function Sidebar() {
  const pathname = usePathname()
  const t = useTranslations('navigation')

  const invoicesNavigation = [
    {
      name: t('sales'),
      href: '/sales',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      name: t('purchases'),
      href: '/purchases',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
  ]

  const settingsNavigation = [
    {
      name: t('members'),
      href: '/settings/members',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      name: t('vendors'),
      href: '/settings/vendors',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    {
      name: t('customers'),
      href: '/settings/customers',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
  ]

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex h-16 items-center border-b border-zinc-200 px-6 dark:border-zinc-700">
        <Link href="/companies" className="text-xl font-bold text-zinc-900 dark:text-white">
          Filbert
        </Link>
      </div>

      <nav className="mt-6 px-3">
        <div>
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('invoices')}
          </h3>
          <ul className="mt-2 space-y-1">
            {invoicesNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                </li>
              )
            })}
            <li>
              <Link
                href="/sales/new"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === '/sales/new'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {t('newInvoice')}
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-8">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('settings')}
          </h3>
          <ul className="mt-2 space-y-1">
            {settingsNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-200 p-3 dark:border-zinc-700">
        <Link
          href="/companies"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pathname === '/companies'
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
              : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
          }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          {t('companies')}
        </Link>
      </div>
    </aside>
  )
}
