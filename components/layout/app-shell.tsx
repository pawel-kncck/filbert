import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { CompanyProvider } from '@/components/providers/company-provider'
import type { Locale } from '@/lib/i18n/config'

type Company = {
  id: string
  name: string
  nip: string
  is_demo: boolean
}

type Props = {
  children: React.ReactNode
  userEmail: string
  companies: Company[]
  currentCompanyId: string | null
  currentLocale: Locale
}

export function AppShell({
  children,
  userEmail,
  companies,
  currentCompanyId,
  currentLocale,
}: Props) {
  return (
    <CompanyProvider companies={companies} initialCompanyId={currentCompanyId}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <Sidebar />
        <TopBar userEmail={userEmail} currentLocale={currentLocale} />
        <main className="ml-60 pt-16">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </CompanyProvider>
  )
}
