"use client"

import { useMemo, useState } from "react"
import { useExpenses } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronDown, ChevronUp, Pencil } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { Expense } from "@/types"

interface Thread {
  key: string
  label: string
  expenses: Expense[]
  total: number
  dateRange: string
}

function buildThreads(expenses: Expense[]): { tagged: Thread[]; byMerchant: Thread[]; unthreaded: Expense[] } {
  // Group by tags
  const tagMap = new Map<string, Expense[]>()
  const merchantMap = new Map<string, Expense[]>()
  const unthreaded: Expense[] = []

  for (const e of expenses) {
    if (e.tags && e.tags.length > 0) {
      for (const tag of e.tags) {
        const list = tagMap.get(tag) ?? []
        list.push(e)
        tagMap.set(tag, list)
      }
    } else {
      // Will go to merchant grouping or unthreaded
      const key = e.merchant.trim().toLowerCase()
      const list = merchantMap.get(key) ?? []
      list.push(e)
      merchantMap.set(key, list)
    }
  }

  function dateRange(exps: Expense[]): string {
    if (exps.length === 0) return ""
    const dates = exps.map((e) => (e.date as { toDate(): Date }).toDate())
    dates.sort((a, b) => a.getTime() - b.getTime())
    if (exps.length === 1) return format(dates[0], "d MMM", { locale: es })
    return `${format(dates[0], "d MMM", { locale: es })} – ${format(dates[dates.length - 1], "d MMM", { locale: es })}`
  }

  const tagged: Thread[] = Array.from(tagMap.entries()).map(([tag, exps]) => ({
    key: `tag:${tag}`,
    label: tag,
    expenses: exps,
    total: exps.reduce((s, e) => s + e.total, 0),
    dateRange: dateRange(exps),
  }))

  const byMerchant: Thread[] = []
  for (const [key, exps] of merchantMap.entries()) {
    if (exps.length >= 3) {
      byMerchant.push({
        key: `merchant:${key}`,
        label: exps[0].merchant,
        expenses: exps,
        total: exps.reduce((s, e) => s + e.total, 0),
        dateRange: dateRange(exps),
      })
    } else {
      unthreaded.push(...exps)
    }
  }

  return { tagged, byMerchant, unthreaded }
}

function ThreadCard({ thread }: { thread: Thread }) {
  const [open, setOpen] = useState(false)
  const { data: categories = [] } = useCategories()
  const { setEditExpense } = useUIStore()

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold capitalize truncate">{thread.label}</p>
          <p className="text-[10px] text-muted-foreground">
            {thread.expenses.length} gasto{thread.expenses.length > 1 ? "s" : ""} · {thread.dateRange}
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums text-destructive shrink-0">
          {formatCurrency(thread.total)}
        </p>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="divide-y divide-border/20 border-t border-border/40">
          {thread.expenses.map((e) => {
            const catMeta = categories.find((c) => c.id === (e.category ?? "otros"))
            const emoji = catMeta?.icon ?? "📦"
            const d = (e.date as { toDate(): Date }).toDate()

            return (
              <div
                key={e.id}
                className="flex items-center gap-3 px-4 py-2 group hover:bg-accent/30 transition-colors"
              >
                <span className="text-base">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{e.merchant}</p>
                  <p className="text-[10px] text-muted-foreground">{format(d, "d MMM", { locale: es })}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-destructive shrink-0">
                  -{formatCurrency(e.total, e.currency)}
                </p>
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
      )}
    </div>
  )
}

export function ExpenseThreads() {
  const { data, isLoading } = useExpenses({ page: 1 })
  const { setEditExpense } = useUIStore()
  const { data: categories = [] } = useCategories()
  const expenses = data?.expenses ?? []

  const { tagged, byMerchant, unthreaded } = useMemo(() => buildThreads(expenses), [expenses])

  if (isLoading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
    </div>
  )

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Sin gastos para organizar en hilos
      </div>
    )
  }

  const allThreads = [...tagged, ...byMerchant]

  return (
    <div className="space-y-3">
      {allThreads.length === 0 && unthreaded.length === 0 && (
        <p className="text-center py-8 text-sm text-muted-foreground">
          Añade etiquetas a tus gastos para crear hilos
        </p>
      )}

      {allThreads.map((thread) => (
        <ThreadCard key={thread.key} thread={thread} />
      ))}

      {unthreaded.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 bg-muted/30">
            <p className="text-sm font-semibold text-muted-foreground">
              Sin hilo ({unthreaded.length})
            </p>
          </div>
          <div className="divide-y divide-border/20">
            {unthreaded.map((e) => {
              const catMeta = categories.find((c) => c.id === (e.category ?? "otros"))
              const emoji = catMeta?.icon ?? "📦"
              const d = (e.date as { toDate(): Date }).toDate()

              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-2 group hover:bg-accent/30 transition-colors"
                >
                  <span className="text-base">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{e.merchant}</p>
                    <p className="text-[10px] text-muted-foreground">{format(d, "d MMM", { locale: es })}</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-destructive shrink-0">
                    -{formatCurrency(e.total, e.currency)}
                  </p>
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
        </div>
      )}
    </div>
  )
}
