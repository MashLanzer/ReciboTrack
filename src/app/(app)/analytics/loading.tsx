import { Skeleton } from "@/components/ui/skeleton"

export default function AnalyticsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-4">
      {/* Page title */}
      <Skeleton className="h-6 w-36" />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1 rounded-lg" />
        ))}
      </div>

      {/* Time selector */}
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-7 flex-1 rounded-full" />
        ))}
      </div>

      {/* Main chart */}
      <Skeleton className="h-52 w-full rounded-2xl" />

      {/* Summary cards row */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>

      {/* Category breakdown */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5" style={{ width: `${50 + i * 8}%` }} />
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
