"use client"

import { useState, useMemo } from "react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useCategoryBudgets } from "@/hooks/use-category-budgets"
import { useGoals } from "@/hooks/use-goals"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { subDays, startOfDay, endOfDay, format } from "date-fns"
import { es } from "date-fns/locale"
import { Flame, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react"

const TIPS = [
  "Registra tus gastos justo después de pagar — la memoria falla.",
  "Revisar tu presupuesto 5 min al día evita sorpresas a fin de mes.",
  "El café diario puede costar más de 1.000€ al año.",
  "Separa el 20% de cada ingreso antes de gastar.",
  "Los gastos pequeños y frecuentes son los más difíciles de controlar.",
]

export function SwipeableFeed() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const now = useMemo(() => new Date(), [])
  const { activeAccount } = useUIStore()

  const start30 = useMemo(() => subDays(startOfDay(now), 29), [now])
  const { data: expenses30 = [] } = useExpensesPeriod(start30, endOfDay(now))
  const { data: goals = [] } = useGoals()
  const month = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    [now]
  )
  const { data: budgets = [] } = useCategoryBudgets(month)

  const filtered = useMemo(
    () =>
      expenses30.filter((e) =>
        activeAccount === "business"
          ? e.account === "business"
          : !e.account || e.account === "personal"
      ),
    [expenses30, activeAccount]
  )

  const todayExpenses = useMemo(
    () =>
      filtered.filter((e) => {
        const d = (e.date as { toDate(): Date }).toDate()
        return d >= startOfDay(now) && d <= endOfDay(now)
      }),
    [filtered, now]
  )
  const todayTotal = useMemo(
    () => todayExpenses.reduce((s, e) => s + e.total, 0),
    [todayExpenses]
  )
  const monthTotal = useMemo(
    () => filtered.reduce((s, e) => s + e.total, 0),
    [filtered]
  )
  const dailyAvg = monthTotal / 30

  const topExpense = useMemo(
    () => (filtered.length > 0 ? [...filtered].sort((a, b) => b.total - a.total)[0] : null),
    [filtered]
  )

  // streak: consecutive days under daily avg
  const streak = useMemo(() => {
    let count = 0
    for (let i = 1; i <= 30; i++) {
      const dayTotal = filtered
        .filter((e) => {
          const d = (e.date as { toDate(): Date }).toDate()
          return d >= startOfDay(subDays(now, i)) && d <= endOfDay(subDays(now, i))
        })
        .reduce((s, e) => s + e.total, 0)
      if (dailyAvg > 0 && dayTotal <= dailyAvg) count++
      else break
    }
    return count
  }, [filtered, dailyAvg, now])

  const activeGoal = useMemo(
    () =>
      goals
        .filter((g) => g.isActive)
        .sort((a, b) => b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount)[0] ??
      null,
    [goals]
  )

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

  const tip = TIPS[now.getDate() % TIPS.length]

  // Build card list
  const cards = useMemo(() => {
    const list: Array<{ id: string; render: () => React.ReactNode }> = []

    // Card 1: Balance del mes
    list.push({
      id: "balance",
      render: () => (
        <div className="h-full flex flex-col justify-between p-5">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Este mes
            </p>
            <p className="text-3xl font-black tabular-nums mt-1">{formatCurrency(monthTotal)}</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hoy</span>
              <span
                className={cn(
                  "font-bold",
                  todayTotal > dailyAvg ? "text-destructive" : "text-emerald-500"
                )}
              >
                {formatCurrency(todayTotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Media diaria</span>
              <span className="font-semibold">{formatCurrency(dailyAvg)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  todayTotal > dailyAvg ? "bg-destructive" : "bg-primary"
                )}
                style={{
                  width: `${Math.min((todayTotal / Math.max(dailyAvg, 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      ),
    })

    // Card 2: Mayor gasto
    if (topExpense) {
      list.push({
        id: "top",
        render: () => (
          <div className="h-full flex flex-col justify-between p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Mayor gasto (30 días)
            </p>
            <div className="text-center space-y-1">
              <p className="text-4xl font-black tabular-nums text-destructive">
                {formatCurrency(topExpense.total)}
              </p>
              <p className="text-lg font-bold">{topExpense.merchant}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {format(
                  (topExpense.date as { toDate(): Date }).toDate(),
                  "d 'de' MMMM",
                  { locale: es }
                )}
              </p>
            </div>
            <div />
          </div>
        ),
      })
    }

    // Card 3: Alerta presupuesto
    if (overBudget.length > 0) {
      list.push({
        id: "budget",
        render: () => (
          <div className="h-full flex flex-col justify-between p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Alerta de presupuesto
            </p>
            <div className="space-y-2">
              {overBudget.slice(0, 3).map((b) => {
                const spent = filtered
                  .filter((e) => e.category === b.categoryId)
                  .reduce((s, e) => s + e.total, 0)
                const pct = Math.round((spent / b.amount) * 100)
                return (
                  <div key={b.categoryId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{b.categoryId}</span>
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          pct >= 100 ? "text-destructive" : "text-amber-500"
                        )}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          pct >= 100 ? "bg-destructive" : "bg-amber-500"
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div />
          </div>
        ),
      })
    }

    // Card 4: Meta más cercana
    if (activeGoal) {
      const pct = Math.round((activeGoal.currentAmount / activeGoal.targetAmount) * 100)
      list.push({
        id: "goal",
        render: () => (
          <div className="h-full flex flex-col justify-between p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Meta de ahorro
            </p>
            <div className="space-y-3">
              <p className="text-lg font-bold">{activeGoal.name}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {formatCurrency(activeGoal.currentAmount)}
                  </span>
                  <span className="font-bold">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {formatCurrency(activeGoal.targetAmount)}
                </p>
              </div>
            </div>
            <div />
          </div>
        ),
      })
    }

    // Card 5: Racha
    list.push({
      id: "streak",
      render: () => (
        <div className="h-full flex flex-col justify-center items-center p-5 text-center space-y-3">
          <Flame
            className={cn(
              "h-10 w-10",
              streak >= 7
                ? "text-orange-500"
                : streak >= 3
                ? "text-primary"
                : "text-muted-foreground/40"
            )}
          />
          <div>
            <p className="text-4xl font-black">{streak}</p>
            <p className="text-sm text-muted-foreground">
              {streak === 1 ? "día bajo tu media" : "días bajo tu media"}
            </p>
          </div>
          {streak === 0 && (
            <p className="text-xs text-muted-foreground">
              Mantente bajo {formatCurrency(dailyAvg)}/día para empezar una racha
            </p>
          )}
        </div>
      ),
    })

    // Card 6: Tip
    list.push({
      id: "tip",
      render: () => (
        <div className="h-full flex flex-col justify-center p-5 space-y-4">
          <Lightbulb className="h-6 w-6 text-amber-500" />
          <p className="text-base font-semibold leading-relaxed">{tip}</p>
          <p className="text-xs text-muted-foreground">Consejo del día</p>
        </div>
      ),
    })

    return list
  }, [monthTotal, todayTotal, dailyAvg, topExpense, overBudget, activeGoal, streak, tip, filtered, now])

  const total = cards.length

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Card content */}
      <div className="relative h-52">
        {cards.map((card, i) => (
          <div
            key={card.id}
            className={cn(
              "absolute inset-0 transition-all duration-300",
              i === currentIndex
                ? "opacity-100 translate-x-0"
                : i < currentIndex
                ? "opacity-0 -translate-x-full"
                : "opacity-0 translate-x-full"
            )}
          >
            {card.render()}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border/40">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Dots */}
        <div className="flex gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === currentIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
              aria-label={`Tarjeta ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
          disabled={currentIndex === total - 1}
          className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
