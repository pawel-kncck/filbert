'use client'

import { useEffect, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Invoice, InvoiceItem } from '@/lib/types/database'
import { KsefInvoiceView } from './ksef-invoice-view'

type Props = {
  invoice: Invoice
  items?: InvoiceItem[]
  onClose: () => void
}

export function KsefPreviewModal({ invoice, items: initialItems, onClose }: Props) {
  const t = useTranslations('invoices.preview')
  const [items, setItems] = useState<InvoiceItem[]>(initialItems || [])
  const [loading, setLoading] = useState(!initialItems)

  useEffect(() => {
    if (!initialItems) {
      fetch(`/api/invoices/${invoice.id}/items`)
        .then((res) => res.json())
        .then((data) => {
          setItems(data.items || [])
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
        })
    }
  }, [invoice.id, initialItems])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />

      {/* Modal content */}
      <div className="relative flex min-h-full items-start justify-center p-4 sm:p-8">
        <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-zinc-200 bg-white px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">{t('title')}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
              </div>
            ) : (
              <KsefInvoiceView invoice={invoice} items={items} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
