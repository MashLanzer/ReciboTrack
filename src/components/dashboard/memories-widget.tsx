"use client"

import { useMemo } from "react"
import { subYears, subDays, addDays, startOfMonth, endOfMonth } from "date-fns"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency } from "@/lib/utils"
import type { Expense } from "@/types"

export function MemoriesWidget() {
  const { activeAccount } = useUIStore()
  const now = new Date()

  // ── Last year ±2 days window ──────────────────────────────────────────────
  const lastYearCenter = subYears(now, 1)
  const start = subDays(lastYearCenter, 2)
  const end   = addDays(lastYearCenter, 2)

  const { data: rawLastYear = [] } = useExpensesPeriod(start, end)

  // ── Same month this year vs last year (for comparison) ───────────────────
  const thisMonthStart  = startOfMonth(now)
  const thisMonthEnd    = endOfMonth(now)
  const lastMonthStart  = startOfMonth(lastYearCenter)
  const lastMonthEnd    = endOfMonth(lastYearCenter)

  const { data: thisMonthRaw = [] } = useExpensesPeriod(thisMonthStart, thisMonthEnd)
  const { data: lastMonthRaw = [] } = useExpensesPeriod(lastMonthStart, lastMonthEnd)

  const filtered = useMemo(() => {
    const filterAccount = (e: Expense) =>
      activeAccount === "business"
        ? e.account === "business"
        : !e.account || e.account === "personal"
    return rawLastYear.filter(filterAccount)
  }, [rawLastYear, activeAccount])

  const thisMonthExpenses = useMemo(() => {
    const filterAccount = (e: Expense) =>
      activeAccount === "business"
        ? e.account === "business"
        : !e.account || e.account === "personal"
    return thisMonthRaw.filter(filterAccount)
  }, [thisMonthRaw, activeAccount])

  const lastMonthExpenses = useMemo(() => {
    const filterAccount = (e: Expense) =>
      activeAccount === "business"
        ? e.account === "business"
        : !e.account || e.account === "personal"
    return lastMonthRaw.filter(filterAccount)
  }, [lastMonthRaw, activeAccount])

  if (filtered.length === 0) return null

  const totalLastYear = filtered.reduce((s, e) => s + e.total, 0)
  const top2 = [...filtered].sort((a, b) => b.total - a.total).slice(0, 2)

  // Category comparison
  const topCatLastYear = (() => {
    const map = new Map<string, number>()
    lastMonthExpenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.total))
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0]
  })()

  const thisYearCatTotal = topCatLastYear
    ? thisMonthExpenses.filter((e) => e.category === topCatLastYear[0]).reduce((s, e) => s + e.total, 0)
    : 0
  const lastYearCatTotal = topCatLastYear?.[1] ?? 0

  const pctChange = lastYearCatTotal > 0
    ? Math.round(((thisYearCatTotal - lastYearCatTotal) / lastYearCatTotal) * 100)
    : null

  const dateLabel = format(lastYearCenter, "d 'de' MMMM 'de' yyyy", { locale: es })

  return (
    <div className="rounded-2xl border bg-primary/5 border-primary/20 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary/70">Recuerdos</p>
          <p className="text-sm font-bold mt-0.5 capitalize">📅 Hoy, hace un año</p>
        </div>
        <p className="text-[11px] text-muted-foreground capitalize">{dateLabel}</p>
      </div>

      {/* Total */}
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalLastYear)}</p>
        <p className="text-xs text-muted-foreground">gastados ese día</p>
      </div>

      {/* Top 2 expenses */}
      {top2.length > 0 && (
        <div className="space-y-1.5">
          {top2.map((e) => (
            <div key={e.id} className="flex items-center justify-between">
              <p className="text-xs font-medium truncate flex-1">{e.merchant}</p>
              <p className="text-xs tabular-nums font-semibold text-destructive shrink-0 ml-2">
                -{formatCurrency(e.total, e.currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Year-over-year comparison */}
      {pctChange !== null && topCatLastYear && (
        <p className="text-[11px] text-muted-foreground border-t border-primary/10 pt-2">
          Este año llevas{" "}
          <span className={pctChange > 0 ? "text-destructive font-semibold" : "text-green-600 font-semibold"}>
            {pctChange > 0 ? "+" : ""}{pctChange}%
          </span>{" "}
          {pctChange > 0 ? "más" : "menos"} en{" "}
          <span className="font-medium">{topCatLastYear[0]}</span> este mes
        </p>
      )}
    </div>
  )
}
