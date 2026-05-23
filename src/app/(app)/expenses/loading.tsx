import { Skeleton } from "@/components/ui/skeleton"

export default function ExpensesLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-hidden">
        {[80, 64, 96, 72].map((w, i) => (
          <Skeleton key={i} className={`h-7 w-${w} rounded-full shrink-0`} style={{ width: w }} />
        ))}
      </div>

      {/* Date group header */}
      <Skeleton className="h-4 w-24 mt-1" />

      {/* Expense list items */}
      <div className="space-y-0 divide-y divide-border rounded-2xl border overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 bg-card">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton className="h-3.5" style={{ width: `${55 + (i % 3) * 15}%` }} />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="text-right space-y-1.5 shrink-0">
              <Skeleton className="h-3.5 w-14 ml-auto" />
              <Skeleton className="h-3 w-10 ml-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}
