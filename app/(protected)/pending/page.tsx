'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

export default function PendingPage() {
  const router = useRouter()
  const t = useTranslations()
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const fetchPendingCompany = async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get pending membership with company name
      const { data: membership } = await supabase
        .from('user_companies')
        .select('company_id, status, companies(name)')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single()

      if (membership?.companies) {
        setCompanyName((membership.companies as { name: string }).name)
      }
    }

    fetchPendingCompany()
  }, [])

  const handleCheckStatus = async () => {
    setChecking(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setChecking(false)
      return
    }

    // Check if status changed to active
    const { data: membership } = await supabase
      .from('user_companies')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (membership) {
      router.push('/companies')
      return
    }

    setChecking(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-800">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-8 w-8 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {t('pending.title')}
          </h1>
          {companyName && (
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              {t('pending.message', { company: companyName })}
            </p>
          )}
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            {t('pending.explanation')}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {checking ? t('pending.checking') : t('pending.checkStatus')}
          </button>
          <button
            onClick={handleLogout}
            className="w-full rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {t('common.logout')}
          </button>
        </div>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('pending.demoHint')}
        </p>
      </div>
    </div>
  )
}
