"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useUIStore } from "@/stores/ui-store"
import { subMonths, startOfMonth, endOfMonth } from "date-fns"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { HeartPulse } from "lucide-react"

// ─── Data hook — 3 months of expenses ────────────────────────────────────────

function use3MonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-3m-health", user?.uid],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 2))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

function expensesInMonth(all: Expense[], offset: number): Expense[] {
  const ref = subMonths(new Date(), offset)
  const start = startOfMonth(ref)
  const end = endOfMonth(ref)
  return all.filter(e => {
    const d = e.date.toDate()
    return d >= start && d <= end
  })
}

// ─── Score arc SVG ────────────────────────────────────────────────────────────

function ScoreArc({ score, color }: { score: number; color: string }) {
  const radius = 60
  const cx = 80
  const cy = 80
  const circumference = Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <svg width="160" height="90" viewBox="0 0 160 90">
      {/* Background arc */}
      <path
        d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Foreground arc */}
      <path
        d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={`${offset}`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="28" fontWeight="700" fill="currentColor">
        {score}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">
        / 100
      </text>
    </svg>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FinancialHealth() {
  const { data: rawExpenses = [], isLoading } = use3MonthExpenses()
  const { activeAccount } = useUIStore()

  const allExpenses = useMemo(() => {
    if (activeAccount === "business") return rawExpenses.filter(e => e.account === "business")
    return rawExpenses.filter(e => !e.account || e.account === "personal")
  }, [rawExpenses, activeAccount])

  const { score, criteria } = useMemo(() => {
    const months = [0, 1, 2].map(offset => expensesInMonth(allExpenses, offset))
    const monthTotals = months.map(m => m.reduce((a, e) => a + e.total, 0))

    // 1. Consistencia (25 pts): cuántos de los 3 meses tienen gastos
    const monthsWithData = months.filter(m => m.length > 0).length
    const consistencyPts = Math.round((monthsWithData / 3) * 25)

    // 2. Control de presupuesto (25 pts): meses por debajo del promedio histórico
    const historicalAvg = monthTotals.reduce((a, b) => a + b, 0) / Math.max(monthTotals.filter(t => t > 0).length, 1)
    // Compare each past month (i > 0) against the historical average — not against the current month
    const monthsBelowAvg = monthTotals.filter((t, i) => i > 0 && t > 0 && t <= historicalAvg).length
    const budgetPts = historicalAvg > 0 ? Math.round((monthsBelowAvg / 2) * 25) : 0

    // 3. Sin anomalías (20 pts): sin categorías que superaron 2x su media
    const catTotals: Record<string, number[]> = {}
    months.forEach((m, mi) => {
      m.forEach(e => {
        if (!catTotals[e.category]) catTotals[e.category] = [0, 0, 0]
        catTotals[e.category][mi] += e.total
      })
    })
    const hasAnomaly = Object.values(catTotals).some(totals => {
      const nonZero = totals.filter(t => t > 0)
      if (nonZero.length < 2) return false
      const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length
      return totals[0] > avg * 2
    })
    const anomalyPts = hasAnomaly ? 0 : 20

    // 4. Diversidad de categorías (15 pts): usar al menos 4 categorías distintas
    const uniqueCats = new Set(months[0].map(e => e.category)).size
    const diversityPts = uniqueCats >= 4 ? 15 : Math.round((uniqueCats / 4) * 15)

    // 5. Gastos recurrentes controlados (15 pts): merchants que aparecen en los 3 meses
    const merchantSets = months.map(m => new Set(m.map(e => e.merchant.toLowerCase())))
    const recurringMerchants = [...merchantSets[0]].filter(m => merchantSets[1]?.has(m) && merchantSets[2]?.has(m))
    const recurringTotal = months[0]
      .filter(e => recurringMerchants.includes(e.merchant.toLowerCase()))
      .reduce((a, e) => a + e.total, 0)
    const currentTotal = monthTotals[0]
    const recurringRatio = currentTotal > 0 ? recurringTotal / currentTotal : 0
    const recurringPts = recurringRatio <= 0.5 ? 15 : Math.round((1 - recurringRatio) * 15)

    const total = Math.max(0, Math.min(100,
      consistencyPts + budgetPts + anomalyPts + diversityPts + recurringPts
    ))

    return {
      score: total,
      criteria: [
        { label: "Registro constante", pts: consistencyPts, max: 25, ok: consistencyPts >= 20 },
        { label: "Gasto controlado", pts: budgetPts, max: 25, ok: budgetPts >= 15 },
        { label: "Sin anomalías", pts: anomalyPts, max: 20, ok: anomalyPts === 20 },
        { label: "Categorías diversas", pts: diversityPts, max: 15, ok: diversityPts >= 12 },
        { label: "Fijos controlados", pts: recurringPts, max: 15, ok: recurringPts >= 10 },
      ],
    }
  }, [allExpenses])

  const color = score <= 40 ? "#ef4444" : score <= 70 ? "#f59e0b" : "#22c55e"
  const emoji = score <= 40 ? "😰" : score <= 70 ? "😐" : "😊"

  if (isLoading) return <Skeleton className="h-52 rounded-xl" />

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <HeartPulse className="h-4 w-4 text-primary" />
          Salud financiera
        </CardTitle>
        <p className="text-xs text-muted-foreground">Basada en los últimos 3 meses de actividad</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-1 mb-4">
          <ScoreArc score={score} color={color} />
          <span className="text-2xl -mt-2">{emoji}</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${color}20`, color }}
          >
            {score <= 40 ? "Necesita atención" : score <= 70 ? "En progreso" : "Excelente"}
          </span>
        </div>

        {/* Criteria pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {criteria.map(c => (
            <div
              key={c.label}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                c.ok
                  ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                  : "bg-muted/60 border-border text-muted-foreground"
              }`}
            >
              <span>{c.ok ? "✓" : "○"}</span>
              <span>{c.label}</span>
              <span className="opacity-60 tabular-nums">{c.pts}/{c.max}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
