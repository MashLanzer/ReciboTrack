import { Skeleton } from "@/components/ui/skeleton"

export default function GroupsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Group cards */}
      {[...Array(2)].map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card overflow-hidden">
          {/* Group header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full shrink-0" />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-2 bg-muted/30">
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="h-7 flex-1 rounded-lg" />
            ))}
          </div>

          {/* Content rows */}
          <div className="divide-y divide-border">
            {[...Array(3)].map((_, k) => (
              <div key={k} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5" style={{ width: `${55 + k * 10}%` }} />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-14 shrink-0" />
              </div>
            ))}
          </div>

          {/* Balance row */}
          <div className="px-4 py-3 border-t bg-muted/20">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
