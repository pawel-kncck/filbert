'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { KeyIcon, FileTextIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from 'lucide-react'

type AuthMethod = 'token' | 'certificate'
type CertificateFormat = 'pkcs12' | 'pem'
type Step = 'select-type' | 'configure' | 'verifying' | 'result'

type Props = {
  companyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function KsefAddCredentialModal({ companyId, open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations('companySettings.ksef')
  const tCommon = useTranslations('common')

  const [step, setStep] = useState<Step>('select-type')
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null)
  const [certificateFormat, setCertificateFormat] = useState<CertificateFormat>('pkcs12')
  const [token, setToken] = useState('')
  const [environment, setEnvironment] = useState<'test' | 'demo' | 'prod'>('test')
  const [showToken, setShowToken] = useState(false)
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null)
  const [certificatePassword, setCertificatePassword] = useState('')
  const [showCertPassword, setShowCertPassword] = useState(false)

  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message?: string } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const keyFileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setStep('select-type')
    setAuthMethod(null)
    setToken('')
    setEnvironment('test')
    setCertificateFile(null)
    setPrivateKeyFile(null)
    setCertificatePassword('')
    setVerifyResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (keyFileInputRef.current) keyFileInputRef.current.value = ''
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    onOpenChange(open)
  }

  const handleSelectAuthMethod = (method: AuthMethod) => {
    setAuthMethod(method)
    setStep('configure')
  }

  const handleBack = () => {
    if (step === 'configure') {
      setStep('select-type')
      setAuthMethod(null)
    } else if (step === 'result') {
      setStep('configure')
      setVerifyResult(null)
      setError(null)
    }
  }

  const validateAndSave = async (skipValidation = false) => {
    if (!authMethod) return

    setError(null)

    if (!skipValidation) {
      setStep('verifying')

      // First validate the credentials
      try {
        let validateRes: Response

        if (authMethod === 'token') {
          validateRes = await fetch(`/api/companies/${companyId}/ksef-credentials/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.trim(), environment }),
          })
        } else {
          const formData = new FormData()
          formData.append('certificate', certificateFile!)
          formData.append('certificateFormat', certificateFormat)
          formData.append('environment', environment)

          if (certificateFormat === 'pkcs12') {
            formData.append('certificatePassword', certificatePassword)
          } else {
            formData.append('privateKey', privateKeyFile!)
            if (certificatePassword) {
              formData.append('privateKeyPassword', certificatePassword)
            }
          }

          validateRes = await fetch(`/api/companies/${companyId}/ksef-credentials/validate`, {
            method: 'POST',
            body: formData,
          })
        }

        const validateData = await validateRes.json()

        if (!validateData.valid) {
          setVerifyResult({ success: false, message: validateData.error })
          setStep('result')
          return
        }
      } catch {
        setVerifyResult({ success: false, message: 'Connection error during validation' })
        setStep('result')
        return
      }
    }

    // Now save the credentials
    try {
      let saveRes: Response

      if (authMethod === 'token') {
        saveRes = await fetch(`/api/companies/${companyId}/ksef-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token.trim(),
            environment,
            validationStatus: skipValidation ? 'pending' : 'valid',
          }),
        })
      } else {
        const formData = new FormData()
        formData.append('certificate', certificateFile!)
        formData.append('certificateFormat', certificateFormat)
        formData.append('environment', environment)
        formData.append('validationStatus', skipValidation ? 'pending' : 'valid')

        if (certificateFormat === 'pkcs12') {
          formData.append('certificatePassword', certificatePassword)
        } else {
          formData.append('privateKey', privateKeyFile!)
          if (certificatePassword) {
            formData.append('privateKeyPassword', certificatePassword)
          }
        }

        saveRes = await fetch(`/api/companies/${companyId}/ksef-credentials`, {
          method: 'POST',
          body: formData,
        })
      }

      if (!saveRes.ok) {
        const saveData = await saveRes.json()
        setVerifyResult({
          success: false,
          message: saveData.error?.message || 'Failed to save credentials',
        })
        setStep('result')
        return
      }

      setVerifyResult({ success: true })
      setStep('result')
    } catch {
      setVerifyResult({ success: false, message: 'Connection error while saving' })
      setStep('result')
    }
  }

  const handleDone = () => {
    if (verifyResult?.success) {
      onSuccess()
    }
    handleOpenChange(false)
  }

  const canSubmit =
    authMethod === 'token'
      ? token.trim().length > 0
      : certificateFormat === 'pkcs12'
        ? certificateFile && certificatePassword
        : certificateFile && privateKeyFile

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('modal.addTitle')}</DialogTitle>
          {step === 'select-type' && <DialogDescription>{t('modal.selectType')}</DialogDescription>}
        </DialogHeader>

        {/* Step 1: Select Type */}
        {step === 'select-type' && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              type="button"
              onClick={() => handleSelectAuthMethod('token')}
              className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-6 hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
            >
              <KeyIcon className="h-8 w-8 text-blue-600" />
              <span className="font-medium text-zinc-900 dark:text-white">
                {t('modal.tokenOption')}
              </span>
              <span className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                {t('modal.tokenDescription')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectAuthMethod('certificate')}
              className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-6 hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
            >
              <FileTextIcon className="h-8 w-8 text-blue-600" />
              <span className="font-medium text-zinc-900 dark:text-white">
                {t('modal.certificateOption')}
              </span>
              <span className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                {t('modal.certificateDescription')}
              </span>
            </button>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 'configure' && authMethod === 'token' && (
          <div className="space-y-4 py-4">
            <div>
              <label
                htmlFor="ksef-token"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {t('token')}
              </label>
              <div className="relative mt-1">
                <input
                  id="ksef-token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t('tokenPlaceholder')}
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 pr-10 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                >
                  <EyeIcon open={showToken} />
                </button>
              </div>
            </div>

            <EnvironmentSelector environment={environment} onChange={setEnvironment} t={t} />

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'configure' && authMethod === 'certificate' && (
          <div className="space-y-4 py-4">
            {/* Certificate format selector */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('certificateFormatLabel')}
              </label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="radio"
                    name="certFormat"
                    value="pkcs12"
                    checked={certificateFormat === 'pkcs12'}
                    onChange={() => setCertificateFormat('pkcs12')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  {t('formatPkcs12')}
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="radio"
                    name="certFormat"
                    value="pem"
                    checked={certificateFormat === 'pem'}
                    onChange={() => setCertificateFormat('pem')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  {t('formatPem')}
                </label>
              </div>
            </div>

            {/* PKCS#12 format inputs */}
            {certificateFormat === 'pkcs12' && (
              <>
                <div>
                  <label
                    htmlFor="ksef-certificate"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t('certificateFile')}
                  </label>
                  <input
                    ref={fileInputRef}
                    id="ksef-certificate"
                    type="file"
                    accept=".p12,.pfx"
                    onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-zinc-300 dark:file:bg-blue-900/20 dark:file:text-blue-400"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('certificateFileHint')}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="ksef-cert-password"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t('certificatePassword')}
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="ksef-cert-password"
                      type={showCertPassword ? 'text' : 'password'}
                      value={certificatePassword}
                      onChange={(e) => setCertificatePassword(e.target.value)}
                      placeholder={t('certificatePasswordPlaceholder')}
                      className="block w-full rounded-md border border-zinc-300 px-3 py-2 pr-10 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCertPassword(!showCertPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                    >
                      <EyeIcon open={showCertPassword} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* PEM format inputs */}
            {certificateFormat === 'pem' && (
              <>
                <div>
                  <label
                    htmlFor="ksef-certificate-pem"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t('certificateFilePem')}
                  </label>
                  <input
                    ref={fileInputRef}
                    id="ksef-certificate-pem"
                    type="file"
                    accept=".crt,.pem,.cer"
                    onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-zinc-300 dark:file:bg-blue-900/20 dark:file:text-blue-400"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('certificateFilePemHint')}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="ksef-private-key"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t('privateKeyFile')}
                  </label>
                  <input
                    ref={keyFileInputRef}
                    id="ksef-private-key"
                    type="file"
                    accept=".key,.pem"
                    onChange={(e) => setPrivateKeyFile(e.target.files?.[0] || null)}
                    className="mt-1 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-zinc-300 dark:file:bg-blue-900/20 dark:file:text-blue-400"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('privateKeyFileHint')}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="ksef-pem-password"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t('privateKeyPassword')}
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="ksef-pem-password"
                      type={showCertPassword ? 'text' : 'password'}
                      value={certificatePassword}
                      onChange={(e) => setCertificatePassword(e.target.value)}
                      placeholder={t('privateKeyPasswordPlaceholder')}
                      className="block w-full rounded-md border border-zinc-300 px-3 py-2 pr-10 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCertPassword(!showCertPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                    >
                      <EyeIcon open={showCertPassword} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('privateKeyPasswordHint')}
                  </p>
                </div>
              </>
            )}

            <EnvironmentSelector environment={environment} onChange={setEnvironment} t={t} />

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Verifying */}
        {step === 'verifying' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <LoaderIcon className="h-8 w-8 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="font-medium text-zinc-900 dark:text-white">{t('modal.verifying')}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('modal.connectingTo')} ({t(`environments.${environment}`)})
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && verifyResult && (
          <div className="flex flex-col items-center gap-4 py-8">
            {verifyResult.success ? (
              <>
                <CheckCircleIcon className="h-12 w-12 text-green-600" />
                <div className="text-center">
                  <p className="font-medium text-zinc-900 dark:text-white">{t('modal.success')}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('environment')}: {t(`environments.${environment}`)}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('table.type')}: {t(`authMethods.${authMethod}`)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircleIcon className="h-12 w-12 text-red-600" />
                <div className="text-center">
                  <p className="font-medium text-zinc-900 dark:text-white">{t('testFailed')}</p>
                  {verifyResult.message && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {verifyResult.message}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'select-type' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
          )}

          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={handleBack}>
                {t('modal.back')}
              </Button>
              <Button onClick={() => validateAndSave(false)} disabled={!canSubmit}>
                {t('modal.verifyAndSave')}
              </Button>
            </>
          )}

          {step === 'result' && (
            <>
              {!verifyResult?.success && (
                <Button variant="outline" onClick={handleBack}>
                  {t('modal.tryAgain')}
                </Button>
              )}
              <Button onClick={handleDone}>{t('modal.done')}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EnvironmentSelector({
  environment,
  onChange,
  t,
}: {
  environment: 'test' | 'demo' | 'prod'
  onChange: (value: 'test' | 'demo' | 'prod') => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div>
      <label
        htmlFor="ksef-environment"
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {t('environment')}
      </label>
      <select
        id="ksef-environment"
        value={environment}
        onChange={(e) => onChange(e.target.value as 'test' | 'demo' | 'prod')}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
      >
        <option value="test">{t('environments.test')}</option>
        <option value="demo">{t('environments.demo')}</option>
        <option value="prod">{t('environments.prod')}</option>
      </select>
    </div>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    )
  }

  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  )
}
