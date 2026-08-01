'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { createClient } from '@/lib/supabase/client'
import { getAuthErrorKey } from '@/lib/utils/auth-errors'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const errorKey = getAuthErrorKey(error.message)
      setError(errorKey ? t(`auth.errors.${errorKey}`) : error.message)
      setLoading(false)
      return
    }

    router.push('/companies')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Filbert</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('auth.login.title')}</p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          {error && (
            <Alert variant="error" size="md">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <FormField label={t('common.email')} htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 text-base"
                placeholder="jan@firma.pl"
              />
            </FormField>

            <FormField label={t('common.password')} htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 text-base"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          <Button type="submit" disabled={loading} size="lg" className="w-full">
            {loading ? t('auth.login.submitting') : t('common.login')}
          </Button>

          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            {t('auth.login.noAccount')}{' '}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t('common.signup')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
