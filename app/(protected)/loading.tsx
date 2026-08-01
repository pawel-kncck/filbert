import { Spinner } from '@/components/ui/spinner'

export default function ProtectedLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
    </div>
  )
}
