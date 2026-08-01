'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ContactEntity } from '@/lib/types/contacts'
import { ContactFormDialog } from './contact-form-dialog'
import { CONTACT_UI } from './config'
import { Button } from '@/components/ui/button'

type Props = {
  entity: ContactEntity
  companyId: string
}

export function AddContactButton({ entity, companyId }: Props) {
  const config = CONTACT_UI[entity]
  const [open, setOpen] = useState(false)
  const t = useTranslations(config.namespace)

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t(config.addLabelKey)}</Button>

      <ContactFormDialog entity={entity} open={open} onOpenChange={setOpen} companyId={companyId} />
    </>
  )
}
