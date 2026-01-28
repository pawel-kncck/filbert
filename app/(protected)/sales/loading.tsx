export default function SalesLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="mt-2 h-6 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="h-10 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex h-12 items-center gap-4 border-b border-zinc-100 px-4 dark:border-zinc-800"
          >
            <div className="h-4 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 flex-1 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  )
}
