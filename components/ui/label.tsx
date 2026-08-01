import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Form label. Replaces the `block text-sm font-medium text-zinc-700
 * dark:text-zinc-300` string that appeared verbatim 34 times.
 */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // Association is the caller's job via `htmlFor`; the rule can't see through the wrapper.
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      data-slot="label"
      className={cn('block text-sm font-medium text-zinc-700 dark:text-zinc-300', className)}
      {...props}
    />
  )
}

export { Label }
