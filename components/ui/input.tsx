import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Text input in the app's zinc/blue palette. Reproduces the class string that
 * was repeated across ~25 call sites, including the red `invalid` spelling
 * that `invoice-form.tsx` carried as a local `inputError` constant.
 *
 * Layout (`mt-1`, `pr-10`, width) stays at the call site via `className`.
 */
const inputVariants = cva(
  'block w-full rounded-md border px-3 py-2 text-sm text-zinc-900 shadow-sm focus:ring-1 focus:outline-none dark:bg-zinc-700 dark:text-white',
  {
    variants: {
      invalid: {
        false: 'border-zinc-300 focus:border-blue-500 focus:ring-blue-500 dark:border-zinc-600',
        true: 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500',
      },
    },
    defaultVariants: {
      invalid: false,
    },
  }
)

function Input({
  className,
  type,
  invalid = false,
  ...props
}: React.ComponentProps<'input'> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ invalid, className }))}
      {...props}
    />
  )
}

/**
 * `<select>` styled to match {@link Input}. Distinct from `ui/select.tsx`,
 * which is the Radix listbox — this is the plain native control the forms use.
 */
function SelectInput({
  className,
  invalid = false,
  ...props
}: React.ComponentProps<'select'> & VariantProps<typeof inputVariants>) {
  return (
    <select
      data-slot="select-input"
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ invalid, className }))}
      {...props}
    />
  )
}

/** Multi-line counterpart to {@link Input}. */
function Textarea({
  className,
  invalid = false,
  ...props
}: React.ComponentProps<'textarea'> & VariantProps<typeof inputVariants>) {
  return (
    <textarea
      data-slot="textarea"
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ invalid, className }))}
      {...props}
    />
  )
}

export { Input, SelectInput, Textarea, inputVariants }
