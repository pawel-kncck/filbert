import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

type FormFieldProps = React.ComponentProps<'div'> & {
  /** Label text. Omit for controls that supply their own label markup. */
  label?: React.ReactNode
  /** Wired to the control's `id` so clicking the label focuses it. */
  htmlFor?: string
  /** When set, renders in place of `hint` and takes the error styling. */
  error?: string
  /** Muted helper text shown below the control. */
  hint?: React.ReactNode
  /** Appends the ` *` marker the forms use to flag mandatory fields. */
  required?: boolean
}

/**
 * `label` + control + error/hint, the trio that every form in the app repeats.
 * The control is passed as children and is responsible for its own `mt-1`
 * (which is what the existing markup does).
 */
function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
  ...props
}: FormFieldProps) {
  return (
    <div data-slot="form-field" className={className} {...props}>
      {label != null && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && ' *'}
        </Label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint != null ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  )
}

/** Standalone error text, for controls that can't be wrapped in a FormField. */
function FieldError({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-error"
      className={cn('mt-1 text-xs text-red-600 dark:text-red-400', className)}
      {...props}
    />
  )
}

export { FormField, FieldError }
