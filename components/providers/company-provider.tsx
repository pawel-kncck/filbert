'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Company = {
  id: string
  name: string
  nip: string
  is_demo: boolean
}

type CompanyContextType = {
  companies: Company[]
  currentCompanyId: string | null
  currentCompany: Company | null
  setCurrentCompanyId: (id: string) => void
}

const CompanyContext = createContext<CompanyContextType | null>(null)

type Props = {
  children: React.ReactNode
  companies: Company[]
  initialCompanyId: string | null
}

export function CompanyProvider({ children, companies, initialCompanyId }: Props) {
  const router = useRouter()
  // Use initialCompanyId as the source of truth from the server
  // Local state only tracks user selections within the session
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  // Prefer user's selection, fall back to server-provided initial value
  const currentCompanyId = selectedCompanyId ?? initialCompanyId
  const currentCompany = companies.find((c) => c.id === currentCompanyId) || null

  const setCurrentCompanyId = useCallback(
    (id: string) => {
      // Update local state immediately
      setSelectedCompanyId(id)

      // Persist to cookie for future sessions
      document.cookie = `selectedCompany=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`

      // Refresh server components to get new data
      router.refresh()
    },
    [router]
  )

  return (
    <CompanyContext.Provider
      value={{
        companies,
        currentCompanyId,
        currentCompany,
        setCurrentCompanyId,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider')
  }
  return context
}
