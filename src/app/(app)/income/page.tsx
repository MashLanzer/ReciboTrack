"use client"

import { useState, useMemo } from "react"
import { format, subMonths, startOfMonth, endOfMonth, getYear, getMonth } from "date-fns"
import { es } from "date-fns/locale"
import { TrendingUp } from "lucide-react"
import { IncomeBalance } from "@/components/dashboard/income-balance"
import { IncomeSourcesBreakdown } from "@/components/income/income-sources-breakdown"
import { IncomeProjection } from "@/components/income/income-projection"
import { RecurringIncomeSettings } from "@/components/income/recurring-income-settings"
import { useIncomePeriod } from "@/hooks/use-income"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { formatCurrency, cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Income } from "@/hooks/use-income"
import type { Expense } from "@/types"

// ─── Month selector ────────────────────────────────────────────────────────────

function buildMonthOptions() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(startOfMonth(now), i)
    return {
      label: format(d, "MMMM yyyy", { locale: es }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      start: startOfMonth(d),
      end: endOfMonth(d),
    }
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const options = buildMonthOptions()
  const [selected, setSelected] = useState(0)
  const { year, month } = options[selected]

  // Single query covering all 6 months — no N+1
  const periodStart = options[options.length - 1].start
  const periodEnd = options[0].end

  const { data: allIncome = [], isLoading: loadingIncome } = useIncomePeriod(periodStart, periodEnd)
  const { data: allExpenses = [], isLoading: loadingExpenses } = useExpensesPeriod(periodStart, periodEnd)
  const isLoading = loadingIncome || loadingExpenses

  // Group by year-month key for O(1) lookup
  const incomeByMonth = useMemo(() => {
    const map = new Map<string, Income[]>()
    for (const inc of allIncome) {
      const d = inc.date.toDate()
      const key = `${getYear(d)}-${getMonth(d) + 1}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(inc)
    }
    return map
  }, [allIncome])

  const expensesByMonth = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const exp of allExpenses) {
      const d = (exp.date as { toDate(): Date }).toDate()
      const key = `${getYear(d)}-${getMonth(d) + 1}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(exp)
    }
    return map
  }, [allExpenses])

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
          <TrendingUp className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="font-bold text-xl">Ingresos y Balance</h1>
          <p className="text-xs text-muted-foreground">Cuánto ganas vs cuánto gastas</p>
        </div>
      </div>

      {/* Recurring income templates */}
      <RecurringIncomeSettings />

      {/* Income sources breakdown */}
      <IncomeSourcesBreakdown />

      {/* Month KPI summary */}
      {!isLoading && (() => {
        const key = `${year}-${month}`
        const incList = incomeByMonth.get(key) ?? []
        const expList = expensesByMonth.get(key) ?? []
        const totalIncome = incList.reduce((s, i) => s + i.amount, 0)
        const totalExpenses = expList.reduce((s, e) => s + (e.total || 0), 0)
        const balance = totalIncome - totalExpenses
        const hasData = totalIncome > 0 || totalExpenses > 0
        return (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border bg-card px-3 py-3 text-center space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ingresos</p>
              <p className="text-sm font-bold tabular-nums text-green-600">
                {totalIncome > 0 ? formatCurrency(totalIncome) : <span className="text-muted-foreground font-normal">—</span>}
              </p>
            </div>
            <div className="rounded-2xl border bg-card px-3 py-3 text-center space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gastos</p>
              <p className="text-sm font-bold tabular-nums text-destructive">
                {totalExpenses > 0 ? formatCurrency(totalExpenses) : <span className="text-muted-foreground font-normal">—</span>}
              </p>
            </div>
            <div className={cn(
              "rounded-2xl border bg-card px-3 py-3 text-center space-y-1",
              hasData && balance > 0 && "border-green-500/30 bg-green-500/5",
              hasData && balance < 0 && "border-destructive/30 bg-destructive/5"
            )}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Balance</p>
              <p className={cn(
                "text-sm font-bold tabular-nums",
                !hasData ? "text-muted-foreground" :
                balance > 0 ? "text-green-600" :
                balance < 0 ? "text-destructive" : "text-foreground"
              )}>
                {!hasData ? "—" : `${balance >= 0 ? "+" : ""}${formatCurrency(Math.abs(balance))}`}
              </p>
            </div>
          </div>
        )
      })()}

      {/* Month selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize",
              selected === i
                ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20 ring-offset-1"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Income + Balance for selected month */}
      <IncomeBalance year={year} month={month} />

      {/* Income projection based on last 3 months average */}
      <IncomeProjection incomeData={allIncome} year={year} month={month} />

      {/* 6-month history table — data already loaded, zero extra queries */}
      {isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-3 w-32" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial 6 meses</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2">Mes</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2">Ingresos</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2">Gastos</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {options.map((opt) => {
                const key = `${opt.year}-${opt.month}`
                const incList = incomeByMonth.get(key) ?? []
                const expList = expensesByMonth.get(key) ?? []
                const totalIncome = incList.reduce((s, i) => s + i.amount, 0)
                const totalExpenses = expList.reduce((s, e) => s + (e.total || 0), 0)
                const balance = totalIncome - totalExpenses
                const isPositive = balance >= 0
                const noData = totalIncome === 0 && totalExpenses === 0
                const labelLong = format(new Date(opt.year, opt.month - 1), "MMMM yyyy", { locale: es })

                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/20",
                      opt.year === year && opt.month === month && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-3 text-xs font-medium capitalize">{labelLong}</td>
                    <td className="text-right px-3 py-3 tabular-nums text-xs font-semibold text-green-600">
                      {totalIncome > 0 ? formatCurrency(totalIncome) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-right px-3 py-3 tabular-nums text-xs font-semibold text-destructive">
                      {totalExpenses > 0 ? formatCurrency(totalExpenses) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={cn("text-right px-4 py-3 tabular-nums text-xs font-bold", isPositive ? "text-green-600" : "text-destructive")}>
                      {noData ? (
                        <span className="text-muted-foreground font-normal">Sin datos</span>
                      ) : (
                        <>{isPositive ? "+" : "-"}{formatCurrency(Math.abs(balance))}</>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
