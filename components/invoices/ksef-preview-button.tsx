'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Invoice, InvoiceItem } from '@/lib/types/database'
import { KsefPreviewModal } from './ksef-preview-modal'

type Props = {
  invoice: Invoice
  items: InvoiceItem[]
}

export function KsefPreviewButton({ invoice, items }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const t = useTranslations('invoices.preview')

  if (!invoice.ksef_reference) {
    return null
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
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
        {t('preview')}
      </button>
      {isOpen && (
        <KsefPreviewModal invoice={invoice} items={items} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}
