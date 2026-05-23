import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 space-y-4 animate-pulse">
      {/* Greeting */}
      <div className="space-y-1.5 pt-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Hero balance card */}
      <Skeleton className="h-44 w-full rounded-3xl" />

      {/* KPI grid 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>

      {/* Activity feed items */}
      <div className="space-y-2.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-1">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
