"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  isToday, isYesterday, format,
  startOfDay, endOfDay, subDays,
} from "date-fns"
import { es } from "date-fns/locale"
import { Pencil, ArrowRight, Receipt } from "lucide-react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { Expense } from "@/types"

function expDate(e: Expense): Date {
  return (e.date as { toDate(): Date }).toDate()
}

function relativeLabel(d: Date): string {
  if (isToday(d))     return `Hoy · ${format(d, "HH:mm")}`
  if (isYesterday(d)) return "Ayer"
  return format(d, "d MMM", { locale: es })
}

// ── Group expenses by day ─────────────────────────────────────────────────────

interface DayGroup {
  label: string
  dateKey: string
  isToday: boolean
  total: number
  expenses: Expense[]
}

function groupByDay(expenses: Expense[]): DayGroup[] {
  const map = new Map<string, DayGroup>()
  const now = new Date()

  expenses.forEach(e => {
    const d = expDate(e)
    const key = format(d, "yyyy-MM-dd")
    if (!map.has(key)) {
      map.set(key, {
        label: isToday(d) ? "Hoy" : isYesterday(d) ? "Ayer" : format(d, "EEEE d MMM", { locale: es }),
        dateKey: key,
        isToday: isToday(d),
        total: 0,
        expenses: [],
      })
    }
    const group = map.get(key)!
    group.total += e.total
    group.expenses.push(e)
  })

  return Array.from(map.values()).slice(0, 5) // last 5 days
}

export function ActivityFeed() {
  const now = useMemo(() => new Date(), [])
  const start14 = useMemo(() => subDays(startOfDay(now), 13), [now])
  const { data: expenses = [], isLoading } = useExpensesPeriod(start14, endOfDay(now))
  const { data: categories = [] } = useCategories()
  const { setEditExpense, activeAccount } = useUIStore()

  const filtered = useMemo(() =>
    expenses.filter(e =>
      activeAccount === "business" ? e.account === "business" : !e.account || e.account === "personal"
    ), [expenses, activeAccount]
  )

  const groups = useMemo(() => groupByDay(filtered), [filtered])

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (filtered.length === 0) return null

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Actividad</p>
          <p className="text-sm font-bold mt-0.5">Últimos movimientos</p>
        </div>
        <Link
          href="/expenses"
          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Day groups */}
      <div className="divide-y divide-border/40">
        {groups.map(group => (
          <div key={group.dateKey}>
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
              <p className={cn(
                "text-[10px] font-semibold capitalize",
                group.isToday ? "text-primary" : "text-muted-foreground"
              )}>
                {group.label}
              </p>
              <p className="text-[10px] font-bold tabular-nums text-muted-foreground">
                {formatCurrency(group.total)}
              </p>
            </div>

            {/* Expenses */}
            <div className="divide-y divide-border/20">
              {group.expenses.slice(0, 4).map(e => {
                const catMeta = categories.find(c => c.id === (e.category ?? "otros"))
                const emoji = catMeta?.icon ?? "📦"
                const catName = catMeta?.name ?? (e.category ?? "Otros")

                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 px-4 py-2.5 group hover:bg-accent/30 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0 text-sm">
                      {emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold truncate leading-tight">{e.merchant}</p>
                        {e.privacy === "group" && <span className="text-[10px] shrink-0" title="Compartido con grupo">👥</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{catName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums text-destructive">
                        -{formatCurrency(e.total, e.currency)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{relativeLabel(expDate(e))}</p>
                    </div>
                    <button
                      onClick={() => setEditExpense(e)}
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0 ml-1"
                      aria-label="Editar gasto"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer link */}
      <div className="px-4 py-3 border-t border-border/60 bg-muted/20">
        <Link
          href="/expenses"
          className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Receipt className="h-3.5 w-3.5" />
          Ver historial completo de gastos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
