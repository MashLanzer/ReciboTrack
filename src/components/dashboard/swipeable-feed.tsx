"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { startOfMonth, endOfMonth, subDays, startOfDay, endOfDay } from "date-fns"
import { formatCurrency, cn } from "@/lib/utils"
import { useExpensesPeriod, useExpensesForMonth } from "@/hooks/use-expenses"
import { useGoals } from "@/hooks/use-goals"
import { useCategoryBudgets } from "@/hooks/use-category-budgets"
import { useCategories } from "@/hooks/use-categories"
import { Skeleton } from "@/components/ui/skeleton"

const TIPS = [
  "Guarda el 20% de tus ingresos antes de gastar.",
  "Evita compras impulsivas esperando 48 horas antes de decidir.",
  "Revisa tus suscripciones cada trimestre — cancela las que no usas.",
  "El interés compuesto funciona mejor cuanto antes empieces a ahorrar.",
  "Ten un fondo de emergencia de 3 a 6 meses de gastos fijos.",
  "Compara precios antes de comprar — incluso diferencias pequeñas importan.",
  "Usa la regla 50/30/20: necesidades, deseos y ahorro.",
  "Automatiza tus ahorros con transferencias automáticas el día de cobro.",
  "Cocinar en casa puede ahorrarte hasta un 60% en comida.",
  "Revisa tu historial de gastos cada semana para detectar tendencias.",
]

function CardShell({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn(
      "snap-start shrink-0 h-[200px] w-full rounded-2xl border p-4 flex flex-col justify-between",
      accent ? "bg-primary/5 border-primary/20" : "bg-card"
    )}>
      {children}
    </div>
  )
}

