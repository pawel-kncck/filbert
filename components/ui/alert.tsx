import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Inline status banner — the `rounded-md bg-{red,green}-50 p-3 text-sm` block
 * that error and success messages were spelled out with in ~15 places.
 *
 * The auth pages previously used a second, slightly different dark-mode red
 * (`dark:bg-red-900/50 dark:text-red-200`); this unifies them on the app's
 * dominant spelling.
 */
const alertVariants = cva('rounded-md text-sm', {
  variants: {
    variant: {
      error: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
      success: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
      warning:
        'rounded-lg border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200',
    },
    size: {
      sm: 'p-3',
      md: 'p-4',
    },
  },
  defaultVariants: {
    variant: 'error',
    size: 'sm',
  },
})

function Alert({
  className,
  variant = 'error',
  size = 'sm',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Alert, alertVariants }
