"use client"

import { useFlaggedExpenses, useFlagExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency } from "@/lib/utils"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { Check, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export function FlaggedExpensesPanel() {
  const { data: flagged = [], isLoading } = useFlaggedExpenses()
  const { data: categories = [] } = useCategories()
  const flagExpense = useFlagExpense()
  const { setEditExpense } = useUIStore()

  if (isLoading) return <Skeleton className="h-20 rounded-2xl" />
  if (flagged.length === 0) return null

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 bg-amber-500/5">
        <p className="text-sm font-bold">🔖 Pendientes ({flagged.length})</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Gastos marcados como pendientes de revisión</p>
      </div>

      <div className="divide-y divide-border/20">
        {flagged.map((e) => {
          const catMeta = categories.find((c) => c.id === (e.category ?? "otros"))
          const emoji = catMeta?.icon ?? "📦"
          const d = (e.date as { toDate(): Date }).toDate()
          const flaggedDate = e.flaggedAt ? (e.flaggedAt as { toDate(): Date }).toDate() : d
          const daysAgo = differenceInDays(new Date(), flaggedDate)

          return (
            <div
              key={e.id}
              className="flex items-center gap-3 px-4 py-2.5 group hover:bg-accent/30 transition-colors"
            >
              <div className="h-8 w-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 text-sm">
                {emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{e.merchant}</p>
                <p className="text-[10px] text-muted-foreground">
                  Marcado hace {daysAgo === 0 ? "hoy" : `${daysAgo} día${daysAgo > 1 ? "s" : ""}`}
                  {" · "}{format(d, "d MMM", { locale: es })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums text-destructive">
                  -{formatCurrency(e.total, e.currency)}
                </p>
              </div>
              <button
                onClick={async () => {
                  await flagExpense.mutateAsync({ id: e.id, flagged: false })
                  toast.success("Marcado como resuelto")
                }}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline shrink-0"
                title="Resolver"
                disabled={flagExpense.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                Resolver
              </button>
              <button
                onClick={() => setEditExpense(e)}
                className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0"
                aria-label="Editar gasto"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {flagged.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">Sin pendientes — todo al día ✓</p>
        </div>
      )}
    </div>
  )
}
