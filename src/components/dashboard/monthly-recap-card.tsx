"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useCategories } from "@/hooks/use-categories"
import { useIncomePeriod } from "@/hooks/use-income"
import { startOfMonth, endOfMonth, subMonths, format, getDaysInMonth, getDate } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency, percentChange } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Minus, CalendarDays } from "lucide-react"
import type { Expense } from "@/types"

function useMonthlyRecapData() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["monthly-recap", user?.uid],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return [] as Expense[]
      const start = startOfMonth(subMonths(new Date(), 1))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

export function MonthlyRecapCard() {
  const { data: allExpenses = [], isLoading } = useMonthlyRecapData()
  const { data: categories = [] } = useCategories()

  const now = new Date()
  const currentStart = startOfMonth(now)
  const currentEnd = endOfMonth(now)
  const prevStart = startOfMonth(subMonths(now, 1))
  const prevEnd = endOfMonth(subMonths(now, 1))

  const { data: currentIncome = [] } = useIncomePeriod(currentStart, currentEnd)
  const { data: prevIncome = [] } = useIncomePeriod(prevStart, prevEnd)

  const { current, previous } = useMemo(() => {
    const curr = allExpenses.filter((e) => {
      const d = e.date.toDate()
      return d >= currentStart && d <= currentEnd
    })
    const prev = allExpenses.filter((e) => {
      const d = e.date.toDate()
      return d >= prevStart && d <= prevEnd
    })
    return { current: curr, previous: prev }
  }, [allExpenses, currentStart, currentEnd, prevStart, prevEnd])

  const currTotal = current.reduce((a, e) => a + e.total, 0)
  const prevTotal = previous.reduce((a, e) => a + e.total, 0)
  const delta = percentChange(currTotal, prevTotal)

  const currIncome = currentIncome.reduce((a, i) => a + i.amount, 0)
  const prevIncomeTotal = prevIncome.reduce((a, i) => a + i.amount, 0)

  // Top category this month
  const topCategory = useMemo(() => {
    const map: Record<string, number> = {}
    current.forEach((e) => { map[e.category] = (map[e.category] ?? 0) + e.total })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    if (!sorted.length) return null
    const cat = categories.find((c) => c.id === sorted[0][0])
    return cat ? { ...cat, total: sorted[0][1] } : null
  }, [current, categories])

  // Daily projection
  const dayOfMonth = getDate(now)
  const daysInMonth = getDaysInMonth(now)
  const dailyAvg = dayOfMonth > 0 ? currTotal / dayOfMonth : 0
  const projected = dailyAvg * daysInMonth
  const savingsRate = currIncome > 0 ? Math.max(0, (currIncome - currTotal) / currIncome) * 100 : null

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-primary" />
          Resumen del mes
        </CardTitle>
        <p className="text-xs text-muted-foreground capitalize">
          {format(now, "MMMM yyyy", { locale: es })}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main metric */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Gasto total</p>
            <p className="tabular-nums text-2xl font-bold mt-0.5">{formatCurrency(currTotal)}</p>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium pb-1">
            {delta === 0 ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Minus className="h-3.5 w-3.5" /> Sin cambio
              </span>
            ) : delta > 0 ? (
              <span className="flex items-center gap-1 text-destructive">
                <TrendingUp className="h-3.5 w-3.5" /> +{delta.toFixed(1)}%
              </span>
            ) : (
              <span className="flex items-center gap-1 text-green-600">
                <TrendingDown className="h-3.5 w-3.5" /> {delta.toFixed(1)}%
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">vs {format(subMonths(now, 1), "MMM", { locale: es })}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Proyectado</p>
            <p className="tabular-nums text-sm font-semibold mt-0.5">{formatCurrency(projected)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Mes anterior</p>
            <p className="tabular-nums text-sm font-semibold mt-0.5">{formatCurrency(prevTotal)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Transacciones</p>
            <p className="tabular-nums text-sm font-semibold mt-0.5">{current.length}</p>
          </div>
        </div>

        {/* Top category + savings rate */}
        <div className="flex items-center gap-3 border-t pt-2.5">
          {topCategory && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                style={{ backgroundColor: `${topCategory.color}20` }}
              >
                {topCategory.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Mayor categoría</p>
                <p className="text-xs font-semibold truncate">{topCategory.name}</p>
                <p className="text-[10px] tabular-nums text-muted-foreground">{formatCurrency(topCategory.total)}</p>
              </div>
            </div>
          )}
          {savingsRate !== null && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground">Tasa ahorro</p>
              <p className={`text-sm font-bold tabular-nums ${savingsRate >= 20 ? "text-green-600" : savingsRate >= 10 ? "text-amber-600" : "text-destructive"}`}>
                {savingsRate.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
