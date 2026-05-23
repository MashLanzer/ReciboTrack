import { Skeleton } from "@/components/ui/skeleton"

export default function ProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 space-y-4">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 py-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-1.5 text-center">
          <Skeleton className="h-5 w-36 mx-auto" />
          <Skeleton className="h-3.5 w-44 mx-auto" />
        </div>
      </div>

      {/* Collapsible sections */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-2xl border overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-card">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          {/* Section rows (only show for first 2) */}
          {i < 2 && (
            <div className="divide-y divide-border border-t">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center justify-between px-4 py-3">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
