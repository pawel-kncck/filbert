'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Invoice, InvoiceItem } from '@/lib/types/database'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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

  // Escape handling and body scroll-lock come from Radix; the previous
  // hand-rolled overlay wired both up by hand.
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-4 max-h-[calc(100vh-2rem)] w-full max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-y-auto border-0 bg-white p-0 shadow-xl sm:top-8 sm:max-h-[calc(100vh-4rem)] sm:max-w-4xl"
      >
        <DialogHeader className="sticky top-0 z-10 flex-row items-center justify-between space-y-0 rounded-t-lg border-b border-zinc-200 bg-white px-6 py-4">
          <DialogTitle className="text-lg font-semibold text-zinc-900">{t('title')}</DialogTitle>
          <DialogClose asChild>
            <Button variant="subtle" size="icon-sm" aria-label={t('title')}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <KsefInvoiceView invoice={invoice} items={items} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
