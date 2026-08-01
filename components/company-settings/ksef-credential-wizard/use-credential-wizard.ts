'use client'

import { useCallback, useRef, useState } from 'react'

import type {
  AuthMethod,
  CertificateFormat,
  KsefEnvironment,
  VerifyResult,
  WizardStep,
} from './types'

type Options = {
  companyId: string
  /** Called after a successful save, once the user dismisses the result step. */
  onSuccess: () => void
  onOpenChange: (open: boolean) => void
}

/**
 * All state and side effects behind the 4-step "add KSeF credential" wizard:
 * select auth method → configure → verify against KSeF → show the result.
 *
 * The view layer is intentionally dumb — it renders whatever `step` says and
 * calls back into here.
 */
export function useCredentialWizard({ companyId, onSuccess, onOpenChange }: Options) {
  const [step, setStep] = useState<WizardStep>('select-type')
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null)
  const [certificateFormat, setCertificateFormat] = useState<CertificateFormat>('pkcs12')
  const [token, setToken] = useState('')
  const [environment, setEnvironment] = useState<KsefEnvironment>('prod')
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null)
  const [certificatePassword, setCertificatePassword] = useState('')
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const keyFileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('select-type')
    setAuthMethod(null)
    setToken('')
    setEnvironment('prod')
    setCertificateFile(null)
    setPrivateKeyFile(null)
    setCertificatePassword('')
    setVerifyResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (keyFileInputRef.current) keyFileInputRef.current.value = ''
  }, [])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset()
      onOpenChange(open)
    },
    [onOpenChange, reset]
  )

  const selectAuthMethod = useCallback((method: AuthMethod) => {
    setAuthMethod(method)
    setStep('configure')
  }, [])

  const goBack = useCallback(() => {
    setStep((current) => {
      if (current === 'configure') {
        setAuthMethod(null)
        return 'select-type'
      }
      if (current === 'result') {
        setVerifyResult(null)
        return 'configure'
      }
      return current
    })
  }, [])

  /** Shared between the validate and save requests — both take the same shape. */
  const buildCertificateFormData = useCallback(() => {
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
    return formData
  }, [certificateFile, certificateFormat, certificatePassword, environment, privateKeyFile])

  const validateAndSave = useCallback(
    async (skipValidation = false) => {
      if (!authMethod) return

      const credentialsUrl = `/api/companies/${companyId}/ksef-credentials`
      let grantedPermissions: string[] | undefined

      if (!skipValidation) {
        setStep('verifying')

        try {
          const validateRes =
            authMethod === 'token'
              ? await fetch(`${credentialsUrl}/validate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: token.trim(), environment }),
                })
              : await fetch(`${credentialsUrl}/validate`, {
                  method: 'POST',
                  body: buildCertificateFormData(),
                })

          const validateData = await validateRes.json()

          if (!validateData.valid) {
            setVerifyResult({ success: false, message: validateData.error })
            setStep('result')
            return
          }

          if (validateData.permissions) {
            grantedPermissions = validateData.permissions
          }
        } catch {
          setVerifyResult({ success: false, message: 'Connection error during validation' })
          setStep('result')
          return
        }
      }

      const validationStatus = skipValidation ? 'pending' : 'valid'

      try {
        let saveRes: Response

        if (authMethod === 'token') {
          saveRes = await fetch(credentialsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: token.trim(),
              environment,
              validationStatus,
              grantedPermissions,
            }),
          })
        } else {
          const formData = buildCertificateFormData()
          formData.append('validationStatus', validationStatus)
          if (grantedPermissions) {
            formData.append('grantedPermissions', JSON.stringify(grantedPermissions))
          }
          saveRes = await fetch(credentialsUrl, { method: 'POST', body: formData })
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
    },
    [authMethod, buildCertificateFormData, companyId, environment, token]
  )

  const finish = useCallback(() => {
    if (verifyResult?.success) onSuccess()
    handleOpenChange(false)
  }, [handleOpenChange, onSuccess, verifyResult])

  const canSubmit = Boolean(
    authMethod === 'token'
      ? token.trim().length > 0
      : certificateFormat === 'pkcs12'
        ? certificateFile && certificatePassword
        : certificateFile && privateKeyFile
  )

  return {
    step,
    authMethod,
    certificateFormat,
    setCertificateFormat,
    token,
    setToken,
    environment,
    setEnvironment,
    certificateFile,
    setCertificateFile,
    privateKeyFile,
    setPrivateKeyFile,
    certificatePassword,
    setCertificatePassword,
    verifyResult,
    fileInputRef,
    keyFileInputRef,
    canSubmit,
    selectAuthMethod,
    goBack,
    validateAndSave,
    finish,
    handleOpenChange,
  }
}
