"use client"

import { useState } from "react"
import { format, subMonths, startOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import { TrendingUp } from "lucide-react"
import { IncomeBalance } from "@/components/dashboard/income-balance"
import { useIncome } from "@/hooks/use-income"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { formatCurrency, cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

// ─── Month selector ────────────────────────────────────────────────────────────

function buildMonthOptions() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(startOfMonth(now), i)
    return {
      label: format(d, "MMMM yyyy", { locale: es }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    }
  })
}

// ─── History row for one month ─────────────────────────────────────────────────

function MonthHistoryRow({ year, month }: { year: number; month: number }) {
  const { data: incomeList = [] } = useIncome(year, month)
  const { data: expenses = [] } = useExpensesForMonth(year, month)

  const totalIncome = incomeList.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.total || 0), 0)
  const balance = totalIncome - totalExpenses
  const isPositive = balance >= 0

  const label = format(new Date(year, month - 1), "MMM yyyy", { locale: es })
  const labelLong = format(new Date(year, month - 1), "MMMM yyyy", { locale: es })

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 text-xs font-medium capitalize">{labelLong}</td>
      <td className="text-right px-3 py-3 tabular-nums text-xs font-semibold text-green-600">
        {totalIncome > 0 ? formatCurrency(totalIncome) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="text-right px-3 py-3 tabular-nums text-xs font-semibold text-destructive">
        {totalExpenses > 0 ? formatCurrency(totalExpenses) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className={cn("text-right px-4 py-3 tabular-nums text-xs font-bold", isPositive ? "text-green-600" : "text-destructive")}>
        {totalIncome === 0 && totalExpenses === 0 ? (
          <span className="text-muted-foreground font-normal">Sin datos</span>
        ) : (
          <>{isPositive ? "+" : "-"}{formatCurrency(Math.abs(balance))}</>
        )}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const options = buildMonthOptions()
  const [selected, setSelected] = useState(0)
  const { year, month } = options[selected]

  // All months except the currently selected one for the history table
  const historyMonths = options.filter((_, i) => i !== 0)

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-green-500/15 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Ingresos y Balance</h1>
          <p className="text-xs text-muted-foreground">Cuánto ganas vs cuánto gastas</p>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
              selected === i
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Income + Balance for selected month */}
      <IncomeBalance year={year} month={month} />

      {/* 6-month history table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Historial 6 meses</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Mes</th>
                <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-2">Ingresos</th>
                <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-2">Gastos</th>
                <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {options.map((opt) => (
                <MonthHistoryRow key={`${opt.year}-${opt.month}`} year={opt.year} month={opt.month} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
