import { InvoiceListPage } from '@/components/invoices/invoice-list-page'

type Props = {
  searchParams: Promise<{
    company?: string
    page?: string
    search?: string
    from?: string
    to?: string
  }>
}

export default function PurchasesPage({ searchParams }: Props) {
  return <InvoiceListPage type="purchase" searchParams={searchParams} />
}
