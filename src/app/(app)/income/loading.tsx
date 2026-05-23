import { Skeleton } from "@/components/ui/skeleton"

export default function IncomeLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      {/* Month selector pills */}
      <div className="flex gap-2 overflow-hidden">
        {[72, 88, 72, 80, 72, 72].map((w, i) => (
          <Skeleton key={i} className="h-7 rounded-full shrink-0" style={{ width: w }} />
        ))}
      </div>

      {/* Income balance card */}
      <Skeleton className="h-32 w-full rounded-2xl" />

      {/* Income sources breakdown */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5" style={{ width: `${50 + i * 14}%` }} />
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* 6-month history table */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Skeleton className="h-3.5 w-32" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
