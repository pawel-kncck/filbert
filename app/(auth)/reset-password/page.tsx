'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { createClient } from '@/lib/supabase/client'
import { getAuthErrorKey } from '@/lib/utils/auth-errors'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'

export default function ResetPasswordPage() {
  const router = useRouter()
  const t = useTranslations()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setHasSession(true)
      }
    }
    checkSession()
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
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

    const { error } = await supabase.auth.updateUser({
      password,
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

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-800">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {t('auth.resetPassword.expired.title')}
            </h1>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              {t('auth.resetPassword.expired.message')}
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-block text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t('auth.resetPassword.expired.requestNew')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-800">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {t('auth.resetPassword.success.title')}
            </h1>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              {t('auth.resetPassword.success.message')}
            </p>
            <Button onClick={() => router.push('/companies')} size="lg" className="mt-6">
              {t('auth.resetPassword.success.goToApp')}
            </Button>
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
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('auth.resetPassword.title')}</p>
        </div>

        <form onSubmit={handleResetPassword} className="mt-8 space-y-6">
          {error && (
            <Alert variant="error" size="md">
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <FormField label={t('auth.resetPassword.newPassword')} htmlFor="password">
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

            <FormField label={t('auth.resetPassword.confirmNewPassword')} htmlFor="confirmPassword">
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
            {loading ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
          </Button>
        </form>
      </div>
    </div>
  )
}
