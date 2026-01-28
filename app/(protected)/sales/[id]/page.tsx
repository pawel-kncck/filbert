import { InvoiceDetailPage } from '@/components/invoices/invoice-detail-page'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ company?: string }>
}

export default function SalesInvoiceDetailPage({ params, searchParams }: Props) {
  return <InvoiceDetailPage type="sales" params={params} searchParams={searchParams} />
}
