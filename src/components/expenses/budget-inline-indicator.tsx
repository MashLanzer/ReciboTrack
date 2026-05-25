"use client"

import { useMemo, useRef } from "react"
import { useBudgets } from "@/hooks/use-budgets"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { formatCurrency, cn } from "@/lib/utils"

interface Props {
  categoryId: string | null | undefined
}

function getBarColor(pct: number): string {
  if (pct > 90) return "bg-red-500"
  if (pct > 70) return "bg-amber-500"
  return "bg-emerald-500"
}

export function BudgetInlineIndicator({ categoryId }: Props) {
  const { data: budgets = [] } = useBudgets()

  // Stable year/month — same for the entire session
  const nowRef = useRef(new Date())
  const year = nowRef.current.getFullYear()
  const month = nowRef.current.getMonth() + 1
  const { data: expenses = [] } = useExpensesForMonth(year, month)

  const result = useMemo(() => {
    if (!categoryId) return null

    const budget = budgets.find((b) => b.categoryId === categoryId)
    if (!budget || budget.monthlyLimit <= 0) return null

    const spent = expenses
      .filter((e) => e.category === categoryId)
      .reduce((sum, e) => sum + e.total, 0)

    const pct = Math.min((spent / budget.monthlyLimit) * 100, 100)
    return { spent, limit: budget.monthlyLimit, currency: budget.currency, pct }
  }, [categoryId, budgets, expenses])

  if (!result) return null

  const { spent, limit, currency, pct } = result

  return (
    <div className="mt-2 mb-1 px-0.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          Presupuesto:{" "}
          <span className="tabular-nums font-medium text-foreground">
            {formatCurrency(spent, currency)}
          </span>
          {" / "}
          <span className="tabular-nums">{formatCurrency(limit, currency)}</span>
        </span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            pct > 90 ? "text-red-500" : pct > 70 ? "text-amber-500" : "text-emerald-600"
          )}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", getBarColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
