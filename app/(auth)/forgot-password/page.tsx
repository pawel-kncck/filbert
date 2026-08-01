'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const t = useTranslations()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-800">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {t('auth.signup.success.title')}
            </h1>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              {t('auth.forgotPassword.success', { email })}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t('auth.signup.success.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Filbert</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('auth.forgotPassword.title')}</p>
        </div>

        <form onSubmit={handleResetPassword} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t('common.email')}
            </label>
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
          </div>

          <Button type="submit" disabled={loading} size="lg" className="w-full">
            {loading ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
          </Button>

          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            {t('auth.forgotPassword.rememberPassword')}{' '}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t('common.login')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
