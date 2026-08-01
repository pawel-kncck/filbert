import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The "nothing here yet" card that every list view repeats: bordered panel,
 * centred text, optional outline icon above a heading and description.
 */
function EmptyState({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800',
        className
      )}
      {...props}
    />
  )
}

/** Outline glyph sized and centred for {@link EmptyState}. Pass an SVG path `d`. */
function EmptyStateIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      data-slot="empty-state-icon"
      className={cn('mx-auto h-12 w-12 text-zinc-400', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={path} />
    </svg>
  )
}

function EmptyStateTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="empty-state-title"
      className={cn('mt-4 text-lg font-medium text-zinc-900 dark:text-white', className)}
      {...props}
    />
  )
}

function EmptyStateDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty-state-description"
      className={cn('mt-2 text-sm text-zinc-600 dark:text-zinc-400', className)}
      {...props}
    />
  )
}

export { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription }
