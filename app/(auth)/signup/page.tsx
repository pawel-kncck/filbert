'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { createClient } from '@/lib/supabase/client'
import { getAuthErrorKey } from '@/lib/utils/auth-errors'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'

export default function SignupPage() {
  const t = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError(t('auth.validation.passwordsNotMatch'))
      setLoading(false)
      return
    }

    if (password.length < 12) {
      setError(t('auth.validation.passwordMinLength'))
      setLoading(false)
      return
    }

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })

    if (error) {
      const errorKey = getAuthErrorKey(error.message)
      setError(errorKey ? t(`auth.errors.${errorKey}`) : error.message)
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
              {t('auth.signup.success.message', { email })}
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
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('auth.signup.title')}</p>
        </div>

        <form onSubmit={handleSignup} className="mt-8 space-y-6">
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
                placeholder={t('auth.signup.passwordHint')}
              />
            </FormField>

            <FormField label={t('auth.signup.confirmPassword')} htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 text-base"
              />
            </FormField>
          </div>

          <Button type="submit" disabled={loading} size="lg" className="w-full">
            {loading ? t('auth.signup.submitting') : t('common.signup')}
          </Button>

          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            {t('auth.signup.hasAccount')}{' '}
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
