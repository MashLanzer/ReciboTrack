"use client"

import { useMemo, useState, useEffect } from "react"
import { startOfYear, endOfYear } from "date-fns"
import { Plus, X } from "lucide-react"
import { useHighlights, usePinHighlight, useGenerateHighlights, type Highlight } from "@/hooks/use-highlights"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useIncomePeriod } from "@/hooks/use-income"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export function HighlightsWidget() {
  const { data: highlights = [], isLoading } = useHighlights()
  const pinMutation   = usePinHighlight()
  const generateMutation = useGenerateHighlights()
  const [listOpen, setListOpen] = useState(false)

  // Preload data for generation
  const now = new Date()
  const yearStart = startOfYear(now)
  const yearEnd   = endOfYear(now)
  const { data: yearExpenses = [] } = useExpensesPeriod(yearStart, yearEnd)
  const { data: yearIncome = [] }   = useIncomePeriod(yearStart, yearEnd)

  // Auto-generate on first load if no highlights exist
  useEffect(() => {
    if (!isLoading && highlights.length === 0 && yearExpenses.length > 0 && !generateMutation.isPending) {
      generateMutation.mutate({ expenses: yearExpenses, income: yearIncome })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, highlights.length, yearExpenses.length])

  const pinned = useMemo(() => highlights.filter((h) => h.pinned).slice(0, 3), [highlights])
  const unpinned = useMemo(() => highlights.filter((h) => !h.pinned), [highlights])

  if (isLoading) return <Skeleton className="h-28 rounded-2xl" />

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Logros</p>
          <p className="text-sm font-bold mt-0.5">Tus destacados</p>
        </div>
        <button
          onClick={() => setListOpen((o) => !o)}
          className="h-7 w-7 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          aria-label="Gestionar logros"
        >
          {listOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Pinned cards — horizontal scroll */}
      {pinned.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {pinned.map((h) => (
            <HighlightCard key={h.id} highlight={h} onUnpin={() => pinMutation.mutate({ id: h.id, pinned: false })} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">
          Tus logros aparecerán aquí
        </p>
      )}

      {/* All highlights list (to pin) */}
      {listOpen && unpinned.length > 0 && (
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Fijar un logro</p>
          {unpinned.map((h) => (
            <button
              key={h.id}
              onClick={() => pinMutation.mutate({ id: h.id, pinned: true })}
              className="w-full flex items-center gap-3 rounded-xl border p-3 text-left hover:bg-accent/40 transition-colors"
            >
              <span className="text-xl shrink-0">{h.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{h.title}</p>
                <p className="text-xs text-muted-foreground truncate">{h.value}</p>
              </div>
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function HighlightCard({ highlight, onUnpin }: { highlight: Highlight; onUnpin: () => void }) {
  return (
    <div className={cn(
      "relative shrink-0 w-44 rounded-xl border p-3 space-y-1.5",
      "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20"
    )}>
      <button
        onClick={onUnpin}
        className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
        aria-label="Desfijar"
      >
        <X className="h-3 w-3" />
      </button>
      <span className="text-2xl">{highlight.icon}</span>
      <p className="text-[10px] font-mono uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">{highlight.title}</p>
      <p className="text-sm font-bold">{highlight.value}</p>
      {highlight.description && (
        <p className="text-[10px] text-muted-foreground leading-tight">{highlight.description}</p>
      )}
    </div>
  )
}
