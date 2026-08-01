'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type ConfirmOptions = {
  /** Heading. Defaults to `common.confirmTitle`. */
  title?: string
  /** Body copy — usually the only thing a call site needs to pass. */
  description: string
  /** Defaults to `common.confirm`. */
  confirmLabel?: string
  /** Defaults to `common.cancel`. */
  cancelLabel?: string
  /** Styling of the confirm button. Destructive actions should say so. */
  variant?: 'primary' | 'destructive'
}

type ConfirmDialogProps = ConfirmOptions & {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * Styled replacement for `window.confirm`. Prefer {@link useConfirmDialog},
 * which wraps this in the same `await`-a-boolean shape the native call had.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'destructive',
}: ConfirmDialogProps) {
  const t = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-md dark:bg-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-900 dark:text-white">
            {title ?? t('confirmTitle')}
          </DialogTitle>
          <DialogDescription className="text-zinc-600 dark:text-zinc-400">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel ?? t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * `const { confirm, confirmDialog } = useConfirmDialog()`
 *
 * `await confirm({ description })` resolves true/false just like `window.confirm`,
 * so call sites keep their `if (!(await confirm(...))) return` shape. Render
 * `confirmDialog` somewhere in the component's tree.
 */
function useConfirmDialog() {
  const [pending, setPending] = React.useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve })
      }),
    []
  )

  const settle = React.useCallback(
    (value: boolean) => {
      pending?.resolve(value)
      setPending(null)
    },
    [pending]
  )

  const confirmDialog = pending ? (
    <ConfirmDialog
      {...pending.options}
      open
      onOpenChange={(next) => {
        if (!next) settle(false)
      }}
      onConfirm={() => settle(true)}
    />
  ) : null

  return { confirm, confirmDialog }
}

export { ConfirmDialog, useConfirmDialog }
export type { ConfirmOptions }
