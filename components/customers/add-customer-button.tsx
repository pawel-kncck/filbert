'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CustomerFormDialog } from './customer-form-dialog'

type Props = {
  companyId: string
}

export function AddCustomerButton({ companyId }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('customers')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t('actions.addCustomer')}
      </button>

      <CustomerFormDialog open={open} onOpenChange={setOpen} companyId={companyId} />
    </>
  )
}
