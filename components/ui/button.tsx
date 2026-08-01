import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Button variants are expressed in the app's zinc/blue palette rather than the
 * stock shadcn semantic tokens (`bg-primary` etc.), because `globals.css` maps
 * `--primary` to near-black while every button in the product is blue-600.
 *
 * Each variant/size pair reproduces a class string that already existed in the
 * codebase, so adopting the primitive is a no-op visually. When a call site
 * needs a one-off tweak (e.g. `rounded-lg`), pass it via `className` — `cn`
 * runs tailwind-merge, so the override wins.
 */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        outline:
          'border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700',
        ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700',
        /** Muted icon button that only picks up colour on hover. */
        subtle: 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        /** Outlined destructive — the softer "are you sure" affordance. */
        danger:
          'border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20',
        success: 'bg-green-600 text-white hover:bg-green-700',
        warning: 'bg-amber-600 text-white hover:bg-amber-700',
        /** Solid dark-on-light / light-on-dark — used by the landing page CTAs. */
        inverse:
          'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
        /** Inline text action; pair with `size="none"`. */
        link: 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300',
      },
      size: {
        /** 32px — compact table/toolbar actions. */
        sm: 'h-8 px-3 py-1.5 text-sm font-medium',
        /** 36px — the default form/dialog action. */
        md: 'h-9 px-4 py-2 text-sm font-medium',
        /** 40px, 16px text — full-width auth form submits. */
        lg: 'h-10 px-4 py-2 text-base',
        icon: 'p-1.5',
        'icon-sm': 'p-1',
        /** Opt out of padding/height/weight entirely; the call site supplies them. */
        none: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

function Button({
  className,
  variant = 'primary',
  size = 'md',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
