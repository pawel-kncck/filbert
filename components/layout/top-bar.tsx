'use client'

import { CompanySelector } from './company-selector'

type Company = {
  id: string
  name: string
  nip: string
  is_demo: boolean
}

type Props = {
  userEmail: string
  companies: Company[]
  currentCompanyId: string | null
}

export function TopBar({ userEmail, companies, currentCompanyId }: Props) {
  return (
    <header className="fixed left-60 right-0 top-0 z-30 h-16 border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex h-full items-center justify-between px-6">
        <CompanySelector companies={companies} currentCompanyId={currentCompanyId} />

        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{userEmail}</span>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
