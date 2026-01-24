type Props = {
  totalCount: number
  totalNet: number
  totalVat: number
  totalGross: number
  currency?: string
}

function formatCurrency(amount: number, currency: string = 'PLN'): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function InvoiceStats({ totalCount, totalNet, totalVat, totalGross, currency = 'PLN' }: Props) {
  const stats = [
    { label: 'Liczba faktur', value: totalCount.toString() },
    { label: 'Suma netto', value: formatCurrency(totalNet, currency) },
    { label: 'Suma VAT', value: formatCurrency(totalVat, currency) },
    { label: 'Suma brutto', value: formatCurrency(totalGross, currency) },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
