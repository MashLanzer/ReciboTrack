import { Skeleton } from "@/components/ui/skeleton"

export default function BudgetsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 space-y-6">
      {/* Page title */}
      <div className="space-y-1">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3.5 w-64" />
      </div>

      {/* Global utilization header */}
      <Skeleton className="h-24 w-full rounded-2xl" />

      {/* Category budget ring charts grid */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 flex flex-col items-center gap-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="w-full space-y-1.5 text-center">
              <Skeleton className="h-3.5 w-20 mx-auto" />
              <Skeleton className="h-3 w-14 mx-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* Budget overview list */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trip link card */}
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  )
}
