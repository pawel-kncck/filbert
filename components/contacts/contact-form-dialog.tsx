'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { NipLookupButton } from '@/components/shared/nip-lookup-button'
import type { Contact, ContactEntity } from '@/lib/types/contacts'
import type { GusFormattedResult } from '@/lib/gus/types'
import { CONTACT_UI } from './config'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'

type Props = {
  entity: ContactEntity
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  contact?: Contact | null
}

export function ContactFormDialog({ entity, open, onOpenChange, companyId, contact }: Props) {
  const config = CONTACT_UI[entity]
  const router = useRouter()
  const t = useTranslations(config.namespace)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [nip, setNip] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setName(contact?.name || '')
      setNip(contact?.nip || '')
      setAddress(contact?.address || '')
      setEmail(contact?.email || '')
      setPhone(contact?.phone || '')
      setNotes(contact?.notes || '')
      setError(null)
    }
  }, [open, contact])

  const tGus = useTranslations('gus')
  const isEdit = !!contact

  const handleLookupResult = useCallback((data: GusFormattedResult) => {
    setName(data.name)
    if (data.nip) setNip(data.nip)
    if (data.address) setAddress(data.address)
    setError(null)
  }, [])

  const handleLookupError = useCallback(
    (errorKey: string) => {
      setError(tGus(errorKey.replace('gus.', '')))
    },
    [tGus]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const endpoint = isEdit ? `${config.apiBase}/${contact.id}` : config.apiBase
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, name, nip, address, email, phone, notes }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error?.code === 'DUPLICATE_NIP') {
          setError(t('errors.duplicateNip'))
        } else {
          setError(data.error?.message || t('errors.generic'))
        }
        return
      }

      onOpenChange(false)
      router.refresh()
    } catch {
      setError(t('errors.connection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-900 dark:text-white">
            {isEdit ? t('form.editTitle') : t('form.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('form.name')} *
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form.namePlaceholder')}
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('form.nip')}
            </label>
            <div className="mt-1 flex gap-2">
              <Input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder={t('form.nipPlaceholder')}
              />
              <NipLookupButton
                nip={nip}
                onResult={handleLookupResult}
                onError={handleLookupError}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('form.address')}
            </label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('form.addressPlaceholder')}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('form.email')}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('form.emailPlaceholder')}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('form.phone')}
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('form.phonePlaceholder')}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('form.notes')}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('form.notesPlaceholder')}
              rows={3}
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('form.saving') : t('form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
