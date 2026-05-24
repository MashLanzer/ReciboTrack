"use client"

import { useMemo } from "react"
import { getMonth, getYear, subMonths, startOfMonth } from "date-fns"
import { Timestamp } from "firebase/firestore"
import { formatCurrency, cn } from "@/lib/utils"
import type { Income } from "@/hooks/use-income"

interface IncomeProjectionProps {
  incomeData: Income[]
  year: number
  month: number
}

export function IncomeProjection({ incomeData, year, month }: IncomeProjectionProps) {
  const { actual, projected, variance } = useMemo(() => {
    // Current month sum
    const actual = incomeData
      .filter((inc) => {
        const d = inc.date.toDate()
        return getYear(d) === year && getMonth(d) + 1 === month
      })
      .reduce((s, inc) => s + inc.amount, 0)

    // Last 3 months (excluding current)
    const currentMonthStart = startOfMonth(new Date(year, month - 1))
    const last3Totals: number[] = []
    for (let i = 1; i <= 3; i++) {
      const d = subMonths(currentMonthStart, i)
      const y = getYear(d)
      const m = getMonth(d) + 1
      const total = incomeData
        .filter((inc) => {
          const id = inc.date.toDate()
          return getYear(id) === y && getMonth(id) + 1 === m
        })
        .reduce((s, inc) => s + inc.amount, 0)
      last3Totals.push(total)
    }

    const projected =
      last3Totals.length > 0
        ? last3Totals.reduce((s, v) => s + v, 0) / last3Totals.length
        : 0

    const variance =
      projected > 0 ? ((actual - projected) / projected) * 100 : 0

    return { actual, projected, variance }
  }, [incomeData, year, month])

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Proyección
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Real</p>
          <p className="text-lg font-black tabular-nums">{formatCurrency(actual)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Proyectado</p>
          <p className="text-lg font-black tabular-nums text-muted-foreground">
            {formatCurrency(projected)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Variación</p>
          <p
            className={cn(
              "text-lg font-black tabular-nums",
              variance >= 0 ? "text-income" : "text-destructive"
            )}
          >
            {variance >= 0 ? "+" : ""}
            {variance.toFixed(0)}%
          </p>
        </div>
      </div>

      {projected > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-income"
            style={{ width: `${Math.min((actual / projected) * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
