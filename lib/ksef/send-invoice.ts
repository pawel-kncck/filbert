import type { Invoice, InvoiceItem, KsefCredentials } from '@/lib/types/database'
import { updateInvoiceKsefStatus } from '@/lib/data/ksef'
import { authenticateKsefClient } from './authenticate-client'
import { buildFA3Xml } from './fa3-xml-builder'
import { sha256Base64Url } from './crypto'

const STATUS_POLL_INTERVAL_MS = 2000
const STATUS_POLL_MAX_ATTEMPTS = 10

export type SendInvoiceResult = { status: 'accepted'; ksefReference: string } | { status: 'sent' }

/**
 * Sends an invoice to KSeF: builds the FA(3) XML, opens a session,
 * submits, polls briefly for the KSeF reference number, and records the
 * outcome on the invoice row ('accepted' with reference + hash, or
 * 'sent' when confirmation is still pending).
 *
 * Marks the invoice 'pending' up front. On failure the error is
 * recorded on the invoice ('error' status) and rethrown for the caller
 * to shape a response.
 */
export async function sendInvoiceToKsef(params: {
  invoice: Invoice
  items: InvoiceItem[]
  credentials: KsefCredentials
  nip: string
}): Promise<SendInvoiceResult> {
  const { invoice, items, credentials, nip } = params

  await updateInvoiceKsefStatus(invoice.id, {
    ksef_status: 'pending',
    ksef_error: null,
    ksef_sent_at: new Date().toISOString(),
  })

  const xml = buildFA3Xml({ invoice, items })

  try {
    const client = await authenticateKsefClient(credentials, nip)
    await client.openSession()
    const sessionRef = client.getSessionRef()!
    const result = await client.sendInvoice(xml)

    // Poll for the KSeF reference number
    let status = await client.getInvoiceStatus(sessionRef, result.elementReferenceNumber)
    let attempts = 0

    while (!status.ksefReferenceNumber && attempts < STATUS_POLL_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
      status = await client.getInvoiceStatus(sessionRef, result.elementReferenceNumber)
      attempts++
    }

    await client.closeSession()

    if (status.ksefReferenceNumber) {
      await updateInvoiceKsefStatus(invoice.id, {
        ksef_status: 'accepted',
        ksef_reference: status.ksefReferenceNumber,
        ksef_hash: sha256Base64Url(xml),
        ksef_error: null,
      })

      return { status: 'accepted', ksefReference: status.ksefReferenceNumber }
    }

    await updateInvoiceKsefStatus(invoice.id, {
      ksef_status: 'sent',
      ksef_error: null,
    })

    return { status: 'sent' }
  } catch (error) {
    await updateInvoiceKsefStatus(invoice.id, {
      ksef_status: 'error',
      ksef_error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}
