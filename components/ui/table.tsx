'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Data table in the app's zinc idiom — a bordered card wrapping a
 * `divide-y` table with compact uppercase headers. Like `button.tsx`, this
 * replaces the stock shadcn semantic-token styling, which no table in the
 * product actually used.
 *
 * `TableRow` deliberately has no hover state: three of the five tables don't
 * want one. Clickable rows opt in via `className`.
 */
function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<'table'> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        'overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800',
        containerClassName
      )}
    >
      <table
        data-slot="table"
        className={cn('min-w-full divide-y divide-zinc-200 dark:divide-zinc-700', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('bg-zinc-50 dark:bg-zinc-700/50', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('divide-y divide-zinc-200 dark:divide-zinc-700', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t border-zinc-200 font-medium dark:border-zinc-700', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={className} {...props} />
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'px-4 py-3 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('px-4 py-3 text-sm', className)} {...props} />
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-zinc-500 dark:text-zinc-400', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
