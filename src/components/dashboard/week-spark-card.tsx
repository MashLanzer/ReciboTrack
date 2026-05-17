"use client"

import { useMemo } from "react"
import {
  startOfWeek, endOfWeek, subWeeks,
  isWithinInterval, isSameDay, format, isFuture, startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"
import { TrendingUp, TrendingDown, Minus, ArrowDown, ArrowUp } from "lucide-react"
import { useExpenses } from "@/hooks/use-expenses"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { Expense } from "@/types"

function expDate(e: Expense) {
  return (e.date as { toDate(): Date }).toDate()
}

export function WeekSparkCard() {
  const now = new Date()
  const { activeAccount } = useUIStore()

  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisWeekEnd   = endOfWeek(now, { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })

  const { data: result, isLoading } = useExpenses({
    startDate: lastWeekStart,
    endDate: thisWeekEnd,
    sort: "date_desc",
    account: activeAccount,
  })

  const expenses = result?.expenses ?? []

  const { days, thisTotal, lastTotal, delta, cheapest, priciest } = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(thisWeekStart)
      day.setDate(day.getDate() + i)
      const dayEnd = new Date(day)
      dayEnd.setHours(23, 59, 59, 999)
      const dayExp = expenses.filter(e =>
        isWithinInterval(expDate(e), { start: day, end: dayEnd })
      )
      return {
        date: day,
        label: format(day, "EEEEE", { locale: es }).toUpperCase(),
        dayNum: format(day, "d"),
        total: dayExp.reduce((s, e) => s + e.total, 0),
        isToday: isSameDay(day, now),
        isFuture: isFuture(startOfDay(day)) && !isSameDay(day, now),
      }
    })

    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    const thisTotal = days.reduce((s, d) => s + d.total, 0)
    const lastTotal = expenses
      .filter(e => isWithinInterval(expDate(e), { start: lastWeekStart, end: lastWeekEnd }))
      .reduce((s, e) => s + e.total, 0)
    const delta = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0

    const withSpend = days.filter(d => !d.isFuture && d.total > 0)
    const sorted = [...withSpend].sort((a, b) => a.total - b.total)
    const cheapest = sorted[0] ?? null
    const priciest = sorted[sorted.length - 1] ?? null

    return { days, thisTotal, lastTotal, delta, cheapest, priciest: cheapest !== priciest ? priciest : null }
  }, [expenses, thisWeekStart, now, lastWeekStart])

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />

  if (thisTotal === 0 && lastTotal === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center space-y-2">
        <p className="text-2xl">🌱</p>
        <p className="text-sm font-semibold">Sin gastos esta semana</p>
        <p className="text-xs text-muted-foreground">¡Lleva un registro de tus gastos diarios!</p>
      </div>
    )
  }

  const maxTotal = Math.max(...days.map(d => d.total), 1)
  const isUp    = delta > 2
  const isDown  = delta < -2
  const DIcon   = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  function barColor(total: number, isFutureDay: boolean, isToday: boolean) {
    if (isFutureDay) return "bg-border/50"
    if (total === 0) return "bg-border/40"
    if (isToday)     return "bg-primary"
    const pct = total / maxTotal
    if (pct >= 0.75) return "bg-destructive/70"
    if (pct >= 0.4)  return "bg-amber-400/80"
    return "bg-emerald-500/70"
  }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Semana actual</p>
          <p className="text-xl font-black tabular-nums mt-0.5">{formatCurrency(thisTotal)}</p>
        </div>
        {lastTotal > 0 && (
          <div className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold",
            isUp   ? "bg-destructive/10 text-destructive" :
            isDown ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                     "bg-muted text-muted-foreground"
          )}>
            <DIcon className="h-3.5 w-3.5" />
            {Math.abs(delta) < 1 ? "igual" : `${isUp ? "+" : "-"}${Math.abs(delta).toFixed(0)}%`}
            <span className="font-normal opacity-70 ml-0.5">sem.ant</span>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5" style={{ height: 56 }}>
        {days.map((d) => {
          const heightPct = d.total > 0 ? Math.max((d.total / maxTotal) * 100, 8) : 4
          return (
            <div key={d.dayNum} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-full rounded-t-lg transition-all duration-500",
                  barColor(d.total, d.isFuture, d.isToday),
                  d.isToday && "ring-1 ring-primary/40"
                )}
                style={{ height: `${heightPct}%`, minHeight: d.total > 0 ? 6 : 2 }}
              />
            </div>
          )
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-1.5">
        {days.map((d) => (
          <div key={d.dayNum} className="flex-1 flex flex-col items-center gap-0.5">
            <span className={cn(
              "text-[9px] font-mono font-bold",
              d.isToday ? "text-primary" : "text-muted-foreground/60"
            )}>
              {d.label}
            </span>
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold",
              d.isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}>
              {d.dayNum}
            </div>
          </div>
        ))}
      </div>

      {/* Best / Worst day chips */}
      {(cheapest || priciest) && (
        <div className="flex gap-2 pt-1 border-t border-border/60">
          {cheapest && (
            <div className="flex items-center gap-1.5 flex-1">
              <div className="h-5 w-5 rounded-full bg-emerald-500/12 flex items-center justify-center">
                <ArrowDown className="h-2.5 w-2.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Más económico</p>
                <p className="text-[10px] font-semibold capitalize">
                  {format(cheapest.date, "EEEE", { locale: es })} · {formatCurrency(cheapest.total)}
                </p>
              </div>
            </div>
          )}
          {priciest && (
            <div className="flex items-center gap-1.5 flex-1">
              <div className="h-5 w-5 rounded-full bg-destructive/10 flex items-center justify-center">
                <ArrowUp className="h-2.5 w-2.5 text-destructive" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Más caro</p>
                <p className="text-[10px] font-semibold capitalize">
                  {format(priciest.date, "EEEE", { locale: es })} · {formatCurrency(priciest.total)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
