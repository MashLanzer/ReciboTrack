"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useUIStore } from "@/stores/ui-store"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/lib/utils"
import { subMonths, subYears, startOfMonth, endOfMonth, format, getMonth, getYear } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingDown, TrendingUp, Minus, CalendarRange } from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, Legend,
} from "recharts"

// ─── Fetch 13 months so we have same month last year ─────────────────────────

function useYearComparisonData() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-13m-yoy", user?.uid],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 13))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

function DeltaBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" /> 0%
    </span>
  )
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-destructive" : "text-green-600"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function YearComparison() {
  const { data: rawExpenses = [], isLoading } = useYearComparisonData()
  const { activeAccount } = useUIStore()
  const { data: categories = [] } = useCategories()

  const allExpenses = useMemo(() => {
    if (activeAccount === 'business') return rawExpenses.filter(e => e.account === 'business')
    return rawExpenses.filter(e => !e.account || e.account === 'personal')
  }, [rawExpenses, activeAccount])

  const now = new Date()

  // Build 12-month YoY chart: for each of the last 12 months, compare to same month last year
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthOffset = 11 - i  // oldest first
      const thisMonthDate = subMonths(now, monthOffset)
      const lastYearDate  = subYears(thisMonthDate, 1)

      const thisStart = startOfMonth(thisMonthDate)
      const thisEnd   = endOfMonth(thisMonthDate)
      const lastStart = startOfMonth(lastYearDate)
      const lastEnd   = endOfMonth(lastYearDate)

      const thisTotal = allExpenses
        .filter(e => { const d = e.date.toDate(); return d >= thisStart && d <= thisEnd })
        .reduce((a, e) => a + e.total, 0)

      const lastTotal = allExpenses
        .filter(e => { const d = e.date.toDate(); return d >= lastStart && d <= lastEnd })
        .reduce((a, e) => a + e.total, 0)

      return {
        month: format(thisMonthDate, "MMM", { locale: es }),
        thisYear: parseFloat(thisTotal.toFixed(2)),
        lastYear: parseFloat(lastTotal.toFixed(2)),
        isCurrent: monthOffset === 0,
      }
    })
  }, [allExpenses, now])

  // Current month vs same month last year
  const currentMonthDate  = now
  const sameMonthLastYear = subYears(now, 1)

  const currentTotal = useMemo(() => {
    const s = startOfMonth(currentMonthDate)
    const e = endOfMonth(currentMonthDate)
    return allExpenses
      .filter(ex => { const d = ex.date.toDate(); return d >= s && d <= e })
      .reduce((a, ex) => a + ex.total, 0)
  }, [allExpenses, currentMonthDate])

  const lastYearTotal = useMemo(() => {
    const s = startOfMonth(sameMonthLastYear)
    const e = endOfMonth(sameMonthLastYear)
    return allExpenses
      .filter(ex => { const d = ex.date.toDate(); return d >= s && d <= e })
      .reduce((a, ex) => a + ex.total, 0)
  }, [allExpenses, sameMonthLastYear])

  // Category breakdown: current month this year vs last year
  const categoryBreakdown = useMemo(() => {
    const currStart = startOfMonth(currentMonthDate)
    const currEnd   = endOfMonth(currentMonthDate)
    const prevStart = startOfMonth(sameMonthLastYear)
    const prevEnd   = endOfMonth(sameMonthLastYear)

    const currMap: Record<string, number> = {}
    const prevMap: Record<string, number> = {}

    allExpenses.forEach(e => {
      const d = e.date.toDate()
      if (d >= currStart && d <= currEnd) {
        currMap[e.category] = (currMap[e.category] ?? 0) + e.total
      }
      if (d >= prevStart && d <= prevEnd) {
        prevMap[e.category] = (prevMap[e.category] ?? 0) + e.total
      }
    })

    const allCats = new Set([...Object.keys(currMap), ...Object.keys(prevMap)])
    return [...allCats].map(id => {
      const cat = categories.find(c => c.id === id)
      return {
        id,
        name: cat?.name ?? id,
        icon: cat?.icon ?? "📦",
        color: cat?.color ?? "#6b7280",
        curr: currMap[id] ?? 0,
        prev: prevMap[id] ?? 0,
        delta: pctChange(currMap[id] ?? 0, prevMap[id] ?? 0),
      }
    }).sort((a, b) => b.curr - a.curr).slice(0, 8)
  }, [allExpenses, categories, currentMonthDate, sameMonthLastYear])

  const thisYearLabel = String(getYear(currentMonthDate))
  const lastYearLabel = String(getYear(sameMonthLastYear))
  const delta = pctChange(currentTotal, lastYearTotal)

  if (isLoading) return <Skeleton className="h-56 rounded-xl" />

  // If we have no last year data at all, skip
  const hasLastYearData = allExpenses.some(e => {
    const d = e.date.toDate()
    return getYear(d) < getYear(now) || getMonth(d) < getMonth(now)
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4 text-primary" />
              Año actual vs. año anterior
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {format(currentMonthDate, "MMMM", { locale: es })} {thisYearLabel} vs {format(sameMonthLastYear, "MMMM", { locale: es })} {lastYearLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Este mes</p>
            <p className="font-bold tabular-nums">{formatCurrency(currentTotal)}</p>
            <DeltaBadge value={delta} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 12-month trend bars */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Últimos 12 meses</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip
                formatter={v => formatCurrency(Number(v))}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="lastYear" name={lastYearLabel} radius={[3, 3, 0, 0]}
                fill="hsl(var(--muted-foreground))" fillOpacity={0.3} />
              <Bar dataKey="thisYear" name={thisYearLabel} radius={[3, 3, 0, 0]}>
                {monthlyData.map((entry, i) => (
                  <Cell key={i}
                    fill="hsl(var(--foreground))"
                    fillOpacity={entry.isCurrent ? 0.9 : 0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown comparison */}
        {categoryBreakdown.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Por categoría — mes actual</p>
            <div className="space-y-2">
              {categoryBreakdown.map(cat => {
                const max = Math.max(cat.curr, cat.prev)
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <span>{cat.icon}</span>
                        <span className="font-medium">{cat.name}</span>
                      </span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-muted-foreground">{cat.prev > 0 ? formatCurrency(cat.prev) : "—"}</span>
                        <span className="font-semibold w-20 text-right">{cat.curr > 0 ? formatCurrency(cat.curr) : "—"}</span>
                        {(cat.curr > 0 || cat.prev > 0) && <DeltaBadge value={cat.delta} />}
                      </div>
                    </div>
                    {max > 0 && (
                      <div className="flex gap-1 h-1.5">
                        <div className="rounded-full bg-muted-foreground/30 transition-all"
                          style={{ width: `${(cat.prev / max) * 100}%` }} />
                        <div className="rounded-full bg-foreground/70 transition-all"
                          style={{ width: `${(cat.curr / max) * 100}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!hasLastYearData && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Datos del año anterior disponibles cuando lleves más de 12 meses usando la app
          </p>
        )}
      </CardContent>
    </Card>
  )
}
