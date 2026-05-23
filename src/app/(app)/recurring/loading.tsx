import { Skeleton } from "@/components/ui/skeleton"

export default function RecurringLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      {/* Search bar */}
      <Skeleton className="h-9 w-full rounded-xl" />

      {/* View toggle + filter pills */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>

      {/* Subscription detector banner */}
      <Skeleton className="h-14 w-full rounded-xl" />

      {/* Urgent section */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <div className="rounded-2xl border divide-y divide-border overflow-hidden">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 bg-card">
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-3.5" style={{ width: `${60 + i * 10}%` }} />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="text-right space-y-1.5 shrink-0">
                <Skeleton className="h-3.5 w-14 ml-auto" />
                <Skeleton className="h-5 w-16 rounded-full ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming section */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <div className="rounded-2xl border divide-y divide-border overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 bg-card">
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-3.5" style={{ width: `${50 + (i % 3) * 12}%` }} />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="text-right space-y-1.5 shrink-0">
                <Skeleton className="h-3.5 w-14 ml-auto" />
                <Skeleton className="h-3 w-10 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
