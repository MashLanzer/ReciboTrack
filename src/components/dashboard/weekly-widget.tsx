"use client"

import { useMemo } from "react"
import { useExpenses } from "@/hooks/use-expenses"
import { formatCurrency } from "@/lib/utils"
import { startOfWeek, endOfWeek, subWeeks, isWithinInterval, parseISO, format } from "date-fns"
import { es } from "date-fns/locale"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export function WeeklyWidget() {
  const now = new Date()

  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisWeekEnd   = endOfWeek(now,   { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const lastWeekEnd   = endOfWeek(subWeeks(now, 1),   { weekStartsOn: 1 })

  const { data: result } = useExpenses({
    startDate: lastWeekStart,
    endDate:   thisWeekEnd,
    sort: "date_desc",
  })

  const expenses = result?.expenses ?? []

  const { thisWeek, lastWeek, delta, deltaLabel, dayBars } = useMemo(() => {
    const thisWeek = expenses
      .filter((e) => isWithinInterval(e.date.toDate(), { start: thisWeekStart, end: thisWeekEnd }))
      .reduce((s, e) => s + e.total, 0)

    const lastWeek = expenses
      .filter((e) => isWithinInterval(e.date.toDate(), { start: lastWeekStart, end: lastWeekEnd }))
      .reduce((s, e) => s + e.total, 0)

    const delta = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0

    const deltaLabel =
      lastWeek === 0
        ? "—"
        : `${delta > 0 ? "+" : ""}${delta.toFixed(0)}% vs sem. ant.`

    // Mini bar chart: each day of the current week Mon-Sun
    const dayBars = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(thisWeekStart)
      day.setDate(day.getDate() + i)
      const dayEnd = new Date(day)
      dayEnd.setHours(23, 59, 59, 999)

      const total = expenses
        .filter((e) => isWithinInterval(e.date.toDate(), { start: day, end: dayEnd }))
        .reduce((s, e) => s + e.total, 0)

      return {
        label: format(day, "EEEEE", { locale: es }),
        total,
        isToday: format(day, "yyyy-MM-dd") === format(now, "yyyy-MM-dd"),
        isFuture: day > now,
      }
    })

    const maxBar = Math.max(...dayBars.map((d) => d.total), 1)
    return { thisWeek, lastWeek, delta, deltaLabel, dayBars, maxBar }
  }, [expenses, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, now])

  const maxBar = Math.max(...dayBars.map((d) => d.total), 1)

  return (
    <div className="rounded-2xl border bg-card px-4 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Esta semana
        </p>
        <span className={cn(
          "flex items-center gap-1 text-xs font-medium",
          delta > 0 ? "text-destructive" : delta < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )}>
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {deltaLabel}
        </span>
      </div>

      {/* Totals row */}
      <div className="flex items-end gap-3">
        <p className="text-2xl font-bold tabular-nums leading-none">{formatCurrency(thisWeek)}</p>
        {lastWeek > 0 && (
          <p className="text-xs text-muted-foreground pb-0.5">
            vs {formatCurrency(lastWeek)} la semana pasada
          </p>
        )}
      </div>

      {/* Day mini-bars */}
      <div className="flex items-end gap-1 h-10">
        {dayBars.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: 28 }}>
              <div
                className={cn(
                  "w-full rounded-sm transition-all",
                  d.isFuture
                    ? "bg-muted/40"
                    : d.isToday
                    ? "bg-primary"
                    : "bg-primary/30"
                )}
                style={{ height: d.total > 0 ? `${Math.max((d.total / maxBar) * 100, 12)}%` : "2px" }}
              />
            </div>
            <span className={cn(
              "text-[9px] font-medium",
              d.isToday ? "text-primary" : "text-muted-foreground/60"
            )}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
