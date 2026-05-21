"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Timestamp } from "firebase/firestore"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/hooks/use-auth"
import { useUIStore } from "@/stores/ui-store"
import { useIncomePeriod } from "@/hooks/use-income"
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE_SM } from "@/lib/chart-theme"
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ComposedChart,
} from "recharts"
import { Activity } from "lucide-react"

function use6MonthExpensesForCF() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-6m-cf", user?.uid],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return [] as Expense[]
      const start = startOfMonth(subMonths(new Date(), 5))
      const res = await apiFetch(`/api/expenses?startDate=${start.toISOString()}&all=true`)
      if (!res.ok) return [] as Expense[]
      const { expenses } = await res.json() as { expenses: Record<string, unknown>[] }
      return expenses.map(e => ({
        ...e,
        date: Timestamp.fromDate(new Date(e.date as string)),
      })) as unknown as Expense[]
    },
  })
}

export function CashFlowChart() {
  const { data: rawExpenses = [], isLoading: expLoading } = use6MonthExpensesForCF()
  const { activeAccount } = useUIStore()

  const start6m = useMemo(() => startOfMonth(subMonths(new Date(), 5)), [])
  const end6m = useMemo(() => endOfMonth(new Date()), [])
  const { data: incomeData = [], isLoading: incLoading } = useIncomePeriod(start6m, end6m)

  const isLoading = expLoading || incLoading

  const chartData = useMemo(() => {
    const expenses = rawExpenses.filter((e) => {
      if (activeAccount === "business") return e.account === "business"
      return !e.account || e.account === "personal"
    })

    const income = activeAccount === "business"
      ? incomeData.filter((i) => i.account === "business")
      : incomeData.filter((i) => !i.account || i.account === "personal")

    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i
      const monthDate = subMonths(now, offset)
      const start = startOfMonth(monthDate)
      const end = endOfMonth(monthDate)

      const totalExpenses = expenses
        .filter((e) => { const d = e.date.toDate(); return d >= start && d <= end })
        .reduce((a, e) => a + e.total, 0)

      const totalIncome = income
        .filter((inc) => { const d = inc.date.toDate(); return d >= start && d <= end })
        .reduce((a, inc) => a + inc.amount, 0)

      const net = totalIncome - totalExpenses

      return {
        month: format(monthDate, "MMM yy", { locale: es }),
        income: parseFloat(totalIncome.toFixed(2)),
        expenses: parseFloat(totalExpenses.toFixed(2)),
        net: parseFloat(net.toFixed(2)),
      }
    })
  }, [rawExpenses, incomeData, activeAccount])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" />
          Flujo de caja — 6 meses
        </CardTitle>
        <p className="text-xs text-muted-foreground">Ingresos, gastos y resultado neto por mes</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={32}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE_SM}
                formatter={(v, name) => {
                  const labels: Record<string, string> = {
                    income: "Ingresos",
                    expenses: "Gastos",
                    net: "Neto",
                  }
                  return [formatCurrency(Number(v ?? 0)), labels[String(name)] ?? String(name)]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="income"
                fill="url(#incomeGrad)"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name="income"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                fill="url(#expensesGrad)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="expenses"
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                name="net"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
