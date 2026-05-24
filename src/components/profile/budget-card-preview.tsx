"use client"

import { useMemo } from "react"
import { useUserSettings } from "@/hooks/use-user-settings"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { formatCurrency, cn } from "@/lib/utils"
import { startOfMonth, endOfMonth, getDaysInMonth, getDate } from "date-fns"
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"

export function BudgetCardPreview() {
  const { data: settings } = useUserSettings()
  const now = useMemo(() => new Date(), [])
  const { data: expenses = [] } = useExpensesPeriod(startOfMonth(now), endOfMonth(now))

  const monthlyBudget = settings?.monthlyBudget ?? null
  const total = useMemo(() => expenses.reduce((s, e) => s + e.total, 0), [expenses])

  const dayOfMonth = getDate(now)
  const daysInMonth = getDaysInMonth(now)
  const dailyAvg = total / Math.max(dayOfMonth, 1)
  const projected = dailyAvg * daysInMonth

  const pct = monthlyBudget ? Math.min((total / monthlyBudget) * 100, 100) : null
  const projectedPct = monthlyBudget ? Math.min((projected / monthlyBudget) * 100, 100) : null

  const isOverBudget = monthlyBudget !== null && total > monthlyBudget
  const isNearBudget = monthlyBudget !== null && pct !== null && pct >= 80 && !isOverBudget
  const isProjectedOver = monthlyBudget !== null && projected > monthlyBudget

  if (!monthlyBudget) {
    return (
      <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Sin presupuesto mensual configurado</p>
        <p className="text-xs mt-1">Define uno en Preferencias → Presupuesto mensual</p>
      </div>
    )
  }

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden",
      isOverBudget && "border-destructive/40",
      isNearBudget && "border-warning/40"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between gap-2",
        isOverBudget ? "bg-destructive/10" : isNearBudget ? "bg-warning/10" : "bg-muted/30"
      )}>
        <div className="flex items-center gap-2">
          <CreditCard className={cn(
            "h-4 w-4",
            isOverBudget ? "text-destructive" : isNearBudget ? "text-warning" : "text-muted-foreground"
          )} />
          <p className="text-sm font-semibold">Presupuesto mensual</p>
        </div>
        {isOverBudget ? (
          <div className="flex items-center gap-1 text-destructive text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Superado
          </div>
        ) : isNearBudget ? (
          <div className="flex items-center gap-1 text-warning text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cerca del límite
          </div>
        ) : (
          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            En control
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Main numbers */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-3xl font-bold tabular-nums">{formatCurrency(total, settings?.defaultCurrency)}</p>
            <p className="text-xs text-muted-foreground">
              de {formatCurrency(monthlyBudget, settings?.defaultCurrency)} · {pct?.toFixed(0)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(Math.max(monthlyBudget - total, 0), settings?.defaultCurrency)}
            </p>
            <p className="text-xs text-muted-foreground">disponible</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-3 rounded-full bg-muted overflow-hidden relative">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isOverBudget ? "bg-destructive" : isNearBudget ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${pct ?? 0}%` }}
            />
            {/* Projected marker */}
            {projectedPct !== null && projectedPct > (pct ?? 0) && projectedPct <= 100 && (
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground/30"
                style={{ left: `${projectedPct}%` }}
                title={`Proyectado: ${formatCurrency(projected)}`}
              />
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>0</span>
            {projectedPct !== null && (
              <span className={cn(
                "flex items-center gap-0.5",
                isProjectedOver ? "text-destructive" : "text-muted-foreground"
              )}>
                <TrendingUp className="h-2.5 w-2.5" />
                Proyectado: {formatCurrency(projected)} ({projectedPct?.toFixed(0)}%)
              </span>
            )}
            <span>{formatCurrency(monthlyBudget, settings?.defaultCurrency)}</span>
          </div>
        </div>

        {/* Daily stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Día</p>
            <p className="text-xs font-bold mt-0.5">{dayOfMonth}/{daysInMonth}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diario</p>
            <p className="text-xs font-bold mt-0.5 tabular-nums">{formatCurrency(dailyAvg)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disp./día</p>
            <p className={cn(
              "text-xs font-bold mt-0.5 tabular-nums",
              isOverBudget ? "text-destructive" : ""
            )}>
              {formatCurrency(Math.max((monthlyBudget - total) / Math.max(daysInMonth - dayOfMonth, 1), 0))}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
