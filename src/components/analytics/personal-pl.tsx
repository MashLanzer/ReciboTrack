"use client"

import { useMemo, useState } from "react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useIncomePeriod } from "@/hooks/use-income"
import { useUIStore } from "@/stores/ui-store"
import { useCategories } from "@/hooks/use-categories"
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, BarChart3 } from "lucide-react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts"
import { TOOLTIP_STYLE_SM } from "@/lib/chart-theme"

export function PersonalPL() {
  const [monthOffset, setMonthOffset] = useState(0)
  const { activeAccount } = useUIStore()
  const { data: categories = [] } = useCategories()

  const selectedMonth = useMemo(() => subMonths(new Date(), monthOffset), [monthOffset])
  const start = useMemo(() => startOfMonth(selectedMonth), [selectedMonth])
  const end = useMemo(() => endOfMonth(selectedMonth), [selectedMonth])

  const { data: rawExpenses = [], isLoading: expLoading } = useExpensesPeriod(start, end)
  const { data: rawIncome = [], isLoading: incLoading } = useIncomePeriod(start, end)

  const isLoading = expLoading || incLoading

  const { income, expenses } = useMemo(() => {
    const inc = activeAccount === "business"
      ? rawIncome.filter((i) => i.account === "business")
      : rawIncome.filter((i) => !i.account || i.account === "personal")

    const exp = activeAccount === "business"
      ? rawExpenses.filter((e) => e.account === "business")
      : rawExpenses.filter((e) => !e.account || e.account === "personal")

    return { income: inc, expenses: exp }
  }, [rawIncome, rawExpenses, activeAccount])

  // Income by source
  const incomeBySource = useMemo(() => {
    const map: Record<string, number> = {}
    income.forEach((i) => {
      map[i.source] = (map[i.source] ?? 0) + i.amount
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [income])

  // Expenses by category
  const expByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + e.total
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([id, total]) => {
        const cat = categories.find((c) => c.id === id)
        return { id, name: cat?.name ?? id, icon: cat?.icon ?? "📦", color: cat?.color ?? "#6b7280", total }
      })
  }, [expenses, categories])

  const totalIncome = income.reduce((a, i) => a + i.amount, 0)
  const totalExpenses = expenses.reduce((a, e) => a + e.total, 0)
  const netResult = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (netResult / totalIncome) * 100 : 0

  const [incomeOpen, setIncomeOpen] = useState(true)
  const [expOpen, setExpOpen] = useState(true)

  const donutData = [
    { name: "Ingresos", value: totalIncome, color: "#22c55e" },
    { name: "Gastos", value: totalExpenses, color: "#ef4444" },
    ...(netResult > 0 ? [{ name: "Ahorro", value: netResult, color: "#3b82f6" }] : []),
  ].filter((d) => d.value > 0)

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-primary" />
            Estado de resultados
          </CardTitle>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonthOffset((o) => o + 1)}
              className="h-7 w-7 flex items-center justify-center rounded-lg border hover:bg-accent transition-colors"
              disabled={monthOffset >= 11}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-medium w-24 text-center capitalize">
              {format(selectedMonth, "MMMM yyyy", { locale: es })}
            </span>
            <button
              onClick={() => setMonthOffset((o) => Math.max(o - 1, 0))}
              className="h-7 w-7 flex items-center justify-center rounded-lg border hover:bg-accent transition-colors"
              disabled={monthOffset === 0}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 divide-y">

        {/* Income section */}
        <div>
          <button
            onClick={() => setIncomeOpen((o) => !o)}
            className="w-full flex items-center justify-between py-2.5 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingresos totales</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-sm font-bold text-green-600">{formatCurrency(totalIncome)}</span>
              {incomeOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
            </div>
          </button>
          {incomeOpen && incomeBySource.length > 0 && (
            <div className="pb-2 space-y-1">
              {incomeBySource.map(([source, amount]) => (
                <div key={source} className="flex items-center justify-between pl-3 py-0.5">
                  <span className="text-xs text-muted-foreground">· {source}</span>
                  <span className="tabular-nums text-xs">{formatCurrency(amount)}</span>
                </div>
              ))}
              {incomeBySource.length === 0 && (
                <p className="text-xs text-muted-foreground pl-3 py-1">Sin ingresos registrados</p>
              )}
            </div>
          )}
        </div>

        {/* Expenses section */}
        <div>
          <button
            onClick={() => setExpOpen((o) => !o)}
            className="w-full flex items-center justify-between py-2.5 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gastos por categoría</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-sm font-bold text-destructive">{formatCurrency(totalExpenses)}</span>
              {expOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
            </div>
          </button>
          {expOpen && (
            <div className="pb-2 space-y-1">
              {expByCategory.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between pl-3 py-0.5">
                  <span className="text-xs text-muted-foreground">· {cat.icon} {cat.name}</span>
                  <span className="tabular-nums text-xs">{formatCurrency(cat.total)}</span>
                </div>
              ))}
              {expByCategory.length === 0 && (
                <p className="text-xs text-muted-foreground pl-3 py-1">Sin gastos registrados</p>
              )}
            </div>
          )}
        </div>

        {/* Net result */}
        <div className="py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">Resultado neto</span>
            <span className={cn("tabular-nums text-base font-bold", netResult >= 0 ? "text-green-600" : "text-destructive")}>
              {formatCurrency(netResult)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">Tasa de ahorro</span>
            <span className={cn("tabular-nums text-xs font-semibold", savingsRate >= 0 ? "text-green-600" : "text-destructive")}>
              {savingsRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Donut chart */}
        {donutData.length > 0 && (
          <div className="pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Distribución</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE_SM}
                  formatter={(v) => formatCurrency(Number(v ?? 0))}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
