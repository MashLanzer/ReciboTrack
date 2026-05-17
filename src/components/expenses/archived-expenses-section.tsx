"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, ArchiveRestore } from "lucide-react"
import { useArchivedExpenses, useUnarchiveExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export function ArchivedExpensesSection() {
  const [open, setOpen] = useState(false)
  const { data: archived = [], isLoading } = useArchivedExpenses()
  const { data: categories = [] } = useCategories()
  const unarchive = useUnarchiveExpense()

  if (isLoading) return <Skeleton className="h-12 rounded-2xl" />
  if (archived.length === 0) return null

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          📦 Archivados ({archived.length})
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y divide-border/40 border-t border-border/40">
          {archived.map((e) => {
            const catMeta = categories.find((c) => c.id === (e.category ?? "otros"))
            const emoji = catMeta?.icon ?? "📦"
            const d = (e.date as { toDate(): Date }).toDate()

            return (
              <div
                key={e.id}
                className="flex items-center gap-3 px-4 py-2.5 opacity-60 hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0 text-sm">
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{e.merchant}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(d, "d MMM yyyy", { locale: es })}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums text-muted-foreground shrink-0">
                  {formatCurrency(e.total, e.currency)}
                </p>
                <button
                  onClick={async () => {
                    await unarchive.mutateAsync(e.id)
                    toast.success("Gasto restaurado")
                  }}
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0 ml-1",
                  )}
                  title="Restaurar gasto"
                  disabled={unarchive.isPending}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  Restaurar
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
