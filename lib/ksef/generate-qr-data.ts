import type { Invoice } from '@/lib/types/database'

const BASE_URLS = {
  test: 'https://qr-test.ksef.mf.gov.pl',
  demo: 'https://qr-demo.ksef.mf.gov.pl',
  prod: 'https://qr.ksef.mf.gov.pl',
} as const

type KsefEnvironment = keyof typeof BASE_URLS

/**
 * Generates a KSeF QR code URL (KOD I) for an invoice.
 *
 * URL format: {base}/invoice/{NIP}/{DD-MM-YYYY}/{HASH}
 *
 * Returns null if the invoice doesn't have the required ksef_hash or vendor_nip.
 */
export function generateKsefQrUrl(
  invoice: Pick<Invoice, 'vendor_nip' | 'issue_date' | 'ksef_hash'>,
  environment: KsefEnvironment = 'prod'
): string | null {
  if (!invoice.ksef_hash || !invoice.vendor_nip) {
    return null
  }

  const [year, month, day] = invoice.issue_date.split('-')
  const formattedDate = `${day}-${month}-${year}`

  return `${BASE_URLS[environment]}/invoice/${invoice.vendor_nip}/${formattedDate}/${invoice.ksef_hash}`
}
