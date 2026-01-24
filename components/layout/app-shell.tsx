import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

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
}

export function AppShell({ children, userEmail, companies, currentCompanyId }: Props) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Sidebar />
      <TopBar userEmail={userEmail} companies={companies} currentCompanyId={currentCompanyId} />
      <main className="ml-60 pt-16">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
