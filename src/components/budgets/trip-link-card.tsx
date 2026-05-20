"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useTravelBudgets } from "@/hooks/use-travel-budgets"
import { useExpenses } from "@/hooks/use-expenses"
import { formatCurrency, cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"
import { differenceInDays, isWithinInterval } from "date-fns"
import { toDate } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctColor(pct: number) {
  if (pct >= 90) return "bg-rose-500"
  if (pct >= 70) return "bg-amber-500"
  return "bg-emerald-500"
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TripLinkCard() {
  const { data: budgets = [], isLoading } = useTravelBudgets()
  const { data: expensesData } = useExpenses()
  const allExpenses = expensesData?.expenses ?? []

  const now = new Date()

  // Find the currently active trip (start ≤ now ≤ end)
  const activeTrip = useMemo(
    () =>
      budgets.find((b) => {
        const start = b.startDate.toDate()
        const end   = b.endDate.toDate()
        return now >= start && now <= end
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budgets],
  )

  // Calculate spent for the active trip (expenses with matching tag, within date range)
  const spent = useMemo(() => {
    if (!activeTrip) return 0
    const start = activeTrip.startDate.toDate()
    const end   = activeTrip.endDate.toDate()
    return allExpenses
      .filter((e) => {
        const d = toDate(e.date)
        const inRange = isWithinInterval(d, { start, end })
        const hasTag  = activeTrip.tags.length === 0 || e.tags?.some((t) => activeTrip.tags.includes(t))
        return inRange && hasTag
      })
      .reduce((s, e) => s + e.total, 0)
  }, [activeTrip, allExpenses])

  const pct = activeTrip && activeTrip.totalLimit > 0
    ? Math.min((spent / activeTrip.totalLimit) * 100, 100)
    : 0

  const daysLeft = activeTrip
    ? differenceInDays(activeTrip.endDate.toDate(), now) + 1
    : null

  // ── Fallback (static) ─────────────────────────────────────────────────────
  if (isLoading || !activeTrip) {
    return (
      <Link href="/trips">
        <div className="flex items-center justify-between rounded-2xl border p-4
          hover:bg-accent/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✈️</span>
            <div>
              <p className="font-semibold">Viajes y eventos</p>
              <p className="text-sm text-muted-foreground">Presupuestos por viaje</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </Link>
    )
  }

  // ── Active trip card ──────────────────────────────────────────────────────
  return (
    <Link href="/trips">
      <div className="rounded-2xl border bg-card p-4 hover:bg-accent/40 transition-colors
        cursor-pointer space-y-3 animate-[fadeSlideUp_0.25s_ease-out_both]">

        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0 leading-none">{activeTrip.emoji}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold truncate">{activeTrip.name}</p>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-500/15
                  text-green-600 dark:text-green-400 font-medium shrink-0">
                  En curso
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {daysLeft != null && daysLeft > 0
                  ? `${daysLeft} día${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`
                  : "Termina hoy"}
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>

        {/* Budget bar */}
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", pctColor(pct))}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatCurrency(spent, activeTrip.currency)} gastado
            </span>
            <span className={cn(
              "text-[11px] font-medium tabular-nums",
              pct >= 90 ? "text-rose-600" : pct >= 70 ? "text-amber-600" : "text-emerald-600",
            )}>
              {pct >= 100
                ? `Excedido por ${formatCurrency(spent - activeTrip.totalLimit, activeTrip.currency)}`
                : `${formatCurrency(activeTrip.totalLimit - spent, activeTrip.currency)} disponible`}
            </span>
          </div>
        </div>

      </div>
    </Link>
  )
}