export function SwipeableFeed() {
  const now = useMemo(() => new Date(), [])
  const monthStart = useMemo(() => startOfMonth(now), [now])
  const monthEnd = useMemo(() => endOfMonth(now), [now])
  const weekStart = useMemo(() => subDays(startOfDay(now), 6), [now])

  const { data: monthExpenses = [], isLoading: loadMonth } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)
  const { data: weekExpenses = [], isLoading: loadWeek } = useExpensesPeriod(weekStart, endOfDay(now))
  const { data: goals = [] } = useGoals()
  const { data: budgets = [] } = useCategoryBudgets(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  const { data: categories = [] } = useCategories()

  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // Listen for scroll to update active dot
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const idx = Math.round(el.scrollTop / 200)
      setActiveIdx(idx)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  const monthTotal = useMemo(() => monthExpenses.reduce((s, e) => s + e.total, 0), [monthExpenses])

  // Biggest expense in the last 7 days
  const biggestWeek = useMemo(() => {
    if (!weekExpenses.length) return null
    return [...weekExpenses].sort((a, b) => b.total - a.total)[0]
  }, [weekExpenses])

  // Budget alert: any category over 80%
  const budgetAlert = useMemo(() => {
    const catSpend = new Map<string, number>()
    for (const e of monthExpenses) {
      catSpend.set(e.category, (catSpend.get(e.category) ?? 0) + e.total)
    }
    for (const b of budgets) {
      const spent = catSpend.get(b.categoryId) ?? 0
      const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0
      if (pct >= 80) {
        const cat = categories.find(c => c.id === b.categoryId)
        return { name: cat?.name ?? b.categoryId, icon: cat?.icon ?? "📦", pct }
      }
    }
    return null
  }, [monthExpenses, budgets, categories])

  // Active goal closest to completion
  const activeGoal = useMemo(() => {
    const saving = goals.filter(g => g.isActive && g.type === "saving")
    if (!saving.length) return null
    return [...saving].sort((a, b) => {
      const pA = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0
      const pB = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0
      return pB - pA
    })[0]
  }, [goals])

  // Days-under-average streak (simplified: count consecutive days this month that spent less than monthly avg/day)
  const streak = useMemo(() => {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const dailyAvg = monthTotal / Math.max(dayOfMonth, 1)
    if (dailyAvg === 0) return 0

    const byDay = new Map<number, number>()
    for (const e of monthExpenses) {
      const d = e.date.toDate().getDate()
      byDay.set(d, (byDay.get(d) ?? 0) + e.total)
    }

    let count = 0
    for (let d = dayOfMonth; d >= 1; d--) {
      const spent = byDay.get(d) ?? 0
      if (spent < dailyAvg) count++
      else break
    }
    return count
  }, [monthExpenses, monthTotal, now])

  const tipIdx = useMemo(() => now.getDate() % TIPS.length, [now])

  const isLoading = loadMonth || loadWeek

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <Skeleton key={i} className="h-[200px] rounded-2xl" />)}
      </div>
    )
  }

  const cards: React.ReactNode[] = []

  // Card 1: Balance
  cards.push(
    <CardShell key="balance" accent>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Este mes</p>
        <p className="text-3xl font-black tabular-nums mt-1">{formatCurrency(monthTotal)}</p>
        <p className="text-xs text-muted-foreground mt-1">{monthExpenses.length} transacciones</p>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${Math.min((monthTotal / Math.max(monthTotal * 1.2, 1)) * 100, 100)}%` }}
        />
      </div>
    </CardShell>
  )

  // Card 2: Top expense of the week
  if (biggestWeek) {
    const cat = categories.find(c => c.id === biggestWeek.category)
    cards.push(
      <CardShell key="top-expense">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Mayor gasto de la semana</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl">{cat?.icon ?? "📦"}</span>
            <div className="min-w-0">
              <p className="font-bold truncate">{biggestWeek.merchant}</p>
              <p className="text-xs text-muted-foreground">{cat?.name ?? biggestWeek.category}</p>
            </div>
          </div>
        </div>
        <p className="text-2xl font-black tabular-nums text-destructive">
          -{formatCurrency(biggestWeek.total, biggestWeek.currency)}
        </p>
      </CardShell>
    )
  }

  // Card 3: Budget alert
  if (budgetAlert) {
    cards.push(
      <CardShell key="budget-alert">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-600">Alerta de presupuesto</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-3xl">{budgetAlert.icon}</span>
            <p className="font-bold">{budgetAlert.name}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Has usado el <strong>{budgetAlert.pct.toFixed(0)}%</strong> del presupuesto esta categoria
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", budgetAlert.pct >= 100 ? "bg-destructive" : "bg-amber-500")}
            style={{ width: `${Math.min(budgetAlert.pct, 100)}%` }}
          />
        </div>
      </CardShell>
    )
  }

  // Card 4: Goal progress
  if (activeGoal) {
    const pct = activeGoal.targetAmount > 0
      ? Math.min((activeGoal.currentAmount / activeGoal.targetAmount) * 100, 100)
      : 0
    cards.push(
      <CardShell key="goal">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Meta de ahorro</p>
          <p className="font-bold mt-2 truncate">{activeGoal.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatCurrency(activeGoal.currentAmount, activeGoal.currency)} de {formatCurrency(activeGoal.targetAmount, activeGoal.currency)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-right text-muted-foreground tabular-nums">{pct.toFixed(0)}%</p>
        </div>
      </CardShell>
    )
  }

  // Card 5: Streak
  cards.push(
    <CardShell key="streak">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Racha de ahorro</p>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-5xl font-black">{streak}</span>
          <span className="text-sm text-muted-foreground pb-1">dia{streak !== 1 ? "s" : ""} consecutivos</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {streak > 0
            ? `Por debajo del promedio diario durante ${streak} dia${streak !== 1 ? "s" : ""}.`
            : "Intenta gastar menos que tu promedio diario hoy."}
        </p>
      </div>
      <p className="text-2xl">{streak >= 7 ? "🔥" : streak >= 3 ? "⚡" : "💪"}</p>
    </CardShell>
  )

  // Card 6: Financial tip
  cards.push(
    <CardShell key="tip">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Consejo financiero</p>
        <p className="text-sm font-medium mt-3 leading-relaxed">{TIPS[tipIdx]}</p>
      </div>
      <span className="text-2xl">💡</span>
    </CardShell>
  )

  const totalCards = cards.length

  return (
    <div className="relative flex gap-3">
      {/* Scrollable cards */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory h-[200px] space-y-0 scrollbar-none"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div className="space-y-3">
          {cards}
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex flex-col justify-center gap-1.5 shrink-0">
        {Array.from({ length: totalCards }).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              containerRef.current?.scrollTo({ top: i * 200, behavior: "smooth" })
            }}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              activeIdx === i ? "w-4 bg-foreground" : "w-1.5 bg-muted-foreground/30"
            )}
            aria-label={`Tarjeta ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
