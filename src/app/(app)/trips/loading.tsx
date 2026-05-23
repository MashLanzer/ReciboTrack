import { Skeleton } from "@/components/ui/skeleton"

export default function TripsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
      </div>

      {/* Active trip card — tall */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
        {/* Stat row */}
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl bg-muted/50 p-2.5 space-y-1">
              <Skeleton className="h-3 w-12 mx-auto" />
              <Skeleton className="h-4 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Past trips section */}
      <Skeleton className="h-3.5 w-28 mt-2" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4" style={{ width: `${50 + i * 12}%` }} />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="text-right space-y-1.5 shrink-0">
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-3 w-10 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
