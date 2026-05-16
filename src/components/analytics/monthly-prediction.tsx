"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useUIStore } from "@/stores/ui-store"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/lib/utils"
import { subMonths, startOfMonth, endOfMonth, addMonths, format, getDate, getDaysInMonth } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react"

// ─── Hook: 4 months of expenses ───────────────────────────────────────────────

function usePredictionData() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-4m-prediction", user?.uid],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 3))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

// ─── Weighted average of last 3 months (most recent = highest weight) ─────────
// Weights: [0.5, 0.33, 0.17] for [month-1, month-2, month-3]
const WEIGHTS = [0.5, 0.33, 0.17]

function weightedAvg(values: number[]): number {
  // values[0] = most recent month
  let sum = 0
  let totalWeight = 0
  for (let i = 0; i < Math.min(values.length, WEIGHTS.length); i++) {
    sum += values[i] * WEIGHTS[i]
    totalWeight += WEIGHTS[i]
  }
  return totalWeight > 0 ? sum / totalWeight : 0
}

function monthExpenses(all: Expense[], offset: number): Expense[] {
  const ref = subMonths(new Date(), offset)
  const start = startOfMonth(ref)
  const end = endOfMonth(ref)
  return all.filter(e => { const d = e.date.toDate(); return d >= start && d <= end })
}

function DeltaBadge({ value }: { value: number }) {
  if (Math.abs(value) < 1) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
      <Minus className="h-2.5 w-2.5" /> similar
    </span>
  )
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${up ? "text-destructive" : "text-green-600"}`}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {up ? "+" : ""}{value.toFixed(0)}%
    </span>
  )
}

export function MonthlyPrediction() {
  const { data: rawExpenses = [], isLoading } = usePredictionData()
  const { activeAccount } = useUIStore()
  const { data: categories = [] } = useCategories()

  const allExpenses = useMemo(() => {
    if (activeAccount === 'business') return rawExpenses.filter(e => e.account === 'business')
    return rawExpenses.filter(e => !e.account || e.account === 'personal')
  }, [rawExpenses, activeAccount])

  const now = new Date()
  const nextMonth = addMonths(now, 1)
  const currentMonthDay = getDate(now)
  const currentMonthDays = getDaysInMonth(now)
  const progressRatio = currentMonthDay / currentMonthDays

  const prediction = useMemo(() => {
    // Per-category weighted average
    const allCategoryIds = new Set<string>()
    allExpenses.forEach(e => allCategoryIds.add(e.category))

    const categoryPredictions = [...allCategoryIds].map(catId => {
      // Get totals for each of last 3 months
      const monthTotals = [1, 2, 3].map(offset =>
        monthExpenses(allExpenses, offset)
          .filter(e => e.category === catId)
          .reduce((a, e) => a + e.total, 0)
      )

      // Only use months where we actually had data (skip trailing zeros)
      const nonZero = monthTotals.filter(v => v > 0)
      if (nonZero.length === 0) return null

      const predicted = weightedAvg(monthTotals)
      const cat = categories.find(c => c.id === catId)
      const currentMonthTotal = monthExpenses(allExpenses, 0)
        .filter(e => e.category === catId)
        .reduce((a, e) => a + e.total, 0)

      // Extrapolate current month to full month for comparison
      const currentExtrapolated = progressRatio > 0 ? currentMonthTotal / progressRatio : 0

      return {
        id: catId,
        name: cat?.name ?? catId,
        icon: cat?.icon ?? "📦",
        color: cat?.color ?? "#6b7280",
        predicted,
        currentExtrapolated,
        delta: currentExtrapolated > 0
          ? ((predicted - currentExtrapolated) / currentExtrapolated) * 100
          : 0,
      }
    }).filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.predicted - a.predicted)

    const totalPredicted = categoryPredictions.reduce((a, c) => a + c.predicted, 0)
    const totalCurrentMonth = monthExpenses(allExpenses, 0).reduce((a, e) => a + e.total, 0)
    const totalCurrentExtrapolated = progressRatio > 0 ? totalCurrentMonth / progressRatio : 0

    return { categoryPredictions, totalPredicted, totalCurrentMonth, totalCurrentExtrapolated }
  }, [allExpenses, categories, progressRatio])

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />
  if (prediction.categoryPredictions.length === 0) return null

  const maxPredicted = Math.max(...prediction.categoryPredictions.map(c => c.predicted))
  const overallDelta = prediction.totalCurrentExtrapolated > 0
    ? ((prediction.totalPredicted - prediction.totalCurrentExtrapolated) / prediction.totalCurrentExtrapolated) * 100
    : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Predicción — {format(nextMonth, "MMMM yyyy", { locale: es })}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Basado en media ponderada de los últimos 3 meses
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Total previsto</p>
            <p className="font-bold text-lg tabular-nums">{formatCurrency(prediction.totalPredicted)}</p>
            <DeltaBadge value={overallDelta} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* Current month progress bar */}
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">
            Mes actual: <span className="font-semibold text-foreground">{formatCurrency(prediction.totalCurrentMonth)}</span>
          </span>
          <span className="text-muted-foreground">{currentMonthDay}/{currentMonthDays} días</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full rounded-full bg-primary/40 transition-all"
            style={{ width: `${progressRatio * 100}%` }} />
        </div>

        {/* Per-category bars */}
        {prediction.categoryPredictions.map(cat => (
          <div key={cat.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs flex items-center gap-1.5">
                <span>{cat.icon}</span>
                <span className="font-medium truncate max-w-[120px]">{cat.name}</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <DeltaBadge value={cat.delta} />
                <span className="text-xs font-semibold tabular-nums">{formatCurrency(cat.predicted)}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: maxPredicted > 0 ? `${(cat.predicted / maxPredicted) * 100}%` : "0%",
                  backgroundColor: cat.color,
                  opacity: 0.75,
                }}
              />
            </div>
          </div>
        ))}

        <p className="text-[10px] text-muted-foreground pt-1 border-t">
          * Pesos: 50% mes anterior · 33% hace 2 meses · 17% hace 3 meses
        </p>
      </CardContent>
    </Card>
  )
}
