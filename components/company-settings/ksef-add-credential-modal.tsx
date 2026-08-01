'use client'

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
import { useCredentialWizard } from './ksef-credential-wizard/use-credential-wizard'
import { SelectTypeStep } from './ksef-credential-wizard/select-type-step'
import { TokenStep } from './ksef-credential-wizard/token-step'
import { CertificateStep } from './ksef-credential-wizard/certificate-step'
import { ResultStep, VerifyingStep } from './ksef-credential-wizard/result-step'

type Props = {
  companyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/**
 * Shell for the add-credential wizard: dialog chrome, step routing, and the
 * footer's step-dependent actions. All state lives in `useCredentialWizard`
 * and each step is its own component under `ksef-credential-wizard/`.
 */
export function KsefAddCredentialModal({ companyId, open, onOpenChange, onSuccess }: Props) {
  const t = useTranslations('companySettings.ksef')
  const tCommon = useTranslations('common')

  const wizard = useCredentialWizard({ companyId, onSuccess, onOpenChange })

  return (
    <Dialog open={open} onOpenChange={wizard.handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('modal.addTitle')}</DialogTitle>
          {wizard.step === 'select-type' && (
            <DialogDescription>{t('modal.selectType')}</DialogDescription>
          )}
        </DialogHeader>

        {wizard.step === 'select-type' && <SelectTypeStep onSelect={wizard.selectAuthMethod} />}

        {wizard.step === 'configure' && wizard.authMethod === 'token' && (
          <TokenStep
            token={wizard.token}
            onTokenChange={wizard.setToken}
            environment={wizard.environment}
            onEnvironmentChange={wizard.setEnvironment}
          />
        )}

        {wizard.step === 'configure' && wizard.authMethod === 'certificate' && (
          <CertificateStep
            format={wizard.certificateFormat}
            onFormatChange={wizard.setCertificateFormat}
            password={wizard.certificatePassword}
            onPasswordChange={wizard.setCertificatePassword}
            onCertificateFileChange={wizard.setCertificateFile}
            onPrivateKeyFileChange={wizard.setPrivateKeyFile}
            certificateInputRef={wizard.fileInputRef}
            privateKeyInputRef={wizard.keyFileInputRef}
            environment={wizard.environment}
            onEnvironmentChange={wizard.setEnvironment}
          />
        )}

        {wizard.step === 'verifying' && <VerifyingStep environment={wizard.environment} />}

        {wizard.step === 'result' && wizard.verifyResult && (
          <ResultStep
            result={wizard.verifyResult}
            environment={wizard.environment}
            authMethod={wizard.authMethod}
          />
        )}

        <DialogFooter>
          {wizard.step === 'select-type' && (
            <Button variant="outline" onClick={() => wizard.handleOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
          )}

          {wizard.step === 'configure' && (
            <>
              <Button variant="outline" onClick={wizard.goBack}>
                {t('modal.back')}
              </Button>
              <Button onClick={() => wizard.validateAndSave(false)} disabled={!wizard.canSubmit}>
                {t('modal.verifyAndSave')}
              </Button>
            </>
          )}

          {wizard.step === 'result' && (
            <>
              {!wizard.verifyResult?.success && (
                <Button variant="outline" onClick={wizard.goBack}>
                  {t('modal.tryAgain')}
                </Button>
              )}
              <Button onClick={wizard.finish}>{t('modal.done')}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
