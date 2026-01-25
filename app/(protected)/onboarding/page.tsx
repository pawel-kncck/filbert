'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [nip, setNip] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const validateNip = (value: string): boolean => {
    const cleanNip = value.replace(/[\s-]/g, '')
    if (cleanNip.length !== 10 || !/^\d{10}$/.test(cleanNip)) {
      return false
    }
    // NIP checksum validation
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanNip[i]) * weights[i]
    }
    const checkDigit = sum % 11
    return checkDigit === parseInt(cleanNip[9])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cleanNip = nip.replace(/[\s-]/g, '')

    if (!validateNip(cleanNip)) {
      setError('Nieprawidłowy numer NIP')
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Sesja wygasła. Zaloguj się ponownie.')
      setLoading(false)
      return
    }

    // Check if NIP already exists
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id, name')
      .eq('nip', cleanNip)
      .single()

    if (existingCompany) {
      // Company exists - add user as pending member
      const { error: joinError } = await supabase
        .from('user_companies')
        .insert({
          user_id: user.id,
          company_id: existingCompany.id,
          role: 'member',
          status: 'pending',
        })

      if (joinError) {
        setError('Błąd podczas dołączania do firmy: ' + joinError.message)
        setLoading(false)
        return
      }

      router.push('/pending')
      return
    }

    // Company doesn't exist - create it and add user as admin
    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        nip: cleanNip,
        is_demo: false,
      })
      .select()
      .single()

    if (createError) {
      setError('Błąd podczas tworzenia firmy: ' + createError.message)
      setLoading(false)
      return
    }

    // Add user as admin
    const { error: memberError } = await supabase
      .from('user_companies')
      .insert({
        user_id: user.id,
        company_id: newCompany.id,
        role: 'admin',
        status: 'active',
      })

    if (memberError) {
      setError('Błąd podczas przypisywania do firmy: ' + memberError.message)
      setLoading(false)
      return
    }

    router.push('/companies')
  }

  const handleNipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only digits and formatting characters
    const value = e.target.value.replace(/[^\d\s-]/g, '')
    setNip(value)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            Dodaj firmę
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Wprowadź dane swojej firmy, aby rozpocząć korzystanie z Filbert
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="companyName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Nazwa firmy
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                placeholder="Przykładowa Sp. z o.o."
              />
            </div>

            <div>
              <label
                htmlFor="nip"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                NIP
              </label>
              <input
                id="nip"
                name="nip"
                type="text"
                required
                value={nip}
                onChange={handleNipChange}
                maxLength={13}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                placeholder="123-456-78-90"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                10 cyfr, np. 123-456-78-90 lub 1234567890
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Przetwarzanie...' : 'Kontynuuj'}
          </button>
        </form>
      </div>
    </div>
  )
}
