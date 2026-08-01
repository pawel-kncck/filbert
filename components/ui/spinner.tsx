import * as React from 'react'

import { cn } from '@/lib/utils'

type SpinnerProps = React.ComponentProps<'div'> & {
  /** Accessible name; rendered visually hidden. */
  label?: string
}

/**
 * Ring spinner — the `animate-spin rounded-full border-2 border-t-*` element
 * that loading states hand-rolled. Colour and thickness are overridable via
 * `className` (the route-level loaders use a heavier zinc ring).
 */
function Spinner({ className, label = 'Loading', ...props }: SpinnerProps) {
  return (
    <div
      data-slot="spinner"
      role="status"
      aria-label={label}
      className={cn(
        'h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600',
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
