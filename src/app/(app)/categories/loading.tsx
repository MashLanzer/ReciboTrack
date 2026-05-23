import { Skeleton } from "@/components/ui/skeleton"

export default function CategoriesLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      {/* Search */}
      <Skeleton className="h-9 w-full rounded-xl" />

      {/* Category list */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="divide-y divide-border">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-card">
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4" style={{ width: `${45 + (i % 4) * 12}%` }} />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-6 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
