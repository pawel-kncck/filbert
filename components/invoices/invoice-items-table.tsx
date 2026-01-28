import { InvoiceItem } from '@/lib/types/database'
import { getTranslations } from 'next-intl/server'

type Props = {
  items: InvoiceItem[]
  currency: string
  locale: string
}

export async function InvoiceItemsTable({ items, currency, locale }: Props) {
  if (items.length === 0) {
    return null
  }

  const t = await getTranslations('invoices.items')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const formatNumber = (value: number, decimals: number) => {
    return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  const totalNet = items.reduce((sum, item) => sum + Number(item.net_amount), 0)
  const totalVat = items.reduce((sum, item) => sum + Number(item.vat_amount), 0)
  const totalGross = items.reduce((sum, item) => sum + Number(item.gross_amount), 0)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {t('title')}
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <th className="pb-3 pr-4 font-medium">{t('position')}</th>
              <th className="pb-3 pr-4 font-medium">{t('description')}</th>
              <th className="hidden pb-3 pr-4 text-right font-medium sm:table-cell">
                {t('quantity')}
              </th>
              <th className="hidden pb-3 pr-4 font-medium sm:table-cell">{t('unit')}</th>
              <th className="hidden pb-3 pr-4 text-right font-medium md:table-cell">
                {t('unitPrice')}
              </th>
              <th className="hidden pb-3 pr-4 text-right font-medium md:table-cell">
                {t('vatRate')}
              </th>
              <th className="pb-3 pr-4 text-right font-medium">{t('net')}</th>
              <th className="hidden pb-3 pr-4 text-right font-medium lg:table-cell">{t('vat')}</th>
              <th className="pb-3 text-right font-medium">{t('gross')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-700/50">
                <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">{item.position}</td>
                <td className="py-3 pr-4 text-zinc-900 dark:text-white">{item.description}</td>
                <td className="hidden py-3 pr-4 text-right text-zinc-900 sm:table-cell dark:text-white">
                  {formatNumber(Number(item.quantity), 3)}
                </td>
                <td className="hidden py-3 pr-4 text-zinc-600 sm:table-cell dark:text-zinc-400">
                  {item.unit}
                </td>
                <td className="hidden py-3 pr-4 text-right text-zinc-900 md:table-cell dark:text-white">
                  {formatCurrency(Number(item.unit_price))}
                </td>
                <td className="hidden py-3 pr-4 text-right text-zinc-600 md:table-cell dark:text-zinc-400">
                  {formatNumber(Number(item.vat_rate), 2)}%
                </td>
                <td className="py-3 pr-4 text-right text-zinc-900 dark:text-white">
                  {formatCurrency(Number(item.net_amount))}
                </td>
                <td className="hidden py-3 pr-4 text-right text-zinc-900 lg:table-cell dark:text-white">
                  {formatCurrency(Number(item.vat_amount))}
                </td>
                <td className="py-3 text-right font-medium text-zinc-900 dark:text-white">
                  {formatCurrency(Number(item.gross_amount))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <td
                colSpan={6}
                className="hidden pt-3 pr-4 text-right text-zinc-500 md:table-cell dark:text-zinc-400"
              >
                {t('total')}
              </td>
              <td
                colSpan={4}
                className="pt-3 pr-4 text-right text-zinc-500 md:hidden dark:text-zinc-400"
              >
                {t('total')}
              </td>
              <td className="pt-3 pr-4 text-right text-zinc-900 dark:text-white">
                {formatCurrency(totalNet)}
              </td>
              <td className="hidden pt-3 pr-4 text-right text-zinc-900 lg:table-cell dark:text-white">
                {formatCurrency(totalVat)}
              </td>
              <td className="pt-3 text-right text-blue-600 dark:text-blue-400">
                {formatCurrency(totalGross)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
