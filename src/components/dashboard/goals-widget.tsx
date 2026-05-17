"use client"

import { useGoals } from "@/hooks/use-goals"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Target } from "lucide-react"

export function GoalsWidget() {
  const { data: goals = [], isLoading } = useGoals()

  const active = goals.filter(g => g.isActive).slice(0, 3)

  if (isLoading || active.length === 0) return null

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Metas de ahorro</h2>
        </div>
        <Link
          href="/goals"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      <div className="space-y-3">
        {active.map(goal => {
          const pct = goal.targetAmount > 0
            ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
            : 0
          const isComplete = goal.currentAmount >= goal.targetAmount

          return (
            <div key={goal.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium truncate">{goal.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {pct.toFixed(0)}%
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isComplete ? "bg-green-500" : "bg-primary"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{formatCurrency(goal.currentAmount, goal.currency)}</span>
                <span>{formatCurrency(goal.targetAmount, goal.currency)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
