"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useUIStore } from "@/stores/ui-store"
import {
  subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear,
  getMonth, getYear, format,
} from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingDown, TrendingUp, CalendarClock } from "lucide-react"

// ─── Data hook — 24 months so we have last year's data too ───────────────────

function use24MonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-24m-projection", user?.uid],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 23))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

function totalInRange(expenses: Expense[], start: Date, end: Date): number {
  return expenses
    .filter(e => { const d = e.date.toDate(); return d >= start && d <= end })
    .reduce((a, e) => a + e.total, 0)
}

// ─── Main component ────────────────────────────────────────────────────────────

export function YearProjection() {
  const { data: rawExpenses = [], isLoading } = use24MonthExpenses()
  const { activeAccount } = useUIStore()

  const allExpenses = useMemo(() => {
    if (activeAccount === "business") return rawExpenses.filter(e => e.account === "business")
    return rawExpenses.filter(e => !e.account || e.account === "personal")
  }, [rawExpenses, activeAccount])

  const now = new Date()
  const currentYear = getYear(now)
  const currentMonth = getMonth(now) // 0-indexed

  const {
    spentThisYear,
    projectedRest,
    totalProjected,
    lastYearTotal,
    monthsRemaining,
    avgLast3,
  } = useMemo(() => {
    // Spent this year so far (Jan → today)
    const yearStart = startOfYear(now)
    const spentThisYear = totalInRange(allExpenses, yearStart, now)

    // Average of last 3 months (month 0=current, 1=prev, 2=2 months ago)
    const last3Totals = [0, 1, 2].map(offset => {
      const ref = subMonths(now, offset)
      return totalInRange(allExpenses, startOfMonth(ref), endOfMonth(ref))
    })
    const last3NonZero = last3Totals.filter(t => t > 0)
    const avgLast3 = last3NonZero.length > 0
      ? last3NonZero.reduce((a, b) => a + b, 0) / last3NonZero.length
      : 0

    // Months remaining in current year (from next month to December)
    const monthsRemaining = 11 - currentMonth  // currentMonth is 0-indexed; 11=Dec
    const projectedRest = avgLast3 * monthsRemaining

    const totalProjected = spentThisYear + projectedRest

    // Last year total
    const lastYearStart = startOfYear(subYears(now, 1))
    const lastYearEnd = endOfYear(subYears(now, 1))
    const lastYearTotal = totalInRange(allExpenses, lastYearStart, lastYearEnd)

    return { spentThisYear, projectedRest, totalProjected, lastYearTotal, monthsRemaining, avgLast3 }
  }, [allExpenses, now, currentMonth])

  const hasLastYearData = lastYearTotal > 0
  const vsLastYear = hasLastYearData
    ? ((totalProjected - lastYearTotal) / lastYearTotal) * 100
    : null

  // Bar widths: real portion vs projected portion
  const barSpentPct = totalProjected > 0 ? Math.min((spentThisYear / totalProjected) * 100, 100) : 0

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />
  if (spentThisYear === 0 && projectedRest === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-primary" />
              Proyección fin de año {currentYear}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Promedio últimos 3 meses · {monthsRemaining} {monthsRemaining === 1 ? "mes restante" : "meses restantes"}
            </p>
          </div>
          {vsLastYear !== null && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">vs {currentYear - 1}</p>
              <div className={`flex items-center gap-1 text-sm font-semibold ${vsLastYear > 0 ? "text-destructive" : "text-green-600"}`}>
                {vsLastYear > 0
                  ? <TrendingUp className="h-3.5 w-3.5" />
                  : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(vsLastYear).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Acumulado {format(now, "MMM", { locale: es })}
            </p>
            <p className="tabular-nums text-base font-bold mt-0.5">{formatCurrency(spentThisYear)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Proyección resto</p>
            <p className="tabular-nums text-base font-bold mt-0.5 text-muted-foreground">{formatCurrency(projectedRest)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total proyectado</p>
            <p className="tabular-nums text-base font-bold mt-0.5">{formatCurrency(totalProjected)}</p>
          </div>
        </div>

        {/* Progress bar: real (dark) + projected (light) */}
        <div className="space-y-1.5">
          <div className="h-3 rounded-full overflow-hidden bg-muted flex">
            <div
              className="h-full bg-foreground/80 rounded-l-full transition-all"
              style={{ width: `${barSpentPct}%` }}
            />
            <div
              className="h-full bg-foreground/20 transition-all"
              style={{ width: `${100 - barSpentPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-sm bg-foreground/80" />
              <span>Gastado real ({Math.round(barSpentPct)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-sm bg-foreground/20" />
              <span>Proyectado ({Math.round(100 - barSpentPct)}%)</span>
            </div>
          </div>
        </div>

        {/* Avg and last year comparison */}
        <div className="rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Promedio mensual (últ. 3m): <span className="font-semibold text-foreground tabular-nums">{formatCurrency(avgLast3)}</span>
          </span>
          {hasLastYearData && (
            <span className="text-muted-foreground tabular-nums">
              {currentYear - 1}: {formatCurrency(lastYearTotal)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
