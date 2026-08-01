'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ContactEntity } from '@/lib/types/contacts'
import { ContactFormDialog } from './contact-form-dialog'
import { CONTACT_UI } from './config'

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
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t(config.addLabelKey)}
      </button>

      <ContactFormDialog entity={entity} open={open} onOpenChange={setOpen} companyId={companyId} />
    </>
  )
}
