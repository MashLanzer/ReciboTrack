import { Skeleton } from "@/components/ui/skeleton"

export default function GoalsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      {/* Summary card */}
      <Skeleton className="h-28 w-full rounded-2xl" />

      {/* Goal cards */}
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 space-y-3">
            {/* Title row */}
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4" style={{ width: `${55 + i * 12}%` }} />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-14 rounded-full shrink-0" />
            </div>
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
            {/* Action row */}
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 flex-1 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
