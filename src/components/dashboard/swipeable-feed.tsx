"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  subDays, startOfDay, endOfDay,
  startOfWeek, endOfWeek, format,
  differenceInDays, isSameDay,
  getDaysInMonth,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  Flame, Lightbulb, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus,
  Bookmark, Calendar, Trophy, ArrowRight,
} from "lucide-react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useFlaggedExpenses } from "@/hooks/use-expenses"
import { useCategoryBudgets } from "@/hooks/use-category-budgets"
import { useGoals } from "@/hooks/use-goals"
import { useRecurring } from "@/hooks/use-recurring"
import { useHighlights } from "@/hooks/use-highlights"
import { useCategories } from "@/hooks/use-categories"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"

// ─── Tips pool ────────────────────────────────────────────────────────────────

const TIPS = [
  "Registra tus gastos justo después de pagar — la memoria falla.",
  "Revisar tu presupuesto 5 min al día evita sorpresas a fin de mes.",
  "El café diario puede costar más de 1.000€ al año.",
  "Separa el 20% de cada ingreso antes de gastar.",
  "Los gastos pequeños y frecuentes son los más difíciles de controlar.",
  "Un presupuesto no te limita, te libera para gastar sin culpa.",
  "Tres meses de gastos guardados son una red de seguridad real.",
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expDate(e: { date: unknown }): Date {
  return (e.date as { toDate(): Date }).toDate()
}

function freqLabel(f: string) {
  return (
    { weekly: "semanal", biweekly: "quincenal", monthly: "mensual", yearly: "anual" }[f] ?? f
  )
}

// ─── Mini bar chart (7 days) ─────────────────────────────────────────────────

function MiniBar({ value, max, today }: { value: number; max: number; today: boolean }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 6 : 2) : 2
  return (
    <div
      className={cn(
        "flex-1 rounded-t-md transition-all duration-500",
        today ? "bg-primary" : value === 0 ? "bg-border/40" : "bg-primary/40"
      )}
      style={{ height: `${pct}%` }}
    />
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SwipeableFeed() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const now = useMemo(() => new Date(), [])
  const { activeAccount } = useUIStore()

  // ── Data ──────────────────────────────────────────────────────────────────
  const start30 = useMemo(() => subDays(startOfDay(now), 29), [now])
  const { data: expenses30 = [] } = useExpensesPeriod(start30, endOfDay(now))
  const { data: goals = [] } = useGoals()
  const { data: flagged = [] } = useFlaggedExpenses()
  const { data: recurring = [] } = useRecurring()
  const { data: highlights = [] } = useHighlights()
  const { data: categories = [] } = useCategories()
  const month = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    [now]
  )
  const { data: budgets = [] } = useCategoryBudgets(month)

  // ── Filtered expenses ─────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      expenses30.filter((e) =>
        activeAccount === "business"
          ? e.account === "business"
          : !e.account || e.account === "personal"
      ),
    [expenses30, activeAccount]
  )

  // ── Core numbers ─────────────────────────────────────────────────────────
  const todayExpenses = useMemo(
    () => filtered.filter((e) => isSameDay(expDate(e), now)),
    [filtered, now]
  )
  const todayTotal = useMemo(() => todayExpenses.reduce((s, e) => s + e.total, 0), [todayExpenses])

  const monthTotal = useMemo(() => filtered.reduce((s, e) => s + e.total, 0), [filtered])
  const dailyAvg = monthTotal / 30

  // Days remaining in month
  const daysInMonth = getDaysInMonth(now)
  const daysLeft = daysInMonth - now.getDate()
  const budgetLeft = useMemo(() => {
    const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
    return Math.max(totalBudget - monthTotal, 0)
  }, [budgets, monthTotal])
  const canSpendPerDay = daysLeft > 0 && budgetLeft > 0 ? budgetLeft / daysLeft : null

  // ── Weekly comparison ─────────────────────────────────────────────────────
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisWeekEnd   = endOfWeek(now, { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 })
  const lastWeekEnd   = endOfWeek(subDays(now, 7), { weekStartsOn: 1 })

  const { weekDays, thisWeekTotal, lastWeekTotal, weekDelta } = useMemo(() => {
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(thisWeekStart)
      day.setDate(day.getDate() + i)
      const total = filtered
        .filter((e) => isSameDay(expDate(e), day))
        .reduce((s, e) => s + e.total, 0)
      return { day, total, isToday: isSameDay(day, now) }
    })
    const thisWeekTotal = weekDays.reduce((s, d) => s + d.total, 0)
    const lastWeekTotal = filtered
      .filter((e) => {
        const d = expDate(e)
        return d >= lastWeekStart && d <= lastWeekEnd
      })
      .reduce((s, e) => s + e.total, 0)
    const weekDelta = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0
    return { weekDays, thisWeekTotal, lastWeekTotal, weekDelta }
  }, [filtered, thisWeekStart, lastWeekStart, lastWeekEnd, now])

  // ── Top category ─────────────────────────────────────────────────────────
  const topCategory = useMemo(() => {
    const bycat: Record<string, number> = {}
    filtered.forEach((e) => {
      const k = e.category ?? "otros"
      bycat[k] = (bycat[k] ?? 0) + e.total
    })
    const sorted = Object.entries(bycat).sort((a, b) => b[1] - a[1])
    if (sorted.length === 0) return null
    const [id, amount] = sorted[0]
    const meta = categories.find((c) => c.id === id)
    return { id, amount, name: meta?.name ?? id, icon: meta?.icon ?? "📦", pct: (amount / monthTotal) * 100 }
  }, [filtered, categories, monthTotal])

  // ── Streak ────────────────────────────────────────────────────────────────
  const streak = useMemo(() => {
    let count = 0
    for (let i = 1; i <= 30; i++) {
      const dayTotal = filtered
        .filter((e) => isSameDay(expDate(e), subDays(now, i)))
        .reduce((s, e) => s + e.total, 0)
      if (dailyAvg > 0 && dayTotal <= dailyAvg) count++
      else break
    }
    return count
  }, [filtered, dailyAvg, now])

  // ── Biggest expense ───────────────────────────────────────────────────────
  const topExpense = useMemo(
    () => (filtered.length > 0 ? [...filtered].sort((a, b) => b.total - a.total)[0] : null),
    [filtered]
  )

  // ── Over budget ───────────────────────────────────────────────────────────
  const overBudget = useMemo(
    () =>
      budgets.filter((b) => {
        const spent = filtered
          .filter((e) => e.category === b.categoryId)
          .reduce((s, e) => s + e.total, 0)
        return spent > b.amount * 0.8
      }),
    [budgets, filtered]
  )

  // ── Active goal ───────────────────────────────────────────────────────────
  const activeGoal = useMemo(
    () =>
      goals
        .filter((g) => g.isActive)
        .sort((a, b) => b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount)[0] ??
      null,
    [goals]
  )

  // ── Next recurring ────────────────────────────────────────────────────────
  const nextRecurring = useMemo(() => {
    const active = recurring.filter((r) => r.isActive && r.nextDueDate)
    if (active.length === 0) return null
    return active.sort(
      (a, b) => a.nextDueDate.toMillis() - b.nextDueDate.toMillis()
    )[0]
  }, [recurring])

  // ── Recent highlight ──────────────────────────────────────────────────────
  const recentHighlight = useMemo(() => {
    const cutoff = subDays(now, 7)
    return (
      highlights
        .filter((h) => h.date && h.date.toDate() >= cutoff)
        .sort((a, b) => b.date.toMillis() - a.date.toMillis())[0] ?? null
    )
  }, [highlights, now])

  // ── Weekly summary ────────────────────────────────────────────────────────
  const weeklySummary = useMemo(() => {
    const weekExpenses = filtered.filter(
      (e) => expDate(e) >= thisWeekStart && expDate(e) <= thisWeekEnd
    )
    const total = weekExpenses.reduce((s, e) => s + e.total, 0)
    const txCount = weekExpenses.length
    const byDay: Record<string, number> = {}
    weekExpenses.forEach((e) => {
      const k = format(expDate(e), "yyyy-MM-dd")
      byDay[k] = (byDay[k] ?? 0) + e.total
    })
    const busiest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]
    return {
      total,
      txCount,
      busiestDay: busiest
        ? format(new Date(busiest[0] + "T12:00:00"), "EEEE", { locale: es })
        : null,
    }
  }, [filtered, thisWeekStart, thisWeekEnd])

  // ── Tip ───────────────────────────────────────────────────────────────────
  const tip = TIPS[now.getDate() % TIPS.length]

  // ── Build cards ───────────────────────────────────────────────────────────
  const cards = useMemo(() => {
    const list: Array<{ id: string; render: () => React.ReactNode }> = []

    // 1 ── Balance del mes ─────────────────────────────────────────────────
    list.push({
      id: "balance",
      render: () => (
        <div className="h-full flex flex-col justify-between p-5">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Gastado este mes
            </p>
            <p className="text-4xl font-black tabular-nums mt-1 leading-none">
              {formatCurrency(monthTotal)}
            </p>
          </div>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted/60 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Hoy</p>
                <p className={cn(
                  "text-base font-bold tabular-nums",
                  todayTotal > dailyAvg ? "text-destructive" : "text-emerald-500"
                )}>
                  {formatCurrency(todayTotal)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/60 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Media/día</p>
                <p className="text-base font-bold tabular-nums">{formatCurrency(dailyAvg)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Hoy vs. media</span>
                <span>{Math.round((todayTotal / Math.max(dailyAvg, 1)) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    todayTotal > dailyAvg ? "bg-destructive" : "bg-primary"
                  )}
                  style={{ width: `${Math.min((todayTotal / Math.max(dailyAvg, 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ),
    })

    // 2 ── Gastos de hoy ───────────────────────────────────────────────────
    list.push({
      id: "today",
      render: () => (
        <div className="h-full flex flex-col p-5 gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Hoy · {todayExpenses.length} movimientos
            </p>
            <p className="text-sm font-bold tabular-nums">{formatCurrency(todayTotal)}</p>
          </div>
          {todayExpenses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-3xl">✅</p>
              <p className="text-sm font-semibold">Sin gastos hoy</p>
              <p className="text-xs text-muted-foreground">¡Buen comienzo de día!</p>
            </div>
          ) : (
            <div className="flex-1 space-y-1 overflow-hidden">
              {[...todayExpenses]
                .sort((a, b) => expDate(b).getTime() - expDate(a).getTime())
                .slice(0, 4)
                .map((e) => {
                  const cat = categories.find((c) => c.id === e.category)
                  return (
                    <div key={e.id} className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
                      <span className="text-base shrink-0">{cat?.icon ?? "📦"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{e.merchant}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(expDate(e), "HH:mm")}
                        </p>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-destructive shrink-0">
                        -{formatCurrency(e.total, e.currency)}
                      </p>
                    </div>
                  )
                })}
              {todayExpenses.length > 4 && (
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  +{todayExpenses.length - 4} más
                </p>
              )}
            </div>
          )}
        </div>
      ),
    })

    // 3 ── Días restantes + proyección ─────────────────────────────────────
    list.push({
      id: "days-left",
      render: () => (
        <div className="h-full flex flex-col justify-between p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Queda de mes
          </p>
          <div className="text-center space-y-1">
            <p className="text-6xl font-black tabular-nums leading-none">{daysLeft}</p>
            <p className="text-sm text-muted-foreground font-medium">
              {daysLeft === 1 ? "día restante" : "días restantes"}
            </p>
          </div>
          <div className="space-y-3">
            {canSpendPerDay !== null ? (
              <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-center">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono uppercase tracking-widest">
                  Puedes gastar/día
                </p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(canSpendPerDay)}
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-muted/60 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Configura presupuestos para ver tu margen diario
                </p>
              </div>
            )}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${Math.round(((daysInMonth - daysLeft) / daysInMonth) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Día {now.getDate()} de {daysInMonth}
            </p>
          </div>
        </div>
      ),
    })

    // 4 ── Comparativa semanal ─────────────────────────────────────────────
    const maxDay = Math.max(...weekDays.map((d) => d.total), 1)
    const weekIsUp   = weekDelta > 2
    const weekIsDown = weekDelta < -2
    list.push({
      id: "week-compare",
      render: () => (
        <div className="h-full flex flex-col p-5 gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Esta semana
            </p>
            {lastWeekTotal > 0 && (
              <div className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold",
                weekIsUp   ? "bg-destructive/10 text-destructive" :
                weekIsDown ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                             "bg-muted text-muted-foreground"
              )}>
                {weekIsUp ? <TrendingUp className="h-3 w-3" /> :
                 weekIsDown ? <TrendingDown className="h-3 w-3" /> :
                 <Minus className="h-3 w-3" />}
                {Math.abs(weekDelta) < 1
                  ? "Igual"
                  : `${weekIsUp ? "+" : "-"}${Math.abs(weekDelta).toFixed(0)}%`}
                <span className="font-normal opacity-70">vs. anterior</span>
              </div>
            )}
          </div>
          <p className="text-3xl font-black tabular-nums">{formatCurrency(thisWeekTotal)}</p>
          {/* Mini bar chart */}
          <div className="flex-1 flex flex-col justify-end gap-2">
            <div className="flex items-end gap-1.5 h-16">
              {weekDays.map((d, i) => (
                <MiniBar key={i} value={d.total} max={maxDay} today={d.isToday} />
              ))}
            </div>
            <div className="flex gap-1.5">
              {weekDays.map((d, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className={cn(
                    "text-[9px] font-mono font-bold",
                    d.isToday ? "text-primary" : "text-muted-foreground/50"
                  )}>
                    {format(d.day, "EEEEE", { locale: es }).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    })

    // 5 ── Mayor gasto ─────────────────────────────────────────────────────
    if (topExpense) {
      list.push({
        id: "top-expense",
        render: () => (
          <div className="h-full flex flex-col justify-between p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Mayor gasto · 30 días
            </p>
            <div className="text-center space-y-1.5">
              <p className="text-5xl font-black tabular-nums text-destructive leading-none">
                {formatCurrency(topExpense.total)}
              </p>
              <p className="text-xl font-bold leading-tight">{topExpense.merchant}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {format(expDate(topExpense), "d 'de' MMMM, HH:mm", { locale: es })}
              </p>
            </div>
            <div className="rounded-xl bg-destructive/8 px-4 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">
                Equivale a{" "}
                <span className="font-bold text-foreground">
                  {(topExpense.total / Math.max(dailyAvg, 1)).toFixed(1)} días
                </span>{" "}
                de gasto medio
              </p>
            </div>
          </div>
        ),
      })
    }

    // 6 ── Top categoría ───────────────────────────────────────────────────
    if (topCategory) {
      list.push({
        id: "top-cat",
        render: () => (
          <div className="h-full flex flex-col justify-between p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Categoría líder · este mes
            </p>
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <p className="text-5xl">{topCategory.icon}</p>
              <p className="text-xl font-bold">{topCategory.name}</p>
              <p className="text-3xl font-black tabular-nums">{formatCurrency(topCategory.amount)}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Del total mensual</span>
                <span className="font-bold text-foreground">{topCategory.pct.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${topCategory.pct}%` }}
                />
              </div>
            </div>
          </div>
        ),
      })
    }

    // 7 ── Alerta presupuesto ──────────────────────────────────────────────
    if (overBudget.length > 0) {
      list.push({
        id: "budget-alert",
        render: () => (
          <div className="h-full flex flex-col p-5 gap-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex-1">
                Presupuesto en riesgo
              </p>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                "bg-destructive/10 text-destructive"
              )}>
                {overBudget.length} {overBudget.length === 1 ? "categoría" : "categorías"}
              </span>
            </div>
            <div className="flex-1 space-y-2.5 overflow-hidden">
              {overBudget.slice(0, 3).map((b) => {
                const spent = filtered
                  .filter((e) => e.category === b.categoryId)
                  .reduce((s, e) => s + e.total, 0)
                const pct = Math.round((spent / b.amount) * 100)
                const cat = categories.find((c) => c.id === b.categoryId)
                return (
                  <div key={b.categoryId} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{cat?.icon ?? "📦"}</span>
                      <span className="text-xs font-semibold flex-1 truncate">
                        {cat?.name ?? b.categoryId}
                      </span>
                      <span className={cn(
                        "text-xs font-bold tabular-nums",
                        pct >= 100 ? "text-destructive" : "text-warning"
                      )}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct >= 100 ? "bg-destructive" : "bg-warning"
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatCurrency(spent)} gastado</span>
                      <span>de {formatCurrency(b.amount)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <Link
              href="/budgets"
              className="flex items-center justify-center gap-1 text-xs font-semibold text-primary"
            >
              Ver presupuestos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ),
      })
    }

    // 8 ── Meta de ahorro ──────────────────────────────────────────────────
    if (activeGoal) {
      const pct = Math.round((activeGoal.currentAmount / activeGoal.targetAmount) * 100)
      const remaining = activeGoal.targetAmount - activeGoal.currentAmount
      list.push({
        id: "goal",
        render: () => (
          <div className="h-full flex flex-col justify-between p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Meta de ahorro
            </p>
            <div className="space-y-1.5">
              <p className="text-lg font-bold leading-tight">{activeGoal.name}</p>
              <p className="text-4xl font-black tabular-nums">{formatCurrency(activeGoal.currentAmount)}</p>
              <p className="text-sm text-muted-foreground">
                de {formatCurrency(activeGoal.targetAmount)}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progreso</span>
                <span className="font-bold">{pct}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Te faltan{" "}
                <span className="font-bold text-foreground">{formatCurrency(remaining)}</span>
              </p>
            </div>
          </div>
        ),
      })
    }

    // 9 ── Próximo recurrente ──────────────────────────────────────────────
    if (nextRecurring) {
      const dueDate = nextRecurring.nextDueDate.toDate()
      const daysUntil = differenceInDays(startOfDay(dueDate), startOfDay(now))
      const isOverdue = daysUntil < 0
      const isDueToday = daysUntil === 0
      list.push({
        id: "next-recurring",
        render: () => (
          <div className="h-full flex flex-col justify-between p-5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex-1">
                Próximo pago recurrente
              </p>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                isOverdue   ? "bg-destructive/10 text-destructive" :
                isDueToday  ? "bg-warning/10 text-warning" :
                              "bg-muted text-muted-foreground"
              )}>
                {isOverdue ? "Vencido" : isDueToday ? "Hoy" : `en ${daysUntil}d`}
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-black tabular-nums">{formatCurrency(nextRecurring.total, nextRecurring.currency)}</p>
              <p className="text-lg font-bold">{nextRecurring.merchant}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {freqLabel(nextRecurring.frequency)} ·{" "}
                {format(dueDate, "d 'de' MMMM", { locale: es })}
              </p>
            </div>
            {recurring.length > 1 && (
              <div className="rounded-xl bg-muted/50 px-3 py-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {recurring.length - 1} pagos más activos
                </p>
                <Link href="/recurring" className="text-xs font-semibold text-primary flex items-center gap-0.5">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        ),
      })
    }

    // 10 ── Pendientes sin resolver ────────────────────────────────────────
    if (flagged.length > 0) {
      const oldest = [...flagged].sort(
        (a, b) => (a.flaggedAt?.toMillis() ?? 0) - (b.flaggedAt?.toMillis() ?? 0)
      )[0]
      list.push({
        id: "flagged",
        render: () => (
          <div className="h-full flex flex-col p-5 gap-3">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-warning" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Pendientes
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-6xl font-black tabular-nums text-warning">{flagged.length}</p>
              <div>
                <p className="text-sm font-semibold">
                  {flagged.length === 1 ? "gasto marcado" : "gastos marcados"}
                </p>
                <p className="text-xs text-muted-foreground">sin resolver</p>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 overflow-hidden">
              {flagged.slice(0, 2).map((e) => (
                <div key={e.id} className="flex items-center gap-2.5 rounded-xl bg-warning/8 px-3 py-2">
                  <Bookmark className="h-3.5 w-3.5 text-warning shrink-0" />
                  <p className="text-xs font-semibold flex-1 truncate">{e.merchant}</p>
                  <p className="text-xs font-bold tabular-nums text-destructive">
                    -{formatCurrency(e.total, e.currency)}
                  </p>
                </div>
              ))}
            </div>
            <Link
              href="/expenses?flagged=true"
              className="flex items-center justify-center gap-1 text-xs font-semibold text-warning"
            >
              Resolver pendientes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ),
      })
    }

    // 11 ── Resumen semanal express ─────────────────────────────────────────
    list.push({
      id: "weekly-summary",
      render: () => (
        <div className="h-full flex flex-col justify-between p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Esta semana · resumen
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Total</p>
              <p className="text-sm font-black tabular-nums">{formatCurrency(weeklySummary.total)}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Gastos</p>
              <p className="text-2xl font-black">{weeklySummary.txCount}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Día activo</p>
              <p className="text-xs font-bold capitalize leading-tight">
                {weeklySummary.busiestDay ?? "—"}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Semana anterior</span>
              <span className="font-semibold text-foreground">{formatCurrency(lastWeekTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Diferencia</span>
              <span className={cn(
                "font-bold",
                thisWeekTotal > lastWeekTotal ? "text-destructive" : "text-emerald-500"
              )}>
                {thisWeekTotal > lastWeekTotal ? "+" : "-"}
                {formatCurrency(Math.abs(thisWeekTotal - lastWeekTotal))}
              </span>
            </div>
          </div>
        </div>
      ),
    })

    // 12 ── Racha ──────────────────────────────────────────────────────────
    list.push({
      id: "streak",
      render: () => (
        <div className="h-full flex flex-col justify-between p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Racha de ahorro
          </p>
          <div className="flex flex-col items-center justify-center gap-2 flex-1">
            <Flame
              className={cn(
                "h-14 w-14",
                streak >= 7  ? "text-warning" :
                streak >= 3  ? "text-primary" :
                               "text-muted-foreground/30"
              )}
            />
            <p className="text-6xl font-black tabular-nums">{streak}</p>
            <p className="text-sm text-muted-foreground font-medium">
              {streak === 1 ? "día bajo tu media" : "días bajo tu media"}
            </p>
          </div>
          <div className={cn(
            "rounded-xl px-4 py-2.5 text-center",
            streak >= 7 ? "bg-warning/10" : "bg-muted/50"
          )}>
            <p className="text-xs text-muted-foreground">
              {streak === 0
                ? `Mantente bajo ${formatCurrency(dailyAvg)}/día para empezar`
                : streak >= 7
                ? "🔥 ¡Racha increíble! Sigue así"
                : `Objetivo: llega a 7 días (te faltan ${7 - streak})`}
            </p>
          </div>
        </div>
      ),
    })

    // 13 ── Logro reciente ─────────────────────────────────────────────────
    if (recentHighlight) {
      list.push({
        id: "achievement",
        render: () => (
          <div className="h-full flex flex-col justify-between p-5">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Logro reciente
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 flex-1 justify-center">
              <p className="text-5xl">{recentHighlight.icon}</p>
              <div className="text-center space-y-1">
                <p className="text-lg font-bold">{recentHighlight.title}</p>
                {recentHighlight.description && (
                  <p className="text-xs text-muted-foreground">{recentHighlight.description}</p>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-warning/8 px-4 py-2.5 text-center">
              <p className="text-xs font-semibold text-warning">
                {recentHighlight.value}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {format(recentHighlight.date.toDate(), "d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>
        ),
      })
    }

    // 14 ── Consejo del día ────────────────────────────────────────────────
    list.push({
      id: "tip",
      render: () => (
        <div className="h-full flex flex-col justify-between p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-warning" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Consejo del día
            </p>
          </div>
          <p className="text-xl font-bold leading-snug flex-1 flex items-center">{tip}</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-full",
                    i < (now.getDate() % 7) ? "w-3 bg-primary" : "w-1 bg-muted"
                  )}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Consejo {(now.getDate() % TIPS.length) + 1} de {TIPS.length}
            </p>
          </div>
        </div>
      ),
    })

    return list
  }, [
    monthTotal, todayTotal, dailyAvg, daysLeft, daysInMonth, canSpendPerDay,
    todayExpenses, categories, weekDays, thisWeekTotal, lastWeekTotal, weekDelta,
    topExpense, topCategory, overBudget, activeGoal, nextRecurring,
    flagged, weeklySummary, streak, recentHighlight, tip, filtered, recurring, now,
  ])

  const total = cards.length

  // Clamp index if cards change
  const safeIndex = Math.min(currentIndex, total - 1)

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Card counter badge */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {safeIndex + 1} / {total}
        </p>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === safeIndex ? "w-4 bg-primary" : "w-1 bg-muted-foreground/25"
              )}
              aria-label={`Tarjeta ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Card content */}
      <div className="relative h-[268px]">
        {cards.map((card, i) => (
          <div
            key={card.id}
            className={cn(
              "absolute inset-0 transition-all duration-300",
              i === safeIndex
                ? "opacity-100 translate-x-0"
                : i < safeIndex
                ? "opacity-0 -translate-x-full pointer-events-none"
                : "opacity-0 translate-x-full pointer-events-none"
            )}
          >
            {card.render()}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/40">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={safeIndex === 0}
          className="p-1.5 rounded-lg disabled:opacity-25 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground font-medium">
            Desliza para ver más
          </p>
        </div>

        <button
          onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
          disabled={safeIndex === total - 1}
          className="p-1.5 rounded-lg disabled:opacity-25 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
