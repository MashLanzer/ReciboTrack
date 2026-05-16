"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useCategories } from "@/hooks/use-categories"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts"

// ─── 12-month data hook ───────────────────────────────────────────────────────

function use12MonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-12m-cat-trend", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 11))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold capitalize mb-1">{label}</p>
      <p className="text-primary font-mono">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CategoryTrend() {
  const { data: expenses = [], isLoading } = use12MonthExpenses()
  const { data: categories = [] } = useCategories()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  const [selectedCat, setSelectedCat] = useState(allCats[0]?.id ?? "comida")

  const { chartData, avg, catTotal } = useMemo(() => {
    const now = new Date()
    const chartData = Array.from({ length: 12 }, (_, i) => {
      const monthDate = subMonths(now, 11 - i)
      const s = startOfMonth(monthDate)
      const e = endOfMonth(monthDate)
      const total = expenses
        .filter((ex) => {
          const d = ex.date.toDate()
          return ex.category === selectedCat && d >= s && d <= e
        })
        .reduce((a, ex) => a + ex.total, 0)
      return {
        month: format(monthDate, "MMM", { locale: es }),
        fullMonth: format(monthDate, "MMMM yyyy", { locale: es }),
        total,
        isCurrent: i === 11,
      }
    })

    const nonZero = chartData.filter((d) => d.total > 0)
    const avg = nonZero.length > 0 ? nonZero.reduce((a, d) => a + d.total, 0) / nonZero.length : 0
    const catTotal = chartData.reduce((a, d) => a + d.total, 0)

    return { chartData, avg, catTotal }
  }, [expenses, selectedCat])

  const cat = allCats.find((c) => c.id === selectedCat)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Tendencia por categoría
          </CardTitle>
          <Select value={selectedCat} onValueChange={setSelectedCat}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allCats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPIs */}
        {!isLoading && (
          <div className="flex gap-4 pt-1">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total 12m</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(catTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Promedio/mes</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(avg)}</p>
            </div>
            {cat && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-sm font-medium">{cat.name}</span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-44 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v > 999 ? `${(v / 1000).toFixed(1)}k` : v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              {avg > 0 && (
                <ReferenceLine
                  y={avg}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{
                    value: "prom.",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  return (
                    <circle
                      key={`dot-${payload.month}`}
                      cx={cx}
                      cy={cy}
                      r={payload.isCurrent ? 5 : payload.total > 0 ? 3 : 0}
                      fill={payload.isCurrent ? "hsl(var(--primary))" : "hsl(var(--background))"}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  )
                }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
