type Props = {
  label: string
  children: React.ReactNode
}

export function Tooltip({ label, children }: Props) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity delay-150 group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">
        {label}
      </span>
    </span>
  )
}
