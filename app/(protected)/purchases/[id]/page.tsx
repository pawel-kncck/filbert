import { InvoiceDetailPage } from '@/components/invoices/invoice-detail-page'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ company?: string }>
}

export default function PurchaseInvoiceDetailPage({ params, searchParams }: Props) {
  return <InvoiceDetailPage type="purchase" params={params} searchParams={searchParams} />
}
